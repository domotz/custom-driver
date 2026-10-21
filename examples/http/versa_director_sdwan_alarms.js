/**
 * Domotz Custom Driver
 * Name: Versa Director - SD-WAN Alarms
 * Description: Retrieves active fault alarms from a Versa Director and reports them per site:
 *              one row per appliance with a severity breakdown, the alarm types present, the
 *              worst severity, and the most recent alarm with its text. Fleet totals are exposed
 *              as variables. Closes the gap left by inventory polling, which reports state but
 *              never captures faults.
 *
 * Communication protocol: HTTPS (Versa Director northbound REST API)
 *
 * Tested on: Versa Director 22.1.4-GA
 *
 * ---------------------------------------------------------------------------------------------
 * WHY PER SITE
 * ---------------------------------------------------------------------------------------------
 * A fleet can carry hundreds of concurrent alarms, so one row per alarm is unreadable and churns
 * on every poll. Grouping by alarm type answers "what is wrong" but not "where", which is the
 * question a support workflow actually starts from. Grouping by site answers both: each row names
 * the appliance, counts its alarms by severity, and lists the alarm types present on it.
 *
 * Sites with no alarms are deliberately included, with zeroes. Their absence would be ambiguous -
 * a missing row could mean a healthy site or a site the Director has lost track of - and having
 * every site present means the table can be sorted by alarm count to rank the estate.
 *
 * ---------------------------------------------------------------------------------------------
 * REQUIREMENTS
 * ---------------------------------------------------------------------------------------------
 * 1. A Versa Director account. A tenant-scoped role (e.g. TenantOperator) is sufficient - both
 *    endpoints used here are tenant-visible, unlike the Director-level status endpoints, which
 *    return HTTP 403.
 * 2. An OAuth client (Client ID + Client Secret) registered on the Director.
 * 3. The Domotz device must be the Versa Director, with its account stored in the device's
 *    Custom Driver Management credentials.
 *
 * ---------------------------------------------------------------------------------------------
 * DRIVER PARAMETERS (declared in the Domotz UI - they cannot be created from code)
 * ---------------------------------------------------------------------------------------------
 *   clientId      SECRET_TEXT  OAuth client ID.                             Required.
 *   clientSecret  SECRET_TEXT  OAuth client secret.                         Required.
 *   authPort      STRING       Token endpoint port.     Optional, defaults to 9183.
 *   apiPort       STRING       REST API port.           Optional, defaults to 9183.
 *   directorHost  STRING       FQDN of the Director, e.g. director.example.com.   Optional.
 *                              Blank keeps the previous behaviour: requests go to the IP
 *                              address of the Domotz device this driver is attached to. Set
 *                              it when the Director must be addressed by name - because a
 *                              load balancer or reverse proxy routes on SNI or the Host
 *                              header, because the certificate is issued to the hostname, or
 *                              because policy requires it. A full URL is accepted and reduced
 *                              to the bare host, so https://director.example.com:9183/auth/token
 *                              works too; ports still come from authPort and apiPort.
 *   maxAlarms     STRING       Safety cap on alarms processed per run. Optional, defaults to
 *                              5000. This is a guard against an alarm storm, not a page size:
 *                              the endpoint ignores the limit parameter and returns the full set
 *                              regardless, so the cap is applied in code.
 *
 * Username and password come from the device's stored credentials, NOT from parameters, so the
 * Director password is never held in the driver definition. That remains true when directorHost
 * is set: only the destination host changes, never where the credentials come from.
 *
 * ---------------------------------------------------------------------------------------------
 * CONFIRMED API BEHAVIOUR
 * ---------------------------------------------------------------------------------------------
 * - Alarms: GET /vnms/fault/alarms, returned nested as { List: { value: [ ... ] } }. Other
 *   candidate alarm paths (/vnms/alarm/page, /vnms/alarm/summary, /vnms/dashboard/alarms,
 *   /nextgen/alarm) return HTTP 404 on this release and are not used.
 * - Alarm object fields: deviceName, org, type, device, specific-problem,
 *   lastStatusChangeTimeStamp, lastPerceivedSeverity, lastAlarmText, statusChanges,
 *   alarmHandlings, serialNum, severity, object.
 * - lastStatusChangeTimeStamp is epoch MILLISECONDS, not a date string.
 * - Observed severities: critical, major, warning, indeterminate. minor and cleared are ranked
 *   here as well since Versa's severity model includes them.
 * - Sites: GET /vnms/appliance/appliance, list nested under "versanms.ApplianceStatusResult".
 * - An alarm can name a device that is absent from the tenant appliance inventory (for example a
 *   controller). Those are still reported, flagged in the Source column, so alarms are never
 *   silently dropped.
 *
 * ---------------------------------------------------------------------------------------------
 * NOTES
 * ---------------------------------------------------------------------------------------------
 * - TLS verification is disabled (rejectUnauthorized: false) because Versa Directors are commonly
 *   deployed with self-signed or internal-CA certificates. Remove the flag if the collector
 *   trusts the certificate.
 *   Verification cannot succeed against a bare IP unless the certificate carries an IP SAN,
 *   which is why addressing the Director by name is a precondition for turning it back on.
 * - Every parameter is read via D.getParameter() into a distinctly named variable. Never declare
 *   or reference a bare identifier matching a parameter name - sandbox injection is inconsistent.
 * - Diagnostics use console.log; console.error is not consistently surfaced in collector logs.
 *
 * ---------------------------------------------------------------------------------------------
 * OUTPUT
 * ---------------------------------------------------------------------------------------------
 * Variables: total alarms, critical, major, warning, sites with alarms, sites clean.
 * Table "Alarms by Site", one row per site: Total Alarms, Critical, Major, Warning, Other,
 * Distinct Types, Alarm Types, Worst Severity, Most Recent, Latest Alarm, Source.
 **/

