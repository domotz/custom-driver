/**
 * Domotz Custom Driver
 * Name: Versa Director - SD-WAN SLA
 * Description: Reports SD-WAN SLA health: fabric-wide monitored-path counts, plus per-site
 *              latency, jitter and packet loss for a bounded set of sites.
 *
 * Communication protocol: HTTPS (Versa Director northbound REST API)
 *
 * Tested on: Versa Director 22.1.4-GA
 *
 * ---------------------------------------------------------------------------------------------
 * WHAT THE YANG TREE ACTUALLY EXPOSES, AND WHY THIS DRIVER IS SHAPED THIS WAY
 * ---------------------------------------------------------------------------------------------
 * The governing rule of the live-command gateway is that the Director expands EXACTLY ONE LEVEL
 * below the node you name. Naming a list returns that list's own leaves; naming a specific key
 * within the list expands that entry instead. Every finding below follows from it.
 *
 * Probing sd-wan/sla-monitor on 22.1.4-GA established:
 *
 *   brief                          one aggregate record: up-path-cnt, down-path-cnt,
 *                                  suspend-path-cnt, active-path-cnt. No site, no metrics.
 *   end-to-end                     45 records of { site-name } only - an INDEX of sites.
 *   end-to-end/status              the same index, 45 x { site-name }.
 *   end-to-end/status/{siteName}   an OBJECT under the key "sdwan:status" containing ONLY
 *                                  { site-name }. Keying the list does not reveal metrics.
 *   sla-monitor/path               HTTP 204: the node is valid but returns no content.
 *   end-to-end/detail,
 *   sla-monitor/detail,
 *   statistics/sla                 "invalid path" - these nodes do not exist.
 *   sd-wan/site                    index-only, { name }.
 *
 * Every one of those nodes was probed against a live fabric carrying 114 active paths, so the
 * emptiness is the API's shape, not a quiet fabric. There is no per-path SLA metric anywhere
 * under sla-monitor on this release - not in bulk, and not per site.
 *
 * The driver therefore does two different things at two different costs:
 *
 *   ALWAYS   one call for the fabric-wide counts. This is the fleet-level SLA signal, it is cheap,
 *            and "paths down" is directly alertable on its own.
 *   OPT-IN   a walk of at most maxSlaSites sites for per-site detail, DISABLED by default. On
 *            22.1.4-GA end-to-end/status/{siteName} returns { site-name } and nothing else, so
 *            the walk costs one request per site and yields no metrics. The machinery is kept
 *            because another release may populate that node; set maxSlaSites or slaSites to
 *            re-test. See "WHERE THE METRICS ACTUALLY LIVE" below.
 *
 * Extraction accepts both arrays and single objects, because the per-site node returns an object
 * while every other node in this API returns an array. An earlier revision looked only for arrays
 * and silently discarded the one response that had the data in it.
 *
 * ---------------------------------------------------------------------------------------------
 * WHERE THE METRICS ACTUALLY LIVE
 * ---------------------------------------------------------------------------------------------
 * Per-path latency, jitter and loss are NOT exposed by the Director API on this release. Every
 * node under sla-monitor has been probed and each returns either an aggregate or a bare index.
 * That is not a gap in this driver; it is the shape of the API.
 *
 * Those metrics are held by Versa ANALYTICS, which is a separate system with its own REST API:
 *   https://<analytics-host>/versa/analytics/v1.0.0/data/provider/tenants/{tenant}/features/SDWAN/
 * It accepts the SAME OAuth bearer token issued by Director, so the authentication in this driver
 * transfers directly - only the host and the query grammar differ. Versa's own guidance for
 * external monitoring is to take SLA and event data from Analytics rather than polling Director.
 *
 * A driver against Analytics is therefore the correct home for per-path SLA metrics, and needs
 * the Analytics host to be reachable from the Domotz collector.
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
 *   sourceAppliance  STRING       Hub to query. Optional; blank auto-selects an appliance whose
 *                                 name contains "HUB".
 *   slaSites         STRING       Comma-separated site names to collect detail for. Optional.
 *                                 Blank walks the first maxSlaSites sites from the index.
 *   maxSlaSites      STRING       Cap on sites walked per run. Optional, defaults to 0, which
 *                                 DISABLES the walk. On 22.1.4-GA the per-site node carries no
 *                                 metrics, so the walk costs one request per site and returns
 *                                 nothing. Raise it only to re-test on another release, or set
 *                                 slaSites, which overrides the disable.
 *
 * Username and password come from the device's stored credentials, NOT from parameters, so the
 * Director password is never held in the driver definition. That remains true when directorHost
 * is set: only the destination host changes, never where the credentials come from.
 *
 * Undeclared optional parameters are harmless: the sandbox logs "Missing parameter name" and
 * returns undefined, which selects the default.
 *
 * ---------------------------------------------------------------------------------------------
 * OUTPUT
 * ---------------------------------------------------------------------------------------------
 * Variables: Paths Up / Down / Suspended / Active (whole fabric), Sites Sampled, Sites Available,
 * Worst Latency, Worst Loss, Source Appliance.
 * Table "SD-WAN SLA": Site, Local Circuit, Remote Circuit, Latency, Forward/Reverse Jitter,
 * Forward/Reverse Loss.
 **/

