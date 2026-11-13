/**
 * Domotz Custom Driver
 * Name: Versa Director - SD-WAN Health
 * Description: Retrieves the SD-WAN appliance fleet from a Versa Director and surfaces every
 *              field the Director reports for each appliance: status, template drift, HA state,
 *              software and hardware identity, resources, uptime and location.
 *
 * Communication protocol: HTTPS (Versa Director northbound REST API)
 *
 * Tested on: Versa Director 22.1.4-GA
 *
 * ---------------------------------------------------------------------------------------------
 * REQUIREMENTS
 * ---------------------------------------------------------------------------------------------
 * 1. A Versa Director user account. A tenant-scoped role (e.g. TenantOperator) is sufficient -
 *    this driver deliberately uses only tenant-visible API paths and never provider-level
 *    (/api/config/nms/provider/*) endpoints, which require a provider account.
 * 2. An OAuth client (Client ID + Client Secret) registered on the Director.
 * 3. The Domotz device must be the Versa Director itself, with the Director account stored in
 *    the device's Custom Driver Management credentials (username + password).
 * 4. Network reachability from the Domotz collector to the Director on the auth and API ports
 *    (default 9183 for both). Verify with Domotz TCP Monitoring before troubleshooting the code -
 *    a blocked port surfaces as a connect timeout, not an authentication error.
 *
 * ---------------------------------------------------------------------------------------------
 * DRIVER PARAMETERS (declared in the Domotz UI - they cannot be created from code)
 * ---------------------------------------------------------------------------------------------
 *   clientId      SECRET_TEXT  OAuth client ID registered on the Director.        Required.
 *   clientSecret  SECRET_TEXT  OAuth client secret.                               Required.
 *   authPort      STRING       Port for the token endpoint.       Optional, defaults to 9183.
 *   apiPort       STRING       Port for the REST API.             Optional, defaults to 9183.
 *   directorHost  STRING       FQDN of the Director, e.g. director.example.com.   Optional.
 *                              Blank keeps the previous behaviour: requests go to the IP address
 *                              of the Domotz device this driver is attached to. Set it when the
 *                              Director must be addressed by name - because a load balancer or
 *                              reverse proxy routes on SNI or the Host header, because the
 *                              certificate is issued to the hostname, or because policy requires
 *                              it. A full URL is accepted and reduced to the bare host, so
 *                              https://director.example.com:9183/auth/token works too; ports
 *                              still come from authPort and apiPort.
 *   maxAppliances STRING       Page size for the inventory call.  Optional, defaults to 100.
 *                              Set this above your total appliance count - appliances beyond
 *                              this limit are not returned by the Director and a warning is
 *                              logged when the response fills the page.
 *
 * Username and password come from the device's stored credentials, NOT from parameters, so the
 * Director password is never held in the driver definition. That remains true when directorHost
 * is set: only the destination host changes, never where the credentials come from.
 *
 * ---------------------------------------------------------------------------------------------
 * NOTES AND DELIBERATE DESIGN DECISIONS
 * ---------------------------------------------------------------------------------------------
 * - TLS verification is disabled (rejectUnauthorized: false) because Versa Directors are
 *   commonly deployed with self-signed or internal-CA certificates. If your Director presents a
 *   certificate the collector trusts, set directorHost to the name on that certificate and
 *   remove that flag from both request configs to restore full verification. Verification cannot
 *   succeed against a bare IP unless the certificate carries an IP SAN, which is why addressing
 *   the Director by name is a precondition for turning it back on.
 * - The token endpoint returns a FLAT payload ({ access_token, token_type, expires_in, ... }).
 *   Some Versa documentation describes a nested { tokenDetails: { accessToken } } shape, so both
 *   are accepted.
 * - Inventory comes from GET /vnms/appliance/appliance, which returns the list nested under the
 *   dotted key "versanms.ApplianceStatusResult". Note that /api/config/devices/device is
 *   deprecated on current Director releases and returns HTTP 500.
 * - get_status() performs exactly ONE API call for the entire fleet. Versa also exposes
 *   per-appliance live-status endpoints via /vnms/dashboard/appliance/{name}/live?command=...
 *   (per-circuit latency, jitter, loss, interface and tunnel detail), but those cost one HTTPS
 *   round trip per appliance, which exceeds the Domotz driver execution timeout on any fleet of
 *   meaningful size. Per-appliance detail belongs in a separate driver scoped to key sites.
 * - Every parameter is read explicitly via D.getParameter() into a distinctly named variable.
 *   Do not declare or reference a bare identifier matching a parameter name - the sandbox may or
 *   may not inject one, and depending on that behaviour causes intermittent runtime errors.
 * - Diagnostics use console.log rather than console.error, which is not consistently surfaced in
 *   collector execution logs.
 * - Path Status, Controller and Overall Status are populated by the Director's own monitoring
 *   subsystem. On some deployments they report "Unavailable" / "NOT-APPLICABLE" for every
 *   appliance, which indicates the data is not being collected rather than that the paths are
 *   down. Confirm against the Director UI before building alerts on those columns.
 * - This driver reports every field the inventory response provides. Columns that are not useful
 *   in a given environment can simply be removed from the table definition below.
 * - CPU Cores is frequently absent. Versa reports cpuCores: 0 in the inventory record for virtual
 *   appliances, which means "not reported" rather than zero cores, so it is rendered as an empty
 *   cell. The real core count is only available per appliance through the live-command gateway.
 *
 * ---------------------------------------------------------------------------------------------
 * OUTPUT
 * ---------------------------------------------------------------------------------------------
 * Creates the Custom Driver table "SD-WAN Appliances", one row per appliance, keyed on the
 * appliance name. Columns are grouped as: ownership and role, operational status, software,
 * hardware, resources, location, and lifecycle timestamps. Memory and disk are reported as
 * USED percentages (derived from the free values Versa returns), so a full bar means a problem.
 **/

