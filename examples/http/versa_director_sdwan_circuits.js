/**
 * Domotz Custom Driver
 * Name: Versa Director - SD-WAN Circuits
 * Description: Retrieves SD-WAN access-circuit statistics for the whole fabric in a single call
 *              and reports one row per site and circuit: the local and remote circuit names, the
 *              encapsulation, the endpoint addresses and the traffic counters.
 *
 * Communication protocol: HTTPS (Versa Director northbound REST API)
 *
 * Tested on: Versa Director 22.1.4-GA
 *
 * ---------------------------------------------------------------------------------------------
 * WHY THIS IS ONE CALL AND NOT ONE PER APPLIANCE
 * ---------------------------------------------------------------------------------------------
 * The obvious way to collect per-circuit statistics is to ask every appliance about itself, which
 * costs one HTTPS round trip per site and cannot finish inside the Domotz execution timeout on a
 * fleet of any size. It turns out not to be necessary.
 *
 * Versa's live-command gateway proxies a YANG query to one appliance, and when that appliance is
 * a HUB the sd-wan/statistics/access-circuit subtree describes the hub's circuits to every remote
 * site it is connected to. Querying a single hub therefore returns the whole fabric in one
 * request. Set sourceAppliance to a hub; the driver otherwise auto-selects one.
 *
 * The consequence to be aware of: the result is the fabric as seen FROM that hub. A site with no
 * circuit to the chosen hub will not appear. In a multi-hub topology, run one instance of this
 * driver per hub.
 *
 * ---------------------------------------------------------------------------------------------
 * CONFIRMED API BEHAVIOUR
 * ---------------------------------------------------------------------------------------------
 * - Gateway: GET /vnms/dashboard/appliance/{applianceName}/live?uuid={uuid}&command={yangPath}
 * - command is a YANG PATH, not a CLI command. Confirmed working paths include: interfaces,
 *   interfaces:interfaces/detail, system, orgs, routing-instances, bgp, and the path used here:
 *       orgs/org/{organization}/sd-wan/statistics/access-circuit
 *   Invalid paths return HTTP 404 with {"errors":{"error":[{"error-message":"invalid path"}]}}.
 * - The response is { "collection": { "sdwan:access-circuit": [ { site-name, ackt-detail: [] } ] } }
 *   with one entry per remote site and one ackt-detail entry per circuit to that site.
 * - Confirmed ackt-detail fields: local-ackt-name, remote-ackt-name, encap-type, local-ip,
 *   remote-ip, rx-pkts, rx-bytes, tx-pkts, tx-bytes. Counters arrive as STRINGS and are coerced.
 * - A site typically carries BOTH a "plaintext" and an "encrypted" circuit between the same pair
 *   of circuit names, with very different traffic volumes. Encapsulation is therefore part of a
 *   circuit's identity, not a descriptive attribute.
 * - Latency, jitter and loss are NOT in this subtree - it reports traffic counters only. They
 *   belong to the sibling sd-wan/sla-monitor subtree (which exposes "brief" and
 *   "end-to-end/status") and deserve a separate driver. The columns remain here, mapped
 *   defensively, in case another release carries them alongside the counters.
 *
 * ---------------------------------------------------------------------------------------------
 * REQUIREMENTS
 * ---------------------------------------------------------------------------------------------
 * 1. A Versa Director account. A tenant-scoped role (e.g. TenantOperator) is sufficient.
 * 2. An OAuth client (Client ID + Client Secret) registered on the Director.
 * 3. The Domotz device must be the Versa Director, with its account stored in the device's
 *    Custom Driver Management credentials.
 *
 * ---------------------------------------------------------------------------------------------
 * DRIVER PARAMETERS (declared in the Domotz UI - they cannot be created from code)
 * ---------------------------------------------------------------------------------------------
 *   clientId         SECRET_TEXT  OAuth client ID.                       Required.
 *   clientSecret     SECRET_TEXT  OAuth client secret.                   Required.
 *   authPort         STRING       Token endpoint port.  Optional, defaults to 9183.
 *   apiPort          STRING       REST API port.        Optional, defaults to 9183.
 *   directorHost     STRING       FQDN of the Director, e.g. director.example.com.   Optional.
 *                                 Blank keeps the previous behaviour: requests go to the IP
 *                                 address of the Domotz device this driver is attached to. Set
 *                                 it when the Director must be addressed by name - because a
 *                                 load balancer or reverse proxy routes on SNI or the Host
 *                                 header, because the certificate is issued to the hostname, or
 *                                 because policy requires it. A full URL is accepted and reduced
 *                                 to the bare host, so https://director.example.com:9183/auth/token
 *                                 works too; ports still come from authPort and apiPort.
 *   sourceAppliance  STRING       Name of the hub to query. Optional. Leave blank to auto-select
 *                                 the first appliance whose name contains "HUB", falling back to
 *                                 the first appliance in the inventory. The appliance actually
 *                                 used is written to the execution log on every run. An
 *                                 undeclared parameter is harmless - the sandbox logs "Missing
 *                                 parameter name" and returns undefined, which selects the
 *                                 auto-select path - but declaring it silences that message.
 *
 * Username and password come from the device's stored credentials, NOT from parameters, so the
 * Director password is never held in the driver definition. That remains true when directorHost
 * is set: only the destination host changes, never where the credentials come from.
 *
 * ---------------------------------------------------------------------------------------------
 * OUTPUT
 * ---------------------------------------------------------------------------------------------
 * Variables: circuits discovered, sites reached, and the source appliance used.
 * Table "SD-WAN Circuits", one row per site and circuit.
 **/