const DEFAULT_PORT = "9183";
const DEFAULT_MAX_SLA_SITES = 0;
const SITE_PAGE_SIZE = 1000;
const TOKEN_PATH = "/auth/token";
const INVENTORY_PATH = "/vnms/appliance/appliance";

/** Fabric-wide path counts. One record, no per-site detail. */
const SLA_SUMMARY_PATH = "/sd-wan/sla-monitor/brief";

/** Index of monitored sites: 45 records of { site-name }. Used as the list of sites to walk. */
const SLA_INDEX_PATH = "/sd-wan/sla-monitor/end-to-end";

/** Per-site detail. {site} is replaced with a site name to expand that entry. */
const SLA_SITE_PATH = "/sd-wan/sla-monitor/end-to-end/status/{site}";

/**
 * Bulk candidates, tried once before the per-site walk. Everything else has been eliminated on
 * 22.1.4-GA. sla-monitor/path answered HTTP 204 - valid node, no content - so it is retained in
 * case it carries data on another deployment; if it ever does, the walk is skipped entirely.
 */
const SLA_BULK_PATHS = [
    "/sd-wan/sla-monitor/path"
];

/** Keys that mark a record as describing a site or path rather than an aggregate. */
const PATH_IDENTITY_KEYS = [
    "remote-site-name", "site-name", "siteName", "remote-site",
    "local-access-cktname", "remote-access-cktname", "local-ackt-name", "remote-ackt-name"
];

const clientIdParam = D.getParameter("clientId");
const clientSecretParam = D.getParameter("clientSecret");
const authPortParam = D.getParameter("authPort");
const apiPortParam = D.getParameter("apiPort");
const directorHostParam = D.getParameter("directorHost");
const sourceApplianceParam = D.getParameter("sourceAppliance");
const slaSitesParam = D.getParameter("slaSites");
const maxSlaSitesParam = D.getParameter("maxSlaSites");

const authPortValue = parseInt(authPortParam || DEFAULT_PORT, 10);
const apiPortValue = parseInt(apiPortParam || DEFAULT_PORT, 10);
const maxSlaSitesValue = maxSlaSitesParam ? parseInt(maxSlaSitesParam, 10) : DEFAULT_MAX_SLA_SITES;

/**
 * Reduces whatever was entered for directorHost to a bare hostname. People reasonably paste a
 * whole URL copied from a browser or a vendor document, so the scheme, any path and any port are
 * stripped rather than rejected. The port is deliberately NOT taken from here: authPort and
 * apiPort remain the single source of truth, because the token endpoint and the API can differ.
 * @param {string} raw the configured value
 * @returns {string|null} a bare hostname, or null when nothing usable was given
 */