const DEFAULT_PORT = "9183";
const DEFAULT_PAGE_SIZE = 100;
const INVENTORY_PATH = "/vnms/appliance/appliance";
const TOKEN_PATH = "/auth/token";
const MILLISECONDS_PER_DAY = 86400000;

const clientIdParam = D.getParameter("clientId");
const clientSecretParam = D.getParameter("clientSecret");
const authPortParam = D.getParameter("authPort");
const apiPortParam = D.getParameter("apiPort");
const directorHostParam = D.getParameter("directorHost");
const maxAppliancesParam = D.getParameter("maxAppliances");

const authPortValue = parseInt(authPortParam || DEFAULT_PORT, 10);
const apiPortValue = parseInt(apiPortParam || DEFAULT_PORT, 10);
const pageSize = maxAppliancesParam ? parseInt(maxAppliancesParam, 10) : DEFAULT_PAGE_SIZE;

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

const appliancesTable = D.createTable(
    "SD-WAN Appliances",
    [
    // Ownership and role
        { label: "Organization", valueType: D.valueType.STRING },
        { label: "Org UUID", valueType: D.valueType.STRING },
        { label: "Appliance UUID", valueType: D.valueType.STRING },
        { label: "Type", valueType: D.valueType.STRING },
        { label: "Deployment", valueType: D.valueType.STRING },
        { label: "Connector", valueType: D.valueType.STRING },
        { label: "Connector Type", valueType: D.valueType.STRING },
        { label: "Branch ID", valueType: D.valueType.STRING },
        { label: "CMS Org", valueType: D.valueType.STRING },
        { label: "Services", valueType: D.valueType.STRING },
        { label: "SNG Count", valueType: D.valueType.NUMBER },

        // Operational status
        { label: "Reachability", valueType: D.valueType.STRING },
        { label: "Config Sync", valueType: D.valueType.STRING },
        { label: "Path Status", valueType: D.valueType.STRING },
        { label: "Controller", valueType: D.valueType.STRING },
        { label: "Services Status", valueType: D.valueType.STRING },
        { label: "Overall Status", valueType: D.valueType.STRING },
        { label: "Template", valueType: D.valueType.STRING },
        { label: "YANG Compatibility", valueType: D.valueType.STRING },
        { label: "Inter-Chassis HA", valueType: D.valueType.STRING },
        { label: "Intra-Chassis HA", valueType: D.valueType.STRING },
        { label: "Stolen Suspected", valueType: D.valueType.STRING },

        // Software
        { label: "Software Version", valueType: D.valueType.STRING },
        { label: "Build", valueType: D.valueType.STRING },
        { label: "Firmware Version", valueType: D.valueType.STRING },

        // Hardware identity
        { label: "Model", valueType: D.valueType.STRING },
        { label: "Manufacturer", valueType: D.valueType.STRING },
        { label: "Serial Number", valueType: D.valueType.STRING },
        { label: "Hardware Serial", valueType: D.valueType.STRING },

        // Resources
        { label: "CPU Cores", valueType: D.valueType.NUMBER },
        { label: "Total Memory", unit: "GiB", valueType: D.valueType.NUMBER },
        { label: "Used Memory", unit: "%", valueType: D.valueType.NUMBER },
        { label: "Total Disk", unit: "GiB", valueType: D.valueType.NUMBER },
        { label: "Used Disk", unit: "%", valueType: D.valueType.NUMBER },

        // Location
        { label: "IP Address", valueType: D.valueType.STRING },
        { label: "Location", valueType: D.valueType.STRING },
        { label: "Latitude", valueType: D.valueType.NUMBER },
        { label: "Longitude", valueType: D.valueType.NUMBER },

        // Lifecycle
        { label: "Uptime", unit: "days", valueType: D.valueType.NUMBER },
        { label: "Start Time", valueType: D.valueType.STRING },
        { label: "Last Updated", valueType: D.valueType.STRING },
        { label: "Created At", valueType: D.valueType.STRING }
    ]
);