const DEFAULT_PORT = "9183"
const DEFAULT_MAX_ALARMS = 5000
const SITE_PAGE_SIZE = 1000
const TOKEN_PATH = "/auth/token"
const ALARMS_PATH = "/vnms/fault/alarms"
const INVENTORY_PATH = "/vnms/appliance/appliance"
const MAX_TYPES_TEXT = 200
const MAX_ALARM_TEXT = 180

const clientIdParam = D.getParameter("clientId")
const clientSecretParam = D.getParameter("clientSecret")
const authPortParam = D.getParameter("authPort")
const apiPortParam = D.getParameter("apiPort")
const directorHostParam = D.getParameter("directorHost")
const maxAlarmsParam = D.getParameter("maxAlarms")

const authPortValue = parseInt(authPortParam || DEFAULT_PORT, 10)
const apiPortValue = parseInt(apiPortParam || DEFAULT_PORT, 10)
const maxAlarmsValue = maxAlarmsParam ? parseInt(maxAlarmsParam, 10) : DEFAULT_MAX_ALARMS

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

/**
 * Versa severity ordering, worst first. Used to rank a site's worst severity and to decide which
 * counter each alarm increments.
 */
const SEVERITY_RANK = {
  critical: 5,
  major: 4,
  minor: 3,
  warning: 2,
  indeterminate: 1,
  cleared: 0
}