function normalizeHost(raw) {
    if (!raw) return null;
    let host = String(raw).trim();
    host = host.replace(/^[a-zA-Z][a-zA-Z0-9+.\-]*:\/\//, "");
    host = host.split("/")[0].split("?")[0];
    // Leave an IPv6 literal in brackets alone; otherwise strip a trailing :port.
    if (host.charAt(0) !== "[") host = host.split(":")[0];
    host = host.trim();
    return host.length > 0 ? host : null;
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
const resolvedHost = normalizeHost(directorHostParam);
const target = resolvedHost ? D.createExternalDevice(resolvedHost) : D.device;

let accessToken;
let authenticatedOrg;
let loggedSampleRecord = false;

const slaTable = D.createTable(
    "SD-WAN SLA",
    [
        { label: "Site", valueType: D.valueType.STRING },
        { label: "Local Circuit", valueType: D.valueType.STRING },
        { label: "Remote Circuit", valueType: D.valueType.STRING },
        { label: "Latency", unit: "ms", valueType: D.valueType.NUMBER },
        { label: "Forward Jitter", unit: "ms", valueType: D.valueType.NUMBER },
        { label: "Reverse Jitter", unit: "ms", valueType: D.valueType.NUMBER },
        { label: "Forward Loss", unit: "%", valueType: D.valueType.NUMBER },
        { label: "Reverse Loss", unit: "%", valueType: D.valueType.NUMBER }
    ]
);

// ------------------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------------------

/**
 * Returns the first defined, non-empty value found in an object for a list of candidate keys.
 * The explicit comparisons matter: a truthiness test would discard a legitimate zero, and zero
 * latency or zero loss is exactly the healthy reading this driver should report.
 * @param {Object} source object to read from
 * @param {Array<string>} keys candidate key names, checked in order
 * @param {*} fallback returned when no key yields a usable value
 * @returns {*} the resolved value, or the fallback
 */
function pick(source, keys, fallback) {
    if (!source) return fallback;
    for (let i = 0; i < keys.length; i++) {
        const value = source[keys[i]];
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return fallback;
}

/**
 * Coerces a value to a finite number. Versa returns metrics as strings.
 * @param {*} value the raw value
 * @returns {number|null} the parsed number, or null
 */
function toNumber(value) {
    if (value === undefined || value === null || value === "") return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
}

/**
 * Produces a short, stable hash, used to keep record ids unique when the natural key is too long.
 * @param {string} value the string to hash
 * @returns {string} a short base-36 hash
 */
function shortHash(value) {
    let hash = 5381;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash * 33) ^ value.charCodeAt(i)) >>> 0;
    }
    return hash.toString(36);
}

/**
 * Builds a record id that is unique and stable across runs. Domotz keys history on the record id,
 * so it must not depend on row order, and a duplicate aborts the run.
 * @param {Array<string>} parts the components of the natural key
 * @returns {string} a safe, unique, stable record id
 */
function slaRecordId(parts) {
    const full = parts.join("-").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
    if (full.length <= 50) return full;
    return full.slice(0, 42) + "-" + shortHash(full);
}

/**
 * Recursively locates the first array of objects within a parsed response.
 * @param {*} node value to inspect
 * @param {number} depth current recursion depth
 * @returns {Array<Object>|null} the first array of objects found, or null
 */
function findFirstObjectArray(node, depth) {
    if (!node || depth > 5) return null;
    if (Array.isArray(node)) {
        return (node.length > 0 && typeof node[0] === "object" && node[0] !== null) ? node : null;
    }
    if (typeof node !== "object") return null;
    const keys = Object.keys(node);
    for (let i = 0; i < keys.length; i++) {
        const found = findFirstObjectArray(node[keys[i]], depth + 1);
        if (found) return found;
    }
    return null;
}

/**
 * Normalizes a live-command response into a list of records, accepting BOTH shapes this API uses.
 * Most nodes return an array; the per-site SLA node returns a single object under a namespaced
 * key such as "sdwan:status". Handling only arrays silently discards the latter.
 * @param {Object} payload the parsed response
 * @returns {Array<Object>} the records found, possibly empty
 */