// ------------------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------------------

/**
 * Returns the first defined, non-empty value found in an object for a list of candidate keys.
 * Versa's JSON mixes kebab-case and camelCase and varies slightly between releases, so field
 * lookups list every known spelling. Note the explicit comparisons: a plain truthiness test
 * would discard legitimate zero values such as sngCount.
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
 * Renders a value as display text, converting booleans to Yes/No and arrays to a joined list.
 * @param {*} value the raw value
 * @param {string} fallback text used when the value is absent
 * @returns {string} display text
 */
function asText(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
    return String(value);
}

/**
 * Reads the "ha-configured" flag out of one of Versa's HA status objects.
 * @param {Object} haStatus the inter- or intra-chassis HA status object
 * @returns {string} "Configured", "Not configured", or "N/A"
 */
function haState(haStatus) {
    if (!haStatus || typeof haStatus !== "object") return "N/A";
    const configured = pick(haStatus, ["ha-configured", "haConfigured"], null);
    if (configured === null) return "N/A";
    return configured ? "Configured" : "Not configured";
}

/**
 * Converts a Versa size string such as "15.43GiB" or "512MiB" to a number of GiB.
 * @param {string} value raw size string
 * @returns {number|null} size in GiB, or null when unparseable
 */
function toGiB(value) {
    if (!value) return null;
    const amount = parseFloat(value);
    if (isNaN(amount)) return null;
    const text = String(value).toLowerCase();
    if (text.indexOf("tib") !== -1) return amount * 1024;
    if (text.indexOf("mib") !== -1) return amount / 1024;
    if (text.indexOf("kib") !== -1) return amount / (1024 * 1024);
    return amount;
}

/**
 * Rounds a number to one decimal place, preserving null.
 * @param {number|null} value the value to round
 * @returns {number|null} the rounded value, or null
 */
function round1(value) {
    return value === null ? null : Math.round(value * 10) / 10;
}

/**
 * Expresses consumed capacity as a percentage of total capacity. Versa reports free space, so
 * this is derived as total minus free. Used percentages are reported rather than free ones
 * because they read correctly on a percentage bar - a full bar means a problem - and because
 * thresholds are conventionally expressed as "alert above 90% used".
 * @param {string} totalRaw total size string
 * @param {string} freeRaw free size string
 * @returns {number|null} used percentage to one decimal place, or null
 */
function usedPercent(totalRaw, freeRaw) {
    const total = toGiB(totalRaw);
    const free = toGiB(freeRaw);
    if (total === null || free === null || total <= 0) return null;
    const used = total - free;
    if (used < 0) return null;
    return round1((used / total) * 100);
}

/**
 * Coerces a value to a finite number, returning null when it cannot be parsed.
 * @param {*} value the raw value
 * @returns {number|null} the parsed number, or null
 */
function toNumber(value) {
    if (value === undefined || value === null || value === "") return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
}

/**
 * Coerces a value to a number, treating zero as "not reported" rather than as a measurement.
 * Versa returns cpuCores: 0 for virtual appliances, where the Director's inventory record simply
 * does not carry a core count. Zero cores is not a physically meaningful value, so reporting it
 * as an empty cell is honest, whereas a literal 0 reads as a real reading and would satisfy any
 * "cores below threshold" alert on every appliance.
 * @param {*} value the raw value
 * @returns {number|null} the parsed number when above zero, otherwise null
 */
