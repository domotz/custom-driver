/**
 * Domotz Custom Integration
 * Name: Meraki – Organization Appliance Uplink Statuses (Alias/Tags/Per‑Interface Description)
 * Version: 1.3.0
 * Last Updated: 2025-09-16
 *
 * Description: Lists WAN uplink status for Meraki MX/Z devices (filtered by MAC),
 *              enriched with device Alias (name), Tags, and per‑interface Description.
 *
 * Changes in 1.3.0:
 * - Table columns now exactly match requested metrics:
 *   Alias, Serial, Model, Last Reported At, HA Role, Interface, Status, IP, Gateway,
 *   Public IP, Primary DNS, Secondary DNS, IP Assigned By, Tags, Description.
 * - Populates Model/LastReportedAt/HA Role and DNS/IP Assigned By from the uplink statuses endpoint.
 * - Kept 2 req/s rate limiter and 429 retry (up to 6 with Retry‑After) and verbose logging.
 *
 * Parameters (Domotz):
 *  @type SECRET_TEXT  apiKey          Meraki API Key
 *  @type STRING       organizationId  Meraki Organization ID
 *  @type STRING       macAddresses    Optional. Comma-separated list of device management MAC addresses
 *                                   (as shown in the Meraki Dashboard under Devices, e.g. "00:11:22:aa:bb:cc").
 *                                   This is NOT the MAC of a specific WAN interface (WAN1/WAN2/cellular):
 *                                   it identifies the MX/Z appliance itself. Colons and dashes are optional.
 *                                   If a device matches, all its uplink interfaces are included in the table.
 *                                   If left empty or omitted, all MX/Z appliances in the organization are returned.
 *                                   Note: an invalid or malformed MAC is silently ignored (treated as no filter).
 */

// ---------------------- Parameters ----------------------
/** @description Meraki API Key for Authentication @type SECRET_TEXT */
var apiKey = D.getParameter("apiKey");
/** @description Meraki Organization ID @type STRING */
var organizationId = D.getParameter("organizationId");
/**
 * @description Optional filter by device management MAC address (visible in Meraki Dashboard → Devices).
 *              NOT the MAC of a WAN interface. Accepts comma-separated values; colons/dashes optional.
 *              If empty, all MX/Z appliances in the organization are returned.
 * @type STRING
 */
var macAddresses = D.getParameter("macAddresses");

// ---------------------- Utilities -----------------------
function buildHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Cisco-Meraki-API-Key": apiKey
  };
}

function asArrayMaybeCSV(val) {
  if (val && typeof val.length === "number" && typeof val !== "string") {
    var arr = [];
    for (var i = 0; i < val.length; i++) arr.push(val[i]);
    return arr;
  }
  if (typeof val === "string") {
    var parts = val.split(/\s*,\s*/);
    var out = [];
    for (var j = 0; j < parts.length; j++) if (parts[j]) out.push(parts[j]);
    return out;
  }
  return [];
}

function normalizeMac(mac) {
  if (typeof mac !== "string") return null;
  var cleaned = mac.replace(/[^A-Fa-f0-9]/g, "").toUpperCase();
  return cleaned.length === 12 ? cleaned : null;
}

/**
 * Split device notes into per-interface descriptions using heuristics.
 * Returns: { wan1: "", wan2: "", cellular: "" }
 */
function parsePerInterfaceDescriptions(notes) {
  var result = { wan1: "", wan2: "", cellular: "" };
  if (!notes || typeof notes !== "string") return result;

  var chunks = notes.split(/\r?\n|\|+|;+|,{2,}/);
  for (var i = 0; i < chunks.length; i++) {
    var c = (chunks[i] || "").trim();
    if (!c) continue;
    var lc = c.toLowerCase();
    if (lc.indexOf("wan1") !== -1 || lc.indexOf("wan 1") !== -1) {
      result.wan1 = c;
    } else if (lc.indexOf("wan2") !== -1 || lc.indexOf("wan 2") !== -1) {
      result.wan2 = c;
    } else if (lc.indexOf("cell") !== -1 || lc.indexOf("lte") !== -1 ||
               lc.indexOf("wwan") !== -1 || lc.indexOf("usb") !== -1) {
      result.cellular = c;
    }
  }
  return result;
}

function interfaceKeyFromName(name) {
  var s = (name || "").toLowerCase();
  if (s.indexOf("wan1") !== -1 || s.indexOf("wan 1") !== -1) return "wan1";
  if (s.indexOf("wan2") !== -1 || s.indexOf("wan 2") !== -1) return "wan2";
  if (s.indexOf("cell") !== -1 || s.indexOf("lte") !== -1 ||
      s.indexOf("wwan") !== -1 || s.indexOf("usb") !== -1) return "cellular";
  return "";
}