function extractRecords(payload) {
    if (!payload || typeof payload !== "object") return [];
    if (Array.isArray(payload)) return payload;

    const asArray = findFirstObjectArray(payload, 0);
    if (asArray) return asArray;

    // No array anywhere: unwrap one namespaced container and treat the object as a single record.
    const keys = Object.keys(payload);
    if (keys.length === 1) {
        const inner = payload[keys[0]];
        if (inner && typeof inner === "object" && !Array.isArray(inner)) {
            const innerArray = findFirstObjectArray(inner, 0);
            if (innerArray) return innerArray;
            return Object.keys(inner).length > 0 ? [inner] : [];
        }
    }
    return Object.keys(payload).length > 0 ? [payload] : [];
}

/**
 * Decides whether a record carries usable detail rather than being an aggregate or a bare index
 * entry such as { "site-name": "..." }, which would produce a named row with every metric empty.
 * @param {Object} record the record to inspect
 * @returns {boolean} true when the record looks like per-path detail
 */
function looksLikePathRecord(record) {
    if (!record) return false;
    let hasIdentity = false;
    for (let i = 0; i < PATH_IDENTITY_KEYS.length; i++) {
        if (record[PATH_IDENTITY_KEYS[i]] !== undefined) {
            hasIdentity = true;
            break;
        }
    }
    if (!hasIdentity) return false;
    return Object.keys(record).length > 1;
}

/**
 * Maps an HTTP status code to the matching Domotz error type.
 * @param {number} statusCode the HTTP status code
 * @returns {string} a D.errorType constant
 */
function errorTypeForStatus(statusCode) {
    if (statusCode === 401 || statusCode === 403) return D.errorType.AUTHENTICATION_ERROR;
    if (statusCode === 404) return D.errorType.RESOURCE_UNAVAILABLE;
    return D.errorType.GENERIC_ERROR;
}

// ------------------------------------------------------------------------------------------
// Versa Director API
// ------------------------------------------------------------------------------------------

/**
 * Authenticates and stores the bearer token and the authenticated organization, which forms part
 * of every YANG path used here.
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
    };
    console.log("Authenticating against " + (resolvedHost || D.device.ip()) + ":" + authPortValue +
    (resolvedHost ? " (directorHost)" : " (device IP)"));
    return new Promise(function (resolve) {
        target.http.post(config, function (error, response, body) {
            if (error) {
                console.log("Token request failed: " + error);
                D.failure(D.errorType.GENERIC_ERROR);
                return;
            }
            const statusCode = response && response.statusCode;
            if (statusCode !== 200) {
                console.log("Token endpoint returned HTTP " + statusCode + ": " +
          (body ? String(body).slice(0, 500) : "<empty response>"));
                D.failure(errorTypeForStatus(statusCode));
                return;
            }
            let payload;
            try {
                payload = JSON.parse(body);
            } catch (parseError) {
                console.log("Token response was not valid JSON: " + parseError);
                D.failure(D.errorType.PARSING_ERROR);
                return;
            }
            const token = (payload.tokenDetails && payload.tokenDetails.accessToken) || payload.access_token;
            if (!token) {
                console.log("No access token in the response. Keys returned: " +
          Object.keys(payload).join(", "));
                D.failure(D.errorType.AUTHENTICATION_ERROR);
                return;
            }
            accessToken = token;
            authenticatedOrg = (payload.user && payload.user.organization) || null;
            if (!authenticatedOrg) {
                console.log("The token response did not name an organization, which the YANG path requires.");
                D.failure(D.errorType.AUTHENTICATION_ERROR);
                return;
            }
            resolve();
        });
    });
}

/**
 * Performs an authenticated GET, failing the run on error.
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
    };
    return new Promise(function (resolve) {
        target.http.get(config, function (error, response, body) {
            if (error) {
                console.log("Request to " + path + " failed: " + error);
                D.failure(D.errorType.GENERIC_ERROR);
                return;
            }
            const statusCode = response && response.statusCode;
            if (statusCode !== 200) {
                console.log("GET " + path + " returned HTTP " + statusCode + ": " +
          (body ? String(body).slice(0, 500) : "<empty response>"));
                D.failure(errorTypeForStatus(statusCode));
                return;
            }
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (parseError) {
                console.log("Response from " + path + " was not valid JSON: " + parseError);
                D.failure(D.errorType.PARSING_ERROR);
            }
        });
    });
}

/**
 * Performs an authenticated GET that never fails the run, so an uncertain node can be probed.
 * @param {string} path URL path, including any query string
 * @returns {Promise<Object>} resolves with { statusCode, json, body }
 */