function toPositiveNumber(value) {
    const parsed = toNumber(value);
    return parsed !== null && parsed > 0 ? parsed : null;
}

/**
 * Splits Versa's composite version string (e.g. "22.1.4-GA abc1234 20240628 WSM Normal") into
 * the release and the build portion.
 * @param {string} raw the composite version string
 * @returns {Object} { release, build }
 */
function splitVersion(raw) {
    if (!raw) return { release: "N/A", build: "N/A" };
    const parts = String(raw).trim().split(/\s+/);
    return {
        release: parts[0] || "N/A",
        build: parts.length > 1 ? parts.slice(1, 3).join(" ") : "N/A"
    };
}

/**
 * Derives uptime in days from the appliance start time. Versa reports this as a plain date
 * string (e.g. "Thu Apr 16 19:58:46 2026"); anything unparseable yields null rather than a
 * misleading number. A sudden drop in this value indicates the appliance rebooted.
 * @param {string} startTime the reported start time
 * @returns {number|null} uptime in days to one decimal place, or null
 */
function uptimeDays(startTime) {
    if (!startTime) return null;
    const started = Date.parse(startTime);
    if (isNaN(started)) return null;
    const elapsed = Date.now() - started;
    if (elapsed < 0) return null;
    return round1(elapsed / MILLISECONDS_PER_DAY);
}

/**
 * Sanitizes a string for use as a Custom Driver table record id.
 * @param {string} value the raw string
 * @returns {string} a safe record id
 */
function sanitize(value) {
    const reservedWords = ["\\?", "\\*", "\\%", "table", "column", "history"];
    const sanitizationRegex = new RegExp(reservedWords.join("|"), "g");
    return value.replace(sanitizationRegex, "").slice(0, 50).replace(/\s+/g, "-").toLowerCase();
}

/**
 * Recursively locates the first array of objects within a parsed response. Used as a fallback so
 * the appliance list is still found if a Director release changes its container key.
 * @param {*} node value to inspect
 * @param {number} depth current recursion depth
 * @returns {Array<Object>|null} the first array of objects found, or null
 */
function findFirstObjectArray(node, depth) {
    if (!node || depth > 4) return null;
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
            resolve();
        });
    });
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
 * Extracts the appliance array from the inventory response.
 * @param {Object} payload parsed inventory response
 * @returns {Array<Object>} raw appliance objects
 */
function extractAppliances(payload) {
    if (Array.isArray(payload)) return payload;
    const container = payload["versanms.ApplianceStatusResult"];
    if (container) {
        if (Array.isArray(container.appliance)) return container.appliance;
        const nested = findFirstObjectArray(container, 0);
        if (nested) return nested;
    }
    if (Array.isArray(payload.appliance)) return payload.appliance;
    return findFirstObjectArray(payload, 0) || [];
}

/**
 * Retrieves the appliance inventory in a single call covering the whole fleet.
 * @returns {Promise<Array<Object>>} resolves with the raw appliance objects
 */
function retrieveAppliances() {
    return apiGet(INVENTORY_PATH + "?offset=0&limit=" + pageSize).then(function (payload) {
        const appliances = extractAppliances(payload);
        if (appliances.length === 0) {
            console.log("The inventory call succeeded but returned no appliances. Keys returned: " +
        Object.keys(payload).join(", "));
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            return [];
        }
        if (appliances.length >= pageSize) {
            console.log("The inventory response filled the requested page of " + pageSize +
        " appliances, so the fleet may be larger than reported. Increase the maxAppliances " +
        "parameter to cover every appliance.");
        }
        return appliances;
    });
}

/**
 * Adds one row per appliance to the results table, surfacing every reported field.
 * @param {Array<Object>} appliances raw appliance objects
 */
