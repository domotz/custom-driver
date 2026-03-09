/**
 * Domotz Custom Integration
 * Name: Ubiquiti UniFi - UPS Tower Battpool Variables
 * Description: This script retrieves battery pool metrics from a Ubiquiti UPS Tower via the UniFi controller local API.
 *
 * Communication protocol is HTTPS
 *
 * Required Parameters:
 *      - udmIp (Text) -> IP of the UniFi Controller
 *      - apiKey (Secret Text) -> Controller Local API key
 *
 * Tested on Ubiquiti UPS Tower managed by UniFi Dream Machine Pro
 *
 * Creates a Custom Driver variables with the following values:
 *      - Battery Level: Battery charge percentage
 *      - Charging: Whether the battery is currently charging
 *      - Battery Mode: Whether the device is in battery mode
 *      - Output Voltage: UPS output voltage
 *      - Output Current: UPS output current
 *      - Output Power: Total power output
 *      - Power Budget: Total power budget
 *      - Power Factor: Power factor
 *      - Ready Count: Number of ready batteries
 *      - Available Battery Count: Number of available batteries
 *      - Time To Remain: Remaining battery time
 *
 */

/**
 * @description IP address of the UniFi Controller
 * @type STRING
 */
var udmIp = D.getParameter("udmIp");

/**
 * @description Controller Local API key
 * @type SECRET_TEXT
 */
var apiKey = D.getParameter("apiKey");

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation Validates if the API key and controller IP are correct
 */
function validate() {
    if (!udmIp) {
        console.error("Missing parameter: udmIp");
        D.failure(D.errorType.GENERIC_ERROR);
        return;
    }
    if (!apiKey) {
        console.error("Missing parameter: apiKey");
        D.failure(D.errorType.AUTHENTICATION_ERROR);
        return;
    }
    D.success();
}

/**
 * @remote_procedure
 * @label Get UPS Tower Battpool Variables
 * @documentation Retrieves battery pool metrics from the Ubiquiti UPS Tower via the UniFi controller API
 */
function get_status() {
    var variables = [];
    var uidIndex = 1;
    var externalDevice = D.createExternalDevice(udmIp);
    var options = {
        protocol: "https",
        url: "/proxy/network/api/s/default/stat/device",
        headers: {
            "X-API-Key": apiKey,
            "Accept": "application/json"
        },
        rejectUnauthorized: false
    };
    externalDevice.http.get(options, function(error, response, body) {
        if (error) {
            console.error("HTTP GET error:", error);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        try {
            var json = (typeof body === "string") ? JSON.parse(body) : body;
            if (!json || !json.data || !json.data.length) {
                console.error("Invalid API response: missing data[]");
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
                return;
            }
            // Find the device matching the agent's MAC
            var targetMac = String(D.device.macAddress() || "").toLowerCase().replace(/[^a-f0-9]/g, "");
            var dev = null;
            for (var i = 0; i < json.data.length; i++) {
                var mac = String(json.data[i].mac || "").toLowerCase().replace(/[^a-f0-9]/g, "");
                if (mac === targetMac) {
                    dev = json.data[i];
                    break;
                }
            }
            if (!dev || !dev.vbms_table || !dev.vbms_table.battpool) {
                console.error("Device or battpool not found for MAC:", targetMac);
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
                return;
            }
            var b = dev.vbms_table.battpool;
            function fmt(v, decimals) {
                if (v === null || v === undefined || v === "") return "N/A";
                if (typeof v === "number" && decimals !== undefined) return v.toFixed(decimals);
                return String(v);
            }
            function addVariable(name, label, value, unit) {
                var v = D.device.createVariable(name + " - " + uidIndex, label, value, unit || "");
                variables.push(v);
                uidIndex += 1;
            }
            addVariable("Battery Level", "Battery Level", fmt(b.batteryLevel), "%");
            addVariable("Charging", "Charging", b.ischarging ? "Yes" : "No");
            addVariable("Battery Mode", "Battery Mode", dev.vbms_table.is_battery_mode ? "Yes" : "No");
            addVariable("Output Voltage", "Output Voltage", fmt(b.device_output_voltage, 2), "V");
            addVariable("Output Current", "Output Current", fmt(b.device_output_current, 2), "A");
            addVariable("Output Power", "Output Power", fmt(b.device_total_power_output), "W");
            addVariable("Power Budget", "Power Budget", fmt(b.device_total_power_budget), "W");
            addVariable("Power Factor", "Power Factor", fmt(b.device_total_power_factor, 2));
            addVariable("Ready Count", "Ready Count", fmt(b.readycnt));
            addVariable("Available Battery Count", "Available Battery Count", fmt(b.batt_available_cnt));
            addVariable("Time To Remain", "Time To Remain", fmt(b.timeToRemain), "s");
            D.success(variables);
        } catch (e) {
            console.error("Parse error:", e);
            D.failure(D.errorType.PARSING_ERROR);
        }
    });
}