function apiGetSoft(path) {
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
    };
    return new Promise(function (resolve) {
        target.http.get(config, function (error, response, body) {
            if (error) {
                resolve({ statusCode: 0, json: null, body: String(error) });
                return;
            }
            let parsed = null;
            try {
                parsed = body ? JSON.parse(body) : null;
            } catch (parseError) {
                parsed = null;
            }
            resolve({ statusCode: response && response.statusCode, json: parsed, body: body });
        });
    });
}

/**
 * Builds the live-command URL for a YANG path on the chosen appliance.
 * @param {Object} source the appliance, as { name, uuid }
 * @param {string} yangSuffix the path below orgs/org/{organization}
 * @returns {string} the request path
 */
function liveCommandUrl(source, yangSuffix) {
    return "/vnms/dashboard/appliance/" + encodeURIComponent(source.name) +
    "/live?uuid=" + encodeURIComponent(source.uuid) +
    "&command=orgs/org/" + authenticatedOrg + yangSuffix;
}

/**
 * Chooses the appliance to query, preferring a hub because only a hub sees paths to every site.
 * @returns {Promise<Object>} resolves with { name, uuid }
 */
function selectSourceAppliance() {
    return apiGet(INVENTORY_PATH + "?offset=0&limit=" + SITE_PAGE_SIZE).then(function (payload) {
        const container = payload["versanms.ApplianceStatusResult"];
        const list = (container && Array.isArray(container.appliance))
            ? container.appliance
            : (findFirstObjectArray(payload, 0) || []);

        if (list.length === 0) {
            console.log("The appliance inventory returned no appliances, so no source can be chosen.");
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            return null;
        }

        let chosen = null;
        if (sourceApplianceParam) {
            for (let i = 0; i < list.length; i++) {
                if (String(list[i].name).toLowerCase() === String(sourceApplianceParam).toLowerCase()) {
                    chosen = list[i];
                    break;
                }
            }
            if (!chosen) {
                console.log("The configured sourceAppliance \"" + sourceApplianceParam + "\" is not in " +
          "the inventory. Falling back to auto-selection.");
            }
        }
        if (!chosen) {
            for (let i = 0; i < list.length; i++) {
                if (String(list[i].name).toUpperCase().indexOf("HUB") !== -1) {
                    chosen = list[i];
                    break;
                }
            }
        }
        if (!chosen) {
            chosen = list[0];
            console.log("No appliance with \"HUB\" in its name was found, so the first appliance is used.");
        }

        console.log("Querying SLA from appliance \"" + chosen.name + "\".");
        return { name: chosen.name, uuid: chosen.uuid };
    });
}

/**
 * Reads the fabric-wide SLA path counts. Never fatal - the detail walk is independent.
 * @param {Object} source the appliance to query
 * @returns {Promise<Object>} resolves with { up, down, suspended, active }
 */
function retrieveSummary(source) {
    return apiGetSoft(liveCommandUrl(source, SLA_SUMMARY_PATH)).then(function (result) {
        const empty = { up: null, down: null, suspended: null, active: null };
        if (result.statusCode !== 200 || !result.json) {
            console.log("SLA summary unavailable: HTTP " + result.statusCode);
            return empty;
        }
        const records = extractRecords(result.json);
        const record = records.length > 0 ? records[0] : result.json;
        const summary = {
            up: toNumber(pick(record, ["up-path-cnt", "upPathCnt"], null)),
            down: toNumber(pick(record, ["down-path-cnt", "downPathCnt"], null)),
            suspended: toNumber(pick(record, ["suspend-path-cnt", "suspendPathCnt"], null)),
            active: toNumber(pick(record, ["active-path-cnt", "activePathCnt"], null))
        };
        console.log("SLA path counts - up: " + summary.up + ", down: " + summary.down +
      ", suspended: " + summary.suspended + ", active: " + summary.active);
        return summary;
    });
}

