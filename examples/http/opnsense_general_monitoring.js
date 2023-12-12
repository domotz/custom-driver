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
function processResponse(d) {
    return function process(error, response, body) {
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode == 401 || response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(JSON.parse(body));
    };
}

// Retrieves firmware status from the OPNsense device
function  getFirmwareStatus() {
    var d = D.q.defer();
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
    D.device.http.get(config, processResponse(d));
    return d.promise;
}

// Retrieves activity data from the OPNsense device
function getActivity() {
    var d = D.q.defer();
    var config = {
        url: "/api/diagnostics/activity/getActivity",
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false,
        port: port
    };
    D.device.http.post(config, processResponse(d));
    return d.promise;
}

function extractHeaders(headers) {
    return headers.split(',').map(function (item) { 
        return parseFloat(item.match(/-?\d+(\.\d+)?/)); 
    });
}

// Extracts relevant data from the API response
function extractData(data) {
    var productVersion = data[0].product_version;
    var firmwareUpdates = data[0].status_msg.indexOf("There are no updates available on the selected mirror.") !== -1 ? "No updates" : data[0].status_msg;
   
    var cpuHeaders = extractHeaders(data[1].headers[2]);
    var cpuUsage = cpuHeaders[0] + cpuHeaders[1] + cpuHeaders[2] + cpuHeaders[3];

    var memHeaders = extractHeaders(data[1].headers[3]);
    var usedMem = memHeaders[0] + memHeaders[1] + memHeaders[2] + memHeaders[3];
    var freeMem = memHeaders[4];
    var memUsage = (usedMem / (usedMem + freeMem) * 100).toFixed(2);

    var swapHeaders = extractHeaders(data[1].headers[4]);
    var totalSwap = swapHeaders[0];
    var freeSwap = swapHeaders[1];
    var swapUsage = ((totalSwap - freeSwap) / totalSwap * 100).toFixed(2);

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
    return D.q.all([
        getFirmwareStatus(),
        getActivity()
    ]);    
}

/**
 * @remote_procedure
 * @label Validate OPENSense Device
 * @documentation This procedure is used to validate if data is accessible
 */
function validate(){
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