function safeParseJson(body, context) {
  try { return JSON.parse(body); }
  catch (e) { console.error("JSON parse error (" + context + "):", e); return null; }
}

// ---------------------- Rate Limiter (≤ 2 req/s) -----------------------
var RATE_LIMIT_MS = 500; // start at most one task every 500ms
var taskQueue = [];
var schedulerRunning = false;

function startScheduler() {
  if (schedulerRunning) return;
  schedulerRunning = true;
  console.log("[RateLimiter] Scheduler started, tick every " + RATE_LIMIT_MS + "ms");
  (function tick() {
    try {
      if (taskQueue.length > 0) {
        var task = taskQueue.shift();
        try { task(); } catch (te) { console.error("[RateLimiter] Task error:", te); }
      }
    } catch (e) {
      console.error("[RateLimiter] Tick error:", e);
    } finally {
      setTimeout(tick, RATE_LIMIT_MS);
    }
  })();
}

function enqueueTask(fn) {
  taskQueue.push(fn);
  console.log("[RateLimiter] Enqueued task. Queue length:", taskQueue.length);
  startScheduler();
}

// ---------------------- HTTP (GET with 429 retry) -----------------------
var MAX_429_RETRIES = 6;

function httpGet(extDev, url, timeoutMs, cb) {
  var attempts = 0;

  function doRequest() {
    attempts += 1;
    console.log("[HTTP] GET " + url + " (attempt " + attempts + ")");

    extDev.http.get({
      url: url,
      protocol: "https",
      headers: buildHeaders(),
      timeout: timeoutMs
    }, function (err, res, body) {
      if (err) {
        console.error("[HTTP] Network error:", err);
        cb(err, res, body);
        return;
      }

      var code = res && res.statusCode;
      if (code === 429 && attempts <= MAX_429_RETRIES) {
  var retryAfter = 2000; // default 2s instead of 1s
  try {
    var h = res.headers || {};
    var ra = h["Retry-After"] || h["retry-after"];
    if (typeof ra === "string" || typeof ra === "number") {
      var n = parseFloat(ra);
      if (!isNaN(n) && n >= 0) retryAfter = Math.floor(n * 1000);
    }
  } catch (x) { /* ignore */ }

  var jitter = Math.floor(Math.random() * 1000);
  retryAfter = Math.max(retryAfter, 2000) + jitter;

  console.warn("[HTTP] 429 Too Many Requests. Retrying in " + retryAfter + "ms (attempt " + (attempts + 1) + " of " + (MAX_429_RETRIES + 1) + ")");
  setTimeout(function () { enqueueTask(doRequest); }, retryAfter);
  return;
}

      cb(err, res, body);
    });
  }

  enqueueTask(doRequest);
}

// ---------------------- VALIDATE ------------------------
/**
 * @remote_procedure
 * @label Validate Meraki Credentials
 * @documentation Verify key + org by calling /organizations/{organizationId}
 */
function validate() {
  console.log("== Validate Start ==");

  if (!apiKey || !apiKey.trim()) {
    console.error("Missing Meraki API Key");
    D.failure(D.errorType.AUTHENTICATION_ERROR);
    return;
  }
  if (!organizationId || !organizationId.trim()) {
    console.error("Missing Organization ID");
    D.failure(D.errorType.GENERIC_ERROR);
    return;
  }

  var extDev = D.createExternalDevice("api.meraki.com", { password: apiKey });
  console.log("ExternalDevice created for api.meraki.com");

  var url = "/api/v1/organizations/" + encodeURIComponent(organizationId);
  console.log("[Validate] GET " + url);

  httpGet(extDev, url, 20000, function (err, res, body) {
    if (err) { console.error("Network error during validate:", err); D.failure(D.errorType.NETWORK_ERROR); return; }
    if (!res) { console.error("Validate: missing response"); D.failure(D.errorType.GENERIC_ERROR); return; }
    if (res.statusCode === 401 || res.statusCode === 403) { console.error("Validate auth error:", res.statusCode); D.failure(D.errorType.AUTHENTICATION_ERROR); return; }
    if (res.statusCode === 404) { console.error("Validate not found (org?):", res.statusCode); D.failure(D.errorType.RESOURCE_UNAVAILABLE); return; }
    if (res.statusCode !== 200) { console.error("Validate non-200:", res.statusCode, "Body:", body); D.failure(D.errorType.GENERIC_ERROR); return; }

    var parsed = safeParseJson(body, "validate");
    if (!parsed) { D.failure(D.errorType.GENERIC_ERROR); return; }
    console.log("Organization verified. Name:", parsed && parsed.name);
    D.success();
  });
}