/**
 * Tries the remaining bulk candidates. Returns per-path records if one ever yields them, which
 * would make the per-site walk unnecessary.
 * @param {Object} source the appliance to query
 * @param {number} index index into SLA_BULK_PATHS
 * @returns {Promise<Array<Object>>} resolves with { site, record } entries, or an empty array
 */
function tryBulkPaths(source, index) {
    if (index >= SLA_BULK_PATHS.length) return Promise.resolve([]);

    const yangSuffix = SLA_BULK_PATHS[index];
    return apiGetSoft(liveCommandUrl(source, yangSuffix)).then(function (result) {
        if (result.statusCode !== 200 || !result.json) {
            console.log("Bulk SLA candidate unavailable: " + yangSuffix + " -> HTTP " + result.statusCode);
            return tryBulkPaths(source, index + 1);
        }
        const records = extractRecords(result.json);
        if (records.length === 0 || !looksLikePathRecord(records[0])) {
            console.log("Bulk SLA candidate carried no per-path detail: " + yangSuffix +
        " -> " + records.length + " records, fields: " +
        (records.length > 0 ? Object.keys(records[0]).join(", ") : "<none>"));
            return tryBulkPaths(source, index + 1);
        }
        console.log("Bulk SLA path ACCEPTED: " + yangSuffix + " -> " + records.length + " records. " +
      "The per-site walk is unnecessary on this deployment.");
        console.log("SLA record fields: " + Object.keys(records[0]).join(", "));
        return records.map(function (record) {
            return { site: pick(record, PATH_IDENTITY_KEYS, "unknown"), record: record };
        });
    });
}

/**
 * Reads the index of monitored sites.
 * @param {Object} source the appliance to query
 * @returns {Promise<Array<string>>} resolves with site names
 */
function retrieveSiteIndex(source) {
    return apiGetSoft(liveCommandUrl(source, SLA_INDEX_PATH)).then(function (result) {
        if (result.statusCode !== 200 || !result.json) {
            console.log("SLA site index unavailable: HTTP " + result.statusCode);
            return [];
        }
        const names = extractRecords(result.json).map(function (record) {
            return pick(record, ["site-name", "siteName", "name"], null);
        }).filter(function (name) {
            return !!name;
        });
        console.log("SLA monitors " + names.length + " sites.");
        return names;
    });
}

/**
 * Chooses which sites to collect detail for: the configured list if given, otherwise the first
 * maxSlaSites from the index. The cap exists because each site costs one round trip.
 * @param {Array<string>} available site names from the index
 * @returns {Array<string>} the sites to walk
 */
function selectSites(available) {
    if (maxSlaSitesValue <= 0 && !slaSitesParam) {
        console.log("Per-site SLA detail is disabled (maxSlaSites is 0). On Versa Director 22.1.4-GA " +
      "the per-site node returns only { site-name } with no metrics, so walking sites costs one " +
      "request each and returns nothing. The fabric-wide path counts above are the SLA signal " +
      "this API provides. Set maxSlaSites above zero only to re-test on another release.");
        return [];
    }
    if (slaSitesParam) {
        const requested = String(slaSitesParam).split(",").map(function (name) {
            return name.trim();
        }).filter(function (name) {
            return name.length > 0;
        });
        const matched = requested.filter(function (name) {
            for (let i = 0; i < available.length; i++) {
                if (available[i].toLowerCase() === name.toLowerCase()) return true;
            }
            return false;
        });
        const missing = requested.length - matched.length;
        if (missing > 0) {
            console.log(missing + " configured site name(s) are not in the SLA index and were skipped.");
        }
        if (matched.length > 0) return matched.slice(0, Math.max(maxSlaSitesValue, matched.length));
        console.log("No configured site matched the index; falling back to the first sites listed.");
    }
    if (available.length > maxSlaSitesValue) {
        console.log("Collecting detail for the first " + maxSlaSitesValue + " of " + available.length +
      " sites. Each site costs one request, so raise maxSlaSites deliberately, or set slaSites " +
      "to name the sites that matter.");
    }
    return available.slice(0, maxSlaSitesValue);
}

