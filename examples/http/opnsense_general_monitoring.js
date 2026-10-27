/**
 * Domotz Custom Driver
 * Name: OPNSense General / Monitoring
 * Description: This script is designed to retrieve information about an OPNsense device, including product version, firmware updates, CPU usage, memory usage, and swap usage
 *
 * Communication protocol is HTTPS
 *
 * Tested with FreeBSD OPNsense version: 13.2-RELEASE-p5
 *
 * Custom Driver Variables:
 *      - Product Version: The version of the OPNsense product
 *      - Firmware Updates: The status of firmware updates
 *      - CPU Usage: The percentage of CPU usage
 *      - Memory Usage: The percentage of used memory
 *      - Swap Usage: The percentage of used swap space
 *
 **/

// The port number
var port = D.getParameter("portNumber");

//Processes the HTTP response and handles errors
function processResponse(resolve, reject) {
    return function process(error, response, body) {
        if (error) {
            console.error(error);
            return D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode == 401 || response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        }
        resolve(JSON.parse(body));
    };
}

// Retrieves firmware status from the OPNsense device
function  getFirmwareStatus() {
    var config = {
        url: "/api/core/firmware/status",
        username: D.device.username(), //api key == username
        password: D.device.password(), //api secret == password
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false,
        port: port
    };
    return new Promise(function (resolve, reject) {
        D.device.http.get(config, processResponse(resolve, reject));
    });
}

// Retrieves activity data from the OPNsense device
function getActivity() {
    var config = {
        url: "/api/diagnostics/activity/getActivity",
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false,
        port: port
    };
    return new Promise(function (resolve, reject) {
        D.device.http.post(config, processResponse(resolve, reject));
    });
}

function extractHeaders(headers) {
    return headers.split(",").map(function (item) {
        return parseFloat(item.match(/-?\d+(\.\d+)?/));
    });
}

/**
 * Parses a FreeBSD top(1) memory line ("Mem: 214M Active, 1245M Inact, 52M Laundry, 980M Wired, 512M Buf, 12G Free"
 * or "Swap: 8192M Total, 8100M Free") into kilobytes by label; the fields present vary with the FreeBSD version.
 * @param {string} line The top line
 * @returns {Object} Kilobytes by label
 */
function parseTopMemory(line) {
    var multipliers = { K: 1, M: 1024, G: 1024 * 1024, T: 1024 * 1024 * 1024 };
    var values = {};
    var fieldRegex = /([\d.]+)([KMGT]?)\s+([A-Za-z]+)/g;
    var match;
    while ((match = fieldRegex.exec(line.replace(/^\w+:/, ""))) !== null) {
        values[match[3]] = parseFloat(match[1]) * (match[2] ? multipliers[match[2]] : 1 / 1024);
    }
    return values;
}

// Extracts relevant data from the API response
function extractData(data) {
    var productVersion = data[0].product_version;
    var firmwareUpdates = data[0].status_msg.indexOf("There are no updates available on the selected mirror.") !== -1 ? "No updates" : data[0].status_msg;

    var cpuHeaders = extractHeaders(data[1].headers[2]);
    var cpuUsage = cpuHeaders[0] + cpuHeaders[1] + cpuHeaders[2] + cpuHeaders[3];

    // Memory in use is every field but Free (Buf is kept in, as before)
    var memory = parseTopMemory(data[1].headers[3]);
    var freeMem = memory.Free || 0;
    var usedMem = Object.keys(memory).reduce(function (sum, label) {
        return label === "Free" ? sum : sum + memory[label];
    }, 0);
    var memUsage = (usedMem / (usedMem + freeMem) * 100).toFixed(2);

    var swap = parseTopMemory(data[1].headers[4]);
    var totalSwap = swap.Total || 0;
    var freeSwap = swap.Free || 0;
    var swapUsage = totalSwap ? ((totalSwap - freeSwap) / totalSwap * 100).toFixed(2) : "0.00";

    var variables = [
        D.createVariable("product-version", "Product Version", productVersion, null, D.valueType.STRING),
        D.createVariable("firmware-updates", "Firmware Updates", firmwareUpdates, null, D.valueType.STRING),
        D.createVariable("cpu-usage", "CPU Usage", cpuUsage.toFixed(2), "%", D.valueType.NUMBER),
        D.createVariable("memory-usage", "Memory Usage", memUsage, "%", D.valueType.NUMBER),
        D.createVariable("swap-usage", "Swap Usage", swapUsage, "%", D.valueType.NUMBER)
    ];
    D.success(variables);
}

// Loads firmware status and activity informations
function loadData() {
    return Promise.all([
        getFirmwareStatus(),
        getActivity()
    ]);
}

/**
 * @remote_procedure
 * @label Validate OPENSense Device
 * @documentation This procedure is used to validate if data is accessible
 */
function validate() {
    loadData()
        .then(function (response) {
            if (response) {
                console.info("Data available");
                D.success();
            } else {
                console.error("No data available");
                D.failure(D.errorType.GENERIC_ERROR);
            }
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get OPENSense informations
 * @documentation This procedure is used to extract information about the OPNsense device, including product version, firmware updates, CPU usage, memory usage, and swap usage.
 */
function get_status() {
    loadData()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