function populateTable(appliances) {
    appliances.forEach(function (appliance) {
        const name = pick(appliance, ["name", "applianceName"], null);
        if (!name) return;

        const hardware = appliance.Hardware || appliance.hardware || {};
        const geo = appliance.applianceLocation || {};
        const version = splitVersion(pick(appliance, ["softwareVersion", "software-version"], null));
        const startTime = pick(appliance, ["startTime", "start-time"], null);

        const totalMemory = toGiB(pick(hardware, ["memory"], null));
        const totalDisk = toGiB(pick(hardware, ["diskSize"], null));

        appliancesTable.insertRecord(sanitize(name), [
            // Ownership and role
            asText(pick(appliance, ["ownerOrg", "owner-org", "org"], authenticatedOrg), "N/A"),
            asText(pick(appliance, ["ownerOrgUuid", "owner-org-uuid"], null), "N/A"),
            asText(pick(appliance, ["uuid", "applianceUuid"], null), "N/A"),
            asText(pick(appliance, ["type"], null), "N/A"),
            asText(pick(appliance, ["deployment"], null), "N/A"),
            asText(pick(appliance, ["connector"], null), "N/A"),
            asText(pick(appliance, ["connectorType", "connector-type"], null), "N/A"),
            asText(pick(appliance, ["branchId", "branch-id"], null), "N/A"),
            asText(pick(appliance, ["cmsOrg", "cms-org"], null), "N/A"),
            asText(pick(appliance, ["services"], null), "N/A"),
            toNumber(pick(appliance, ["sngCount", "sng-count"], null)),

            // Operational status
            asText(pick(appliance, ["ping-status", "pingStatus"], null), "N/A"),
            asText(pick(appliance, ["sync-status", "syncStatus"], null), "N/A"),
            asText(pick(appliance, ["path-status", "pathStatus"], null), "N/A"),
            // Versa spells this key "controll-status" on current releases; both spellings accepted.
            asText(pick(appliance, ["controll-status", "control-status", "controlStatus"], null), "N/A"),
            asText(pick(appliance, ["services-status", "servicesStatus"], null), "N/A"),
            asText(pick(appliance, ["overall-status", "overallStatus"], null), "N/A"),
            asText(pick(appliance, ["templateStatus", "template-status"], null), "N/A"),
            asText(pick(appliance, ["yang-compatibility-status", "yangCompatibilityStatus"], null), "N/A"),
            haState(appliance["inter-chassis-ha-status"] || appliance.interChassisHaStatus),
            haState(appliance["intra-chassis-ha-status"] || appliance.intraChassisHaStatus),
            asText(pick(appliance, ["stolenSuspected", "stolen-suspected"], false), "N/A"),

            // Software
            version.release,
            version.build,
            asText(pick(hardware, ["firmwareVersion", "firmware-version"], null), "N/A"),

            // Hardware identity
            asText(pick(hardware, ["model"], null), "N/A"),
            asText(pick(hardware, ["manufacturer"], null), "N/A"),
            asText(pick(hardware, ["serialNo", "serialNumber"], null), "N/A"),
            asText(pick(hardware, ["hardWareSerialNo", "hardwareSerialNo"], null), "N/A"),

            // Resources
            toPositiveNumber(pick(hardware, ["cpuCores", "cpu-cores"], null)),
            round1(totalMemory),
            usedPercent(pick(hardware, ["memory"], null), pick(hardware, ["freeMemory"], null)),
            round1(totalDisk),
            usedPercent(pick(hardware, ["diskSize"], null), pick(hardware, ["freeDisk"], null)),

            // Location
            asText(pick(appliance, ["ipAddress", "ip-address"], null), "N/A"),
            asText(pick(appliance, ["locationId", "location"], null), "N/A"),
            toNumber(pick(geo, ["latitude"], null)),
            toNumber(pick(geo, ["longitude"], null)),

            // Lifecycle
            uptimeDays(startTime),
            asText(startTime, "N/A"),
            asText(pick(appliance, ["last-updated-time", "lastUpdatedTime"], null), "N/A"),
            asText(pick(appliance, ["createdAt", "created-at"], null), "N/A")
        ]);
    });
}

// ------------------------------------------------------------------------------------------
// Remote procedures
// ------------------------------------------------------------------------------------------

/**
 * @remote_procedure
 * @label Validate Versa Director connection
 * @documentation Confirms that the Director's token endpoint accepts the configured credentials
 * and OAuth client, and that the appliance inventory endpoint returns data for this account
 */
function validate() {
    login()
        .then(retrieveAppliances)
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
 * @label Get SD-WAN Health
 * @documentation Retrieves the SD-WAN appliance fleet and reports every field the Director
 * provides for each appliance: operational status, template drift, HA state, software and
 * hardware identity, resource usage, uptime and location
 */
function get_status() {
    login()
        .then(retrieveAppliances)
        .then(function (appliances) {
            populateTable(appliances);
            D.success(appliancesTable);
        })
        .catch(function (error) {
            console.log("Failed to retrieve SD-WAN health: " + error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