/**
 * Reads per-site SLA detail for one site.
 * @param {Object} source the appliance to query
 * @param {string} siteName the site to expand
 * @returns {Promise<Array<Object>>} resolves with { site, record } entries for that site
 */
function retrieveSiteDetail(source, siteName) {
    const yangSuffix = SLA_SITE_PATH.replace("{site}", encodeURIComponent(siteName));
    return apiGetSoft(liveCommandUrl(source, yangSuffix)).then(function (result) {
        if (result.statusCode !== 200 || !result.json) {
            console.log("No SLA detail for " + siteName + ": HTTP " + result.statusCode);
            return [];
        }
        const records = extractRecords(result.json);
        if (records.length === 0) {
            console.log("Empty SLA detail for " + siteName + " -> " +
        String(result.body).replace(/\s+/g, " ").slice(0, 300));
            return [];
        }
        // Log one complete record per run so the field mapping can be verified against reality.
        if (!loggedSampleRecord) {
            loggedSampleRecord = true;
            console.log("SLA detail fields for " + siteName + ": " + Object.keys(records[0]).join(", "));
            console.log("First raw SLA record: " + JSON.stringify(records[0]).slice(0, 1500));
        }
        return records.map(function (record) {
            return { site: siteName, record: record };
        });
    });
}

/**
 * Walks the selected sites one at a time. Sequential rather than parallel: Versa's guidance is to
 * keep concurrent monitor calls low, and the cap already bounds total runtime.
 * @param {Object} source the appliance to query
 * @param {Array<string>} siteNames the sites to walk
 * @returns {Promise<Array<Object>>} resolves with all { site, record } entries
 */
function walkSites(source, siteNames) {
    const collected = [];
    return siteNames.reduce(function (chain, siteName) {
        return chain.then(function () {
            return retrieveSiteDetail(source, siteName).then(function (entries) {
                entries.forEach(function (entry) {
                    collected.push(entry);
                });
            });
        });
    }, Promise.resolve()).then(function () {
        return collected;
    });
}

/**
 * Builds the table rows and the variables.
 * @param {Array<Object>} entries { site, record } pairs
 * @param {Object} summary the fabric-wide path counts
 * @param {number} sitesAvailable how many sites the index listed
 * @param {number} sitesSampled how many sites were actually walked
 * @param {Object} source the appliance the data was read from
 * @returns {Array<Object>} the Domotz variables to report alongside the table
 */