const DEFAULT_PORT = "9183"
const SITE_PAGE_SIZE = 1000
const TOKEN_PATH = "/auth/token"
const INVENTORY_PATH = "/vnms/appliance/appliance"
const CIRCUIT_YANG_PATH = "/sd-wan/statistics/access-circuit"

const clientIdParam = D.getParameter("clientId")
const clientSecretParam = D.getParameter("clientSecret")
const authPortParam = D.getParameter("authPort")
const apiPortParam = D.getParameter("apiPort")
const directorHostParam = D.getParameter("directorHost")
const sourceApplianceParam = D.getParameter("sourceAppliance")

const authPortValue = parseInt(authPortParam || DEFAULT_PORT, 10)
const apiPortValue = parseInt(apiPortParam || DEFAULT_PORT, 10)

/**
 * Reduces whatever was entered for directorHost to a bare hostname. People reasonably paste a
 * whole URL copied from a browser or a vendor document, so the scheme, any path and any port are
 * stripped rather than rejected. The port is deliberately NOT taken from here: authPort and
 * apiPort remain the single source of truth, because the token endpoint and the API can differ.
 * @param {string} raw the configured value
 * @returns {string|null} a bare hostname, or null when nothing usable was given
 */
function normalizeHost(raw) {
  if (!raw) return null
  let host = String(raw).trim()
  host = host.replace(/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//, "")
  host = host.split("/")[0].split("?")[0]
  // Leave an IPv6 literal in brackets alone; otherwise strip a trailing :port.
  if (host.charAt(0) !== "[") host = host.split(":")[0]
  host = host.trim()
  return host.length > 0 ? host : null
}

/**
 * The device every HTTP request in this driver is made against.
 *
 * D.device always targets the IP address configured on the Domotz device. When the Director has
 * to be reached by name instead, D.createExternalDevice returns an object exposing the same
 * interface, pointed at that hostname - so this single assignment redirects every request in the
 * driver and nothing else has to change.
 *
 * Credentials are deliberately not passed to it. Username and password continue to come from the
 * Domotz device's stored credentials via D.device.username() / D.device.password().
 *
 * NAMING, AND WHY IT IS NOT "directorHost": when a parameter is declared in the Domotz UI the
 * sandbox appends its own "var <parameterName> = D.getParameter('<parameterName>')" to the end of
 * the script. A const in this file sharing that name is a redeclaration and the whole driver dies
 * at parse time with "Identifier 'directorHost' has already been declared" - before a single line
 * runs. Never name a variable after a parameter; read the parameter into a distinctly named one.
 */
const resolvedHost = normalizeHost(directorHostParam)
const target = resolvedHost ? D.createExternalDevice(resolvedHost) : D.device

let accessToken
let authenticatedOrg

const circuitsTable = D.createTable(
  "SD-WAN Circuits",
  [
    { label: "Site", valueType: D.valueType.STRING },
    { label: "Local Circuit", valueType: D.valueType.STRING },
    { label: "Remote Circuit", valueType: D.valueType.STRING },
    { label: "Encapsulation", valueType: D.valueType.STRING },
    { label: "Local IP", valueType: D.valueType.STRING },
    { label: "Remote IP", valueType: D.valueType.STRING },
    { label: "RX Packets", valueType: D.valueType.NUMBER },
    { label: "RX Bytes", valueType: D.valueType.NUMBER },
    { label: "TX Packets", valueType: D.valueType.NUMBER },
    { label: "TX Bytes", valueType: D.valueType.NUMBER },
    { label: "Latency", unit: "ms", valueType: D.valueType.NUMBER },
    { label: "Jitter", unit: "ms", valueType: D.valueType.NUMBER },
    { label: "Packet Loss", unit: "%", valueType: D.valueType.NUMBER }
  ]
)

// ------------------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------------------

/**
 * Returns the first defined, non-empty value found in an object for a list of candidate keys.
 * @param {Object} source object to read from
 * @param {Array<string>} keys candidate key names, checked in order
 * @param {*} fallback returned when no key yields a usable value
 * @returns {*} the resolved value, or the fallback
 */
function pick(source, keys, fallback) {
  if (!source) return fallback
  for (let i = 0; i < keys.length; i++) {
    const value = source[keys[i]]
    if (value !== undefined && value !== null && value !== "") return value
  }
  return fallback
}

/**
 * Coerces a value to a finite number. Versa returns counters as strings, so this is applied to
 * every numeric column rather than trusting the JSON type.
 * @param {*} value the raw value
 * @returns {number|null} the parsed number, or null
 */
function toNumber(value) {
  if (value === undefined || value === null || value === "") return null
  const parsed = parseFloat(value)
  return isNaN(parsed) ? null : parsed
}

/**
 * Produces a short, stable hash of a string, used to keep record ids unique when the natural key
 * exceeds the length limit.
 * @param {string} value the string to hash
 * @returns {string} a short base-36 hash
 */
function shortHash(value) {
  let hash = 5381
  for (let i = 0; i < value.length; i++) {
    hash = ((hash * 33) ^ value.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}

/**
 * Builds a record id that is both unique and STABLE across runs.
 *
 * Stability matters because Domotz keys history on the record id: an id derived from row order
 * would break history whenever a site appears or disappears.
 *
 * Uniqueness needs the full natural key. Site plus circuit names is NOT enough - a single site
 * commonly has several circuits sharing the same local and remote circuit names, distinguished
 * only by encapsulation and endpoint addresses. A confirmed example carries both a "plaintext"
 * and an "encrypted" WAN-1 to WAN-1 circuit, with completely different traffic volumes. Omitting
 * encapsulation and the addresses collapses them into one id and the insert fails outright.
 *
 * The full key usually exceeds the 50-character limit, so long ids keep a readable prefix and are
 * disambiguated with a deterministic hash of the whole key.
 * @param {string} site the site name
 * @param {string} localCircuit the local circuit name
 * @param {string} remoteCircuit the remote circuit name
 * @param {string} encapsulation the encapsulation type
 * @param {string} localIp the local endpoint address
 * @param {string} remoteIp the remote endpoint address
 * @returns {string} a safe, unique, stable record id
 */
function circuitRecordId(site, localCircuit, remoteCircuit, encapsulation, localIp, remoteIp) {
  const full = [site, localCircuit, remoteCircuit, encapsulation, localIp, remoteIp]
    .join("-")
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
  if (full.length <= 50) return full
  return full.slice(0, 42) + "-" + shortHash(full)
}

/**
 * Recursively locates the first array of objects within a parsed response, so a list is still
 * found if a Director release changes its container key.
 * @param {*} node value to inspect
 * @param {number} depth current recursion depth
 * @returns {Array<Object>|null} the first array of objects found, or null
 */
function findFirstObjectArray(node, depth) {
  if (!node || depth > 4) return null
  if (Array.isArray(node)) {
    return (node.length > 0 && typeof node[0] === "object" && node[0] !== null) ? node : null
  }
  if (typeof node !== "object") return null
  const keys = Object.keys(node)
  for (let i = 0; i < keys.length; i++) {
    const found = findFirstObjectArray(node[keys[i]], depth + 1)
    if (found) return found
  }
  return null
}

/**
 * Maps an HTTP status code to the matching Domotz error type.
 * @param {number} statusCode the HTTP status code
 * @returns {string} a D.errorType constant
 */
function errorTypeForStatus(statusCode) {
  if (statusCode === 401 || statusCode === 403) return D.errorType.AUTHENTICATION_ERROR
  if (statusCode === 404) return D.errorType.RESOURCE_UNAVAILABLE
  return D.errorType.GENERIC_ERROR
}

// ------------------------------------------------------------------------------------------
// Versa Director API
// ------------------------------------------------------------------------------------------

/**
 * Authenticates against the Director's OAuth token endpoint and stores the bearer token and the
 * authenticated organization, which forms part of the YANG path.
 * @returns {Promise} resolves once a token has been obtained
 */
function login() {
  const config = {
    url: TOKEN_PATH,
    protocol: "https",
    port: authPortValue,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username: D.device.username(),
      password: D.device.password(),
      grant_type: "password",
      client_id: clientIdParam,
      client_secret: clientSecretParam
    }),
    rejectUnauthorized: false,
    jar: true
  }
  console.log("Authenticating against " + (resolvedHost || D.device.ip()) + ":" + authPortValue +
    (resolvedHost ? " (directorHost)" : " (device IP)"))
  return new Promise(function (resolve) {
    target.http.post(config, function (error, response, body) {
      if (error) {
        console.log("Token request failed: " + error)
        D.failure(D.errorType.GENERIC_ERROR)
        return
      }
      const statusCode = response && response.statusCode
      if (statusCode !== 200) {
        console.log("Token endpoint returned HTTP " + statusCode + ": " +
          (body ? String(body).slice(0, 500) : "<empty response>"))
        D.failure(errorTypeForStatus(statusCode))
        return
      }
      let payload
      try {
        payload = JSON.parse(body)
      } catch (parseError) {
        console.log("Token response was not valid JSON: " + parseError)
        D.failure(D.errorType.PARSING_ERROR)
        return
      }
      const token = (payload.tokenDetails && payload.tokenDetails.accessToken) || payload.access_token
      if (!token) {
        console.log("No access token in the response. Keys returned: " +
          Object.keys(payload).join(", "))
        D.failure(D.errorType.AUTHENTICATION_ERROR)
        return
      }
      accessToken = token
      authenticatedOrg = (payload.user && payload.user.organization) || null
      if (!authenticatedOrg) {
        console.log("The token response did not name an organization, which the YANG path requires.")
        D.failure(D.errorType.AUTHENTICATION_ERROR)
        return
      }
      resolve()
    })
  })
}

/**
 * Performs an authenticated GET against the Director's REST API.
 * @param {string} path URL path, including any query string
 * @returns {Promise<Object>} resolves with the parsed JSON body
 */
function apiGet(path) {
  const config = {
    url: path,
    protocol: "https",
    port: apiPortValue,
    headers: {
      "Accept": "application/json",
      "Authorization": "Bearer " + accessToken
    },
    rejectUnauthorized: false,
    jar: true
  }
  return new Promise(function (resolve) {
    target.http.get(config, function (error, response, body) {
      if (error) {
        console.log("Request to " + path + " failed: " + error)
        D.failure(D.errorType.GENERIC_ERROR)
        return
      }
      const statusCode = response && response.statusCode
      if (statusCode !== 200) {
        console.log("GET " + path + " returned HTTP " + statusCode + ": " +
          (body ? String(body).slice(0, 500) : "<empty response>"))
        D.failure(errorTypeForStatus(statusCode))
        return
      }
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (parseError) {
        console.log("Response from " + path + " was not valid JSON: " + parseError)
        D.failure(D.errorType.PARSING_ERROR)
      }
    })
  })
}

/**
 * Chooses the appliance to query. An explicit sourceAppliance wins; otherwise the first appliance
 * whose name contains "HUB" is preferred, because only a hub sees circuits to every remote site.
 * @returns {Promise<Object>} resolves with { name, uuid }
 */
function selectSourceAppliance() {
  return apiGet(INVENTORY_PATH + "?offset=0&limit=" + SITE_PAGE_SIZE).then(function (payload) {
    const container = payload["versanms.ApplianceStatusResult"]
    const list = (container && Array.isArray(container.appliance))
      ? container.appliance
      : (findFirstObjectArray(payload, 0) || [])

    if (list.length === 0) {
      console.log("The appliance inventory returned no appliances, so no source can be chosen.")
      D.failure(D.errorType.RESOURCE_UNAVAILABLE)
      return null
    }

    let chosen = null
    if (sourceApplianceParam) {
      for (let i = 0; i < list.length; i++) {
        if (String(list[i].name).toLowerCase() === String(sourceApplianceParam).toLowerCase()) {
          chosen = list[i]
          break
        }
      }
      if (!chosen) {
        console.log("The configured sourceAppliance \"" + sourceApplianceParam + "\" is not in " +
          "the inventory. Falling back to auto-selection.")
      }
    }
    if (!chosen) {
      for (let i = 0; i < list.length; i++) {
        if (String(list[i].name).toUpperCase().indexOf("HUB") !== -1) {
          chosen = list[i]
          break
        }
      }
    }
    if (!chosen) {
      chosen = list[0]
      console.log("No appliance with \"HUB\" in its name was found, so the first appliance is " +
        "used. If this is a hub-and-spoke fabric, set sourceAppliance to a hub for full coverage.")
    }

    console.log("Querying circuits from appliance \"" + chosen.name + "\".")
    return { name: chosen.name, uuid: chosen.uuid }
  })
}

/**
 * Retrieves access-circuit statistics for the whole fabric from a single appliance.
 * @param {Object} source the appliance to query, as { name, uuid }
 * @returns {Promise<Array<Object>>} resolves with one entry per remote site
 */
function retrieveCircuits(source) {
  const yangPath = "orgs/org/" + authenticatedOrg + CIRCUIT_YANG_PATH
  const path = "/vnms/dashboard/appliance/" + encodeURIComponent(source.name) +
    "/live?uuid=" + encodeURIComponent(source.uuid) + "&command=" + yangPath

  return apiGet(path).then(function (payload) {
    const collection = payload.collection || payload
    const sites = collection["sdwan:access-circuit"] ||
      collection["access-circuit"] ||
      findFirstObjectArray(payload, 0) || []

    if (sites.length === 0) {
      console.log("The circuit query succeeded but returned no sites. Top-level keys: " +
        Object.keys(payload).join(", "))
      return []
    }

    console.log("Retrieved circuit data for " + sites.length + " sites from \"" +
      source.name + "\".")
    console.log("Site entry fields: " + Object.keys(sites[0]).join(", "))
    const firstDetail = sites[0]["ackt-detail"] || sites[0].acktDetail
    if (firstDetail && firstDetail.length > 0) {
      console.log("Circuit fields: " + Object.keys(firstDetail[0]).join(", "))
      console.log("First raw circuit: " + JSON.stringify(firstDetail[0]).slice(0, 1200))
    }
    return sites
  })
}

/**
 * Builds the table rows and the fleet-level variables.
 * @param {Array<Object>} sites one entry per remote site
 * @param {Object} source the appliance the data was read from
 * @returns {Array<Object>} the Domotz variables to report alongside the table
 */
function buildOutput(sites, source) {
  let circuitCount = 0
  let sitesWithCircuits = 0
  // Guards against a duplicate id aborting the whole run. Domotz throws on a repeated record id,
  // so if the natural key ever fails to be unique on some release, the row is still reported
  // under a suffixed id and the collision is logged rather than losing the entire table.
  const usedIds = {}

  sites.forEach(function (site) {
    const siteName = String(pick(site, ["site-name", "siteName", "name"], "unknown"))
    const details = site["ackt-detail"] || site.acktDetail || []
    if (details.length > 0) sitesWithCircuits++

    details.forEach(function (circuit) {
      const localCircuit = String(pick(circuit,
        ["local-ackt-name", "localAcktName", "local-name"], "unknown"))
      const remoteCircuit = String(pick(circuit,
        ["remote-ackt-name", "remoteAcktName", "remote-name"], "unknown"))
      const encapsulation = String(pick(circuit,
        ["encap-type", "encapType", "encapsulation"], "N/A"))
      const localIp = String(pick(circuit, ["local-ip", "localIp", "local-address"], "N/A"))
      const remoteIp = String(pick(circuit, ["remote-ip", "remoteIp", "remote-address"], "N/A"))

      let recordId = circuitRecordId(siteName, localCircuit, remoteCircuit, encapsulation,
        localIp, remoteIp)
      if (usedIds[recordId]) {
        usedIds[recordId]++
        const suffixed = recordId.slice(0, 47) + "-" + usedIds[recordId]
        console.log("Duplicate record id \"" + recordId + "\" for site " + siteName +
          "; reporting it as \"" + suffixed + "\". The natural key needs another field.")
        recordId = suffixed
      } else {
        usedIds[recordId] = 1
      }

      circuitCount++
      circuitsTable.insertRecord(recordId, [
        siteName,
        localCircuit,
        remoteCircuit,
        encapsulation,
        localIp,
        remoteIp,
        toNumber(pick(circuit, ["rx-pkts", "rxPkts", "rx-packets"], null)),
        toNumber(pick(circuit, ["rx-bytes", "rxBytes"], null)),
        toNumber(pick(circuit, ["tx-pkts", "txPkts", "tx-packets"], null)),
        toNumber(pick(circuit, ["tx-bytes", "txBytes"], null)),
        // Mapped defensively. Confirmed absent from this subtree on 22.1.4-GA, where SLA metrics
        // live under the sibling sd-wan/sla-monitor subtree instead.
        toNumber(pick(circuit, ["latency", "delay", "rtt", "latency-ms"], null)),
        toNumber(pick(circuit, ["jitter", "jitter-ms"], null)),
        toNumber(pick(circuit, ["loss", "packet-loss", "packetLoss", "loss-percent"], null))
      ])
    })
  })

  console.log("Reported " + circuitCount + " circuits across " + sitesWithCircuits + " sites.")

  return [
    D.createVariable("circuit-count", "Circuits", circuitCount, null, D.valueType.NUMBER),
    D.createVariable("site-count", "Sites Reached", sitesWithCircuits, null, D.valueType.NUMBER),
    D.createVariable("source-appliance", "Source Appliance", source.name, null, D.valueType.STRING)
  ]
}

// ------------------------------------------------------------------------------------------
// Remote procedures
// ------------------------------------------------------------------------------------------

/**
 * @remote_procedure
 * @label Validate Versa Director connection
 * @documentation Confirms that the credentials are accepted, that a source appliance can be
 * selected, and that the live-command gateway returns circuit data for it
 */
function validate() {
  login()
    .then(selectSourceAppliance)
    .then(retrieveCircuits)
    .then(function () {
      D.success()
    })
    .catch(function (error) {
      console.log("Validation failed: " + error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}

/**
 * @remote_procedure
 * @label Get SD-WAN Circuits
 * @documentation Retrieves SD-WAN access-circuit statistics for the whole fabric from a single
 * hub appliance and reports one row per site and circuit
 */
function get_status() {
  login()
    .then(selectSourceAppliance)
    .then(function (source) {
      return retrieveCircuits(source).then(function (sites) {
        const variables = buildOutput(sites, source)
        D.success(variables, circuitsTable)
      })
    })
    .catch(function (error) {
      console.log("Failed to retrieve circuits: " + error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}