const sitesTable = D.createTable(
  "Alarms by Site",
  [
    { label: "Total Alarms", valueType: D.valueType.NUMBER },
    { label: "Critical", valueType: D.valueType.NUMBER },
    { label: "Major", valueType: D.valueType.NUMBER },
    { label: "Warning", valueType: D.valueType.NUMBER },
    { label: "Other", valueType: D.valueType.NUMBER },
    { label: "Distinct Types", valueType: D.valueType.NUMBER },
    { label: "Alarm Types", valueType: D.valueType.STRING },
    { label: "Worst Severity", valueType: D.valueType.STRING },
    { label: "Most Recent", valueType: D.valueType.STRING },
    { label: "Latest Alarm", valueType: D.valueType.STRING },
    { label: "Source", valueType: D.valueType.STRING }
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
 * Sanitizes a string for use as a Custom Driver table record id.
 * @param {string} value the raw string
 * @returns {string} a safe record id
 */
function sanitize(value) {
  const reservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
  const sanitizationRegex = new RegExp(reservedWords.join('|'), 'g')
  return value.replace(sanitizationRegex, '').replace(/[^a-zA-Z0-9]+/g, '-')
    .slice(0, 50).toLowerCase()
}

/**
 * Formats Versa's epoch-millisecond alarm timestamp as a readable UTC string. Values that are
 * already strings are passed through, and anything unparseable yields null so the cell stays
 * empty rather than showing a bogus date.
 * @param {number|string} value the raw timestamp
 * @returns {string|null} a "YYYY-MM-DD HH:MM:SS UTC" string, or null
 */
function formatTimestamp(value) {
  if (value === undefined || value === null || value === "") return null
  const millis = typeof value === "number" ? value : parseInt(value, 10)
  if (isNaN(millis) || millis <= 0) return typeof value === "string" ? value : null
  const iso = new Date(millis).toISOString()
  return iso.slice(0, 10) + " " + iso.slice(11, 19) + " UTC"
}

/**
 * Ranks a severity string, defaulting unknown values above "cleared" so they are never silently
 * treated as the least important thing on a site.
 * @param {string} severity the severity string
 * @returns {number} the rank, higher being worse
 */
function severityRank(severity) {
  if (!severity) return 0
  const rank = SEVERITY_RANK[String(severity).toLowerCase()]
  return rank === undefined ? 1 : rank
}

/**
 * Truncates text for display in a table cell.
 * @param {string} text the text to truncate
 * @param {number} limit maximum length
 * @returns {string} the truncated text
 */
function truncate(text, limit) {
  const value = String(text)
  return value.length > limit ? value.slice(0, limit - 3) + "..." : value
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
 * Authenticates against the Director's OAuth token endpoint and stores the bearer token.
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
 * Retrieves the site list so that appliances with no alarms still appear in the table.
 * @returns {Promise<Array<string>>} resolves with appliance names
 */
function retrieveSites() {
  return apiGet(INVENTORY_PATH + "?offset=0&limit=" + SITE_PAGE_SIZE).then(function (payload) {
    const container = payload["versanms.ApplianceStatusResult"]
    const list = (container && Array.isArray(container.appliance))
      ? container.appliance
      : (findFirstObjectArray(payload, 0) || [])
    if (list.length >= SITE_PAGE_SIZE) {
      console.log("The site list filled the requested page of " + SITE_PAGE_SIZE +
        " appliances, so some sites may be missing from the table.")
    }
    const names = list.map(function (appliance) {
      return pick(appliance, ["name", "applianceName"], null)
    }).filter(function (name) {
      return !!name
    })
    console.log("Retrieved " + names.length + " sites from the appliance inventory.")
    return names
  })
}

/**
 * Extracts the alarm array from the fault response, which nests it as { List: { value: [] } }.
 * @param {Object} payload parsed alarms response
 * @returns {Array<Object>} raw alarm objects
 */
function extractAlarms(payload) {
  if (Array.isArray(payload)) return payload
  if (payload.List && Array.isArray(payload.List.value)) return payload.List.value
  if (Array.isArray(payload.value)) return payload.value
  return findFirstObjectArray(payload, 0) || []
}

/**
 * Retrieves the active alarm set.
 * @returns {Promise<Array<Object>>} resolves with the raw alarm objects, capped at maxAlarms
 */
function retrieveAlarms() {
  return apiGet(ALARMS_PATH + "?offset=0&limit=" + maxAlarmsValue).then(function (payload) {
    const alarms = extractAlarms(payload)
    if (alarms.length === 0) {
      console.log("No active alarms were returned. Top-level keys: " +
        Object.keys(payload).join(", "))
      return []
    }
    console.log("Retrieved " + alarms.length + " active alarms.")
    if (alarms.length > maxAlarmsValue) {
      console.log("The Director returned " + alarms.length + " alarms, above the maxAlarms cap " +
        "of " + maxAlarmsValue + ". Only the first " + maxAlarmsValue + " are summarised this run.")
      return alarms.slice(0, maxAlarmsValue)
    }
    return alarms
  })
}

/**
 * Creates an empty per-site aggregate.
 * @param {string} name the site name
 * @param {boolean} inInventory whether the site appears in the appliance inventory
 * @returns {Object} the initialised aggregate
 */
function newSite(name, inInventory) {
  return {
    name: name,
    inInventory: inInventory,
    total: 0,
    critical: 0,
    major: 0,
    warning: 0,
    other: 0,
    types: {},
    typeCount: 0,
    worstRank: -1,
    worstSeverity: null,
    latestMillis: 0,
    latestText: null
  }
}

/**
 * Aggregates alarms per site, seeded with every site from the inventory so clean sites are
 * reported with zeroes rather than being absent.
 * @param {Array<Object>} alarms raw alarm objects
 * @param {Array<string>} siteNames appliance names from the inventory
 * @returns {Object} map of site name to its aggregate
 */
function aggregateBySite(alarms, siteNames) {
  const sites = {}
  siteNames.forEach(function (name) {
    sites[name] = newSite(name, true)
  })

  alarms.forEach(function (alarm) {
    const name = String(pick(alarm,
      ["deviceName", "device", "device-name", "applianceName"], "unknown"))
    if (!sites[name]) sites[name] = newSite(name, false)
    const site = sites[name]

    const severity = String(pick(alarm, ["severity", "lastPerceivedSeverity", "perceived-severity"],
      "indeterminate")).toLowerCase()
    const type = String(pick(alarm, ["type", "alarm-type", "alarmType"], "unknown"))
    const millis = parseInt(pick(alarm,
      ["lastStatusChangeTimeStamp", "lastStatusChangeTime", "eventTime", "timestamp"], 0), 10)

    site.total++
    if (severity === "critical") site.critical++
    else if (severity === "major") site.major++
    else if (severity === "warning") site.warning++
    else site.other++

    if (!site.types[type]) {
      site.types[type] = true
      site.typeCount++
    }

    const rank = severityRank(severity)
    if (rank > site.worstRank) {
      site.worstRank = rank
      site.worstSeverity = severity
    }

    if (!isNaN(millis) && millis > site.latestMillis) {
      site.latestMillis = millis
      site.latestText = pick(alarm, ["lastAlarmText", "specific-problem"], type)
    }
  })

  return sites
}

/**
 * Builds the table rows and the fleet-level variables.
 * @param {Object} sites map of site name to aggregate
 * @param {number} alarmTotal total alarms processed
 * @returns {Array<Object>} the Domotz variables to report alongside the table
 */
function buildOutput(sites, alarmTotal) {
  const names = Object.keys(sites).sort()
  let critical = 0
  let major = 0
  let warning = 0
  let sitesWithAlarms = 0
  let sitesClean = 0
  let sitesOutsideInventory = 0

  names.forEach(function (name) {
    const site = sites[name]
    critical += site.critical
    major += site.major
    warning += site.warning
    if (site.total > 0) sitesWithAlarms++
    else sitesClean++
    if (!site.inInventory) sitesOutsideInventory++

    const typeList = Object.keys(site.types).sort()

    sitesTable.insertRecord(sanitize(name), [
      site.total,
      site.critical,
      site.major,
      site.warning,
      site.other,
      site.typeCount,
      typeList.length ? truncate(typeList.join(", "), MAX_TYPES_TEXT) : "None",
      site.worstSeverity || "None",
      formatTimestamp(site.latestMillis) || "N/A",
      site.latestText ? truncate(site.latestText, MAX_ALARM_TEXT) : "N/A",
      site.inInventory ? "Inventory" : "Alarm feed only"
    ])
  })

  console.log("Reported " + names.length + " sites: " + sitesWithAlarms + " with alarms, " +
    sitesClean + " clean.")
  if (sitesOutsideInventory > 0) {
    console.log(sitesOutsideInventory + " device(s) raised alarms but are absent from the tenant " +
      "appliance inventory, and are marked \"Alarm feed only\" in the Source column.")
  }

  return [
    D.createVariable("total-alarms", "Total Active Alarms", alarmTotal, null, D.valueType.NUMBER),
    D.createVariable("critical-alarms", "Critical Alarms", critical, null, D.valueType.NUMBER),
    D.createVariable("major-alarms", "Major Alarms", major, null, D.valueType.NUMBER),
    D.createVariable("warning-alarms", "Warning Alarms", warning, null, D.valueType.NUMBER),
    D.createVariable("sites-with-alarms", "Sites With Alarms", sitesWithAlarms, null, D.valueType.NUMBER),
    D.createVariable("sites-clean", "Sites Clean", sitesClean, null, D.valueType.NUMBER)
  ]
}

// ------------------------------------------------------------------------------------------
// Remote procedures
// ------------------------------------------------------------------------------------------

/**
 * @remote_procedure
 * @label Validate Versa Director connection
 * @documentation Confirms that the Director's token endpoint accepts the configured credentials
 * and that the fault alarms endpoint is reachable for this account
 */
function validate() {
  login()
    .then(function () {
      return apiGet(ALARMS_PATH + "?offset=0&limit=1")
    })
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
 * @label Get SD-WAN Alarms
 * @documentation Retrieves active fault alarms and reports them per site, with a severity
 * breakdown, the alarm types present, the worst severity and the most recent alarm text for
 * each, plus fleet-level totals
 */
function get_status() {
  login()
    // The two calls run sequentially rather than in parallel. Versa's own guidance is to keep
    // concurrent monitor API calls low, and two round trips finish well inside the timeout.
    .then(retrieveSites)
    .then(function (siteNames) {
      return retrieveAlarms().then(function (alarms) {
        const sites = aggregateBySite(alarms, siteNames)
        const variables = buildOutput(sites, alarms.length)
        D.success(variables, sitesTable)
      })
    })
    .catch(function (error) {
      console.log("Failed to retrieve alarms: " + error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}