function buildOutput(entries, summary, sitesAvailable, sitesSampled, source) {
    const usedIds = {};
    let rowCount = 0;
    let worstLatency = null;
    let worstLoss = null;
    let recognisedMetrics = false;

    entries.forEach(function (entry) {
        const record = entry.record;
        const site = String(pick(record,
            ["remote-site-name", "site-name", "siteName", "remote-site"], entry.site));
        const localCircuit = String(pick(record,
            ["local-access-cktname", "local-ackt-name", "local-circuit", "localCircuit"], "N/A"));
        const remoteCircuit = String(pick(record,
            ["remote-access-cktname", "remote-ackt-name", "remote-circuit", "remoteCircuit"], "N/A"));

        // Versa names these differently across releases; every known spelling is listed.
        const latency = toNumber(pick(record,
            ["delay", "latency", "two-way-delay", "rtt", "avg-delay", "latency-ms"], null));
        const forwardJitter = toNumber(pick(record,
            ["fwd-delay-var", "forward-jitter", "jitter", "delay-variation", "fwd-jitter"], null));
        const reverseJitter = toNumber(pick(record,
            ["rev-delay-var", "reverse-jitter", "rev-jitter"], null));
        const forwardLoss = toNumber(pick(record,
            ["fwd-loss-ratio", "forward-loss", "loss-ratio", "packet-loss", "loss", "pdu-loss-ratio"], null));
        const reverseLoss = toNumber(pick(record,
            ["rev-loss-ratio", "reverse-loss"], null));

        if (latency !== null || forwardLoss !== null || reverseLoss !== null) recognisedMetrics = true;
        if (latency !== null && (worstLatency === null || latency > worstLatency)) worstLatency = latency;
        // the worse of the two directions
        const loss = forwardLoss !== null && reverseLoss !== null ? Math.max(forwardLoss, reverseLoss) : (forwardLoss !== null ? forwardLoss : reverseLoss);
        if (loss !== null && (worstLoss === null || loss > worstLoss)) worstLoss = loss;

        let recordId = slaRecordId([site, localCircuit, remoteCircuit]);
        if (usedIds[recordId]) {
            usedIds[recordId]++;
            recordId = recordId.slice(0, 47) + "-" + usedIds[recordId];
        } else {
            usedIds[recordId] = 1;
        }

        rowCount++;
        slaTable.insertRecord(recordId, [
            site,
            localCircuit,
            remoteCircuit,
            latency,
            forwardJitter,
            reverseJitter,
            forwardLoss,
            reverseLoss
        ]);
    });

    console.log("Reported " + rowCount + " SLA rows from " + sitesSampled + " of " +
    sitesAvailable + " monitored sites.");
    if (rowCount > 0 && !recognisedMetrics) {
        console.log("Rows were returned but no latency or loss field was recognised. Compare the " +
      "\"SLA detail fields\" line above with the candidate names in buildOutput and extend them.");
    }

    return [
    // Fabric-wide counts cover every path regardless of how many sites were sampled, so these
    // stay meaningful even with the walk disabled. "Paths Down" is the headline alertable number.
        D.createVariable("paths-up", "Paths Up", summary.up, null, D.valueType.NUMBER),
        D.createVariable("paths-down", "Paths Down", summary.down, null, D.valueType.NUMBER),
        D.createVariable("paths-suspended", "Paths Suspended", summary.suspended, null, D.valueType.NUMBER),
        D.createVariable("paths-active", "Paths Active", summary.active, null, D.valueType.NUMBER),
        D.createVariable("sites-sampled", "Sites Sampled", sitesSampled, null, D.valueType.NUMBER),
        D.createVariable("sites-available", "Sites Monitored", sitesAvailable, null, D.valueType.NUMBER),
        D.createVariable("worst-latency", "Worst Latency", worstLatency, "ms", D.valueType.NUMBER),
        D.createVariable("worst-loss", "Worst Loss", worstLoss, "%", D.valueType.NUMBER),
        D.createVariable("source-appliance", "Source Appliance", source.name, null, D.valueType.STRING)
    ];
}

// ------------------------------------------------------------------------------------------
// Remote procedures
// ------------------------------------------------------------------------------------------

/**
 * @remote_procedure
 * @label Validate Versa Director connection
 * @documentation Confirms the credentials are accepted and a source appliance can be selected.
 * SLA detail is not required to pass, because the fabric-wide counts are useful on their own
 */
function validate() {
    login()
        .then(selectSourceAppliance)
        .then(function () {
            D.success();
        })
        .catch(function (error) {
            console.log("Validation failed: " + error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get SD-WAN SLA
 * @documentation Reports fabric-wide SLA path counts, plus per-site latency, jitter and packet
 * loss for a bounded set of sites when the Director release exposes them
 */
function get_status() {
    login()
        .then(selectSourceAppliance)
        .then(function (source) {
            return retrieveSummary(source).then(function (summary) {
                return tryBulkPaths(source, 0).then(function (bulkEntries) {
                    if (bulkEntries.length > 0) {
                        const variables = buildOutput(bulkEntries, summary, bulkEntries.length,
                            bulkEntries.length, source);
                        D.success(variables, slaTable);
                        return;
                    }
                    return retrieveSiteIndex(source).then(function (available) {
                        const chosen = selectSites(available);
                        return walkSites(source, chosen).then(function (entries) {
                            const variables = buildOutput(entries, summary, available.length, chosen.length,
                                source);
                            D.success(variables, slaTable);
                        });
                    });
                });
            });
        })
        .catch(function (error) {
            console.log("Failed to retrieve SLA metrics: " + error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