// ---------------------- GET_STATUS ------------------------
/**
 * @remote_procedure
 * @label Get Meraki Appliance Uplink Statuses (with Alias/Tags/Per‑Interface Description)
 * @documentation Populates table with Alias, Serial, Model, Last Reported At, HA Role, Interface, Status, IP, Gateway, Public IP, Primary DNS, Secondary DNS, IP Assigned By, Tags, Description.
 */
function get_status() {
  console.log("== get_status Start ==");

  if (!apiKey || !apiKey.trim()) { console.error("Missing Meraki API Key"); D.failure(D.errorType.AUTHENTICATION_ERROR); return; }
  if (!organizationId || !organizationId.trim()) { console.error("Missing Organization ID"); D.failure(D.errorType.GENERIC_ERROR); return; }

  var extDev = D.createExternalDevice("api.meraki.com", { password: apiKey });
  console.log("ExternalDevice created for api.meraki.com");

  // Build MAC filter
  var macList = asArrayMaybeCSV(macAddresses);
  var macFilter = {};
  for (var i = 0; i < macList.length; i++) {
    var nm = normalizeMac(macList[i]);
    if (nm) macFilter[nm] = true;
  }
  var useMacFilter = (function () { for (var k in macFilter) { return true; } return false; })();
  console.log("MAC filter enabled:", useMacFilter);

  // Table schema (exact order requested)
  var table = D.createTable("Meraki Uplink Statuses", [
    { "label": "Alias" },            // device name
    { "label": "Serial" },
    { "label": "Model" },
    { "label": "Last Reported At" },
    { "label": "HA Role" },
    { "label": "Interface" },
    { "label": "Status" },
    { "label": "IP" },
    { "label": "Gateway" },
    { "label": "Public IP" },
    { "label": "Primary DNS" },
    { "label": "Secondary DNS" },
    { "label": "IP Assigned By" },
    { "label": "Tags" },
    { "label": "Description" }       // per-interface when possible
  ]);

  var devicesBySerial = {};  // serial -> { macNorm, name, tagsStr, notes, perDesc, model }

  var devicesUrl = "/api/v1/organizations/" + encodeURIComponent(organizationId) + "/devices?perPage=1000";
  var uplinksUrlPrimary = "/api/v1/organizations/" + encodeURIComponent(organizationId) + "/appliance/uplink/statuses?perPage=1000";
  var uplinksUrlFallback = "/api/v1/organizations/" + encodeURIComponent(organizationId) + "/appliance/uplinks/statuses?perPage=1000";

  // 1) Load devices metadata
  console.log("[get_status] GET " + devicesUrl);
  httpGet(extDev, devicesUrl, 30000, function (err1, res1, body1) {
    if (err1) { console.error("Devices call error:", err1); D.failure(D.errorType.NETWORK_ERROR); return; }
    if (!res1) { console.error("Devices call: missing response"); D.failure(D.errorType.GENERIC_ERROR); return; }
    if (res1.statusCode === 401 || res1.statusCode === 403) { console.error("Devices auth error:", res1.statusCode); D.failure(D.errorType.AUTHENTICATION_ERROR); return; }
    if (res1.statusCode === 404) { console.error("Devices not found:", res1.statusCode); D.failure(D.errorType.RESOURCE_UNAVAILABLE); return; }
    if (res1.statusCode !== 200) { console.error("Devices non-200:", res1.statusCode, "Body:", body1); D.failure(D.errorType.GENERIC_ERROR); return; }

    var list = safeParseJson(body1, "devices");
    if (!list || typeof list.length !== "number") { console.error("Devices parse error or not an array"); D.failure(D.errorType.GENERIC_ERROR); return; }

    console.log("[get_status] Devices returned:", list.length);
    for (var d = 0; d < list.length; d++) {
      var it = list[d] || {};
      var serial = it.serial || it.deviceSerial || "";
      if (!serial) continue;
      var macN = normalizeMac(it.mac || it.wan1Mac || it.wanMac || "");
      var name = it.name || it.productName || it.model || "";
      var tags = it.tags;
      var tagsStr = "";
      if (typeof tags === "string") tagsStr = tags;
      else if (tags && typeof tags.length === "number") {
        var buf = [];
        for (var t = 0; t < tags.length; t++) buf.push(String(tags[t]));
        tagsStr = buf.join(", ");
      }
      var notes = it.notes || it.description || "";
      var model = it.model || "";

      devicesBySerial[serial] = {
        macNorm: macN,
        name: name,
        tagsStr: tagsStr,
        notes: notes,
        perDesc: parsePerInterfaceDescriptions(notes),
        model: model
      };
    }

    // 2) Load uplink statuses (primary), then fallback if 404
    function handleUplinksResponse(res2, body2, triedFallback) {
      if (!res2) { console.error("Uplinks call: missing response"); D.failure(D.errorType.GENERIC_ERROR); return; }
      if (res2.statusCode === 404 && !triedFallback) {
        console.warn("[get_status] Primary endpoint 404. Trying fallback plural form.");
        console.log("[get_status] GET " + uplinksUrlFallback);
        httpGet(extDev, uplinksUrlFallback, 30000, function (errF, resF, bodyF) {
          if (errF) { console.error("Uplinks fallback error:", errF); D.failure(D.errorType.NETWORK_ERROR); return; }
          handleUplinksResponse(resF, bodyF, true);
        });
        return;
      }
      if (res2.statusCode === 401 || res2.statusCode === 403) { console.error("Uplinks auth error:", res2.statusCode); D.failure(D.errorType.AUTHENTICATION_ERROR); return; }
      if (res2.statusCode === 404) { console.error("Uplinks not found on both endpoints (404)."); D.failure(D.errorType.RESOURCE_UNAVAILABLE); return; }
      if (res2.statusCode !== 200) { console.error("Uplinks non-200:", res2.statusCode, "Body:", body2); D.failure(D.errorType.GENERIC_ERROR); return; }

      var upl = safeParseJson(body2, "uplinks");
      if (!upl || typeof upl.length !== "number") { console.error("Uplinks parse error or not an array"); D.failure(D.errorType.GENERIC_ERROR); return; }

      console.log("[get_status] Uplink status items:", upl.length);

      var inserted = 0;
      for (var u = 0; u < upl.length; u++) {
        var row = upl[u] || {};
        var serial = row.serial || row.deviceSerial || "";
        if (!serial) continue;

        var meta = devicesBySerial[serial];
        if (!meta) {
          meta = { macNorm: "", name: "", tagsStr: "", notes: "", perDesc: { wan1: "", wan2: "", cellular: "" }, model: "" };
        }

        // MAC filter (based on devices metadata MAC)
        if (useMacFilter) {
          var inFilter = meta.macNorm && macFilter[meta.macNorm] === true;
          if (!inFilter) continue;
        }

        var alias = meta.name || serial || "";
        var model = row.model || meta.model || "";
        var lastAt = row.lastReportedAt || "";
        var haRole = (row.highAvailability && row.highAvailability.role) ? row.highAvailability.role : "";

        var uplArr = row.uplinks || row.interfaces || row.links || [];
        for (var k = 0; k < uplArr.length; k++) {
          var uo = uplArr[k] || {};
          var iface = uo.interface || uo.uplink || uo.name || "";
          var status = uo.status || uo.reachability || uo.active || "";
          var ip = uo.ip || uo.primaryIp || uo.clientIp || "";
          var gateway = uo.gateway || "";
          var pubIp = uo.publicIp || uo.publicIpAddress || "";
          var dns1 = uo.primaryDns || "";
          var dns2 = uo.secondaryDns || "";
          var ipBy = uo.ipAssignedBy || "";

          var key = interfaceKeyFromName(iface);
          var desc = "";
          if (key && meta.perDesc && meta.perDesc[key]) desc = meta.perDesc[key];
          else if (meta.notes) desc = meta.notes;

          var id = (meta.macNorm || serial || ("idx" + u)) + "-" + (iface || "uplink");
          table.insertRecord(id, [
            alias,
            serial || "",
            model || "",
            lastAt || "",
            haRole || "",
            iface || "",
            String(status || ""),
            ip || "",
            gateway || "",
            pubIp || "",
            dns1 || "",
            dns2 || "",
            ipBy || "",
            meta.tagsStr || "",
            desc || ""
          ]);
          inserted += 1;
        }
      }

      console.log("[get_status] Rows inserted:", inserted);
      D.success(table); // Domotz: success callback with table result
    }

    console.log("[get_status] GET " + uplinksUrlPrimary);
    httpGet(extDev, uplinksUrlPrimary, 30000, function (err2, res2, body2) {
      if (err2) { console.error("Uplinks call error:", err2); D.failure(D.errorType.NETWORK_ERROR); return; }
      handleUplinksResponse(res2, body2, false);
    });
  });
}
