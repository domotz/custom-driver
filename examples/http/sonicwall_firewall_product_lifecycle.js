/**
 * Domotz Custom Driver 
 * Name: Sonicwall firewall - Product lifecycle
 * Description: Extracts the product lifecycle information for a SonicWall device. The product lifecycle includes five phases: Last Day Order (LDO), Active Retirement (ARM), One-Year Support Last Day Order, Limited Retirement Mode (LRM), and End of Support (EOS). 
 * This information is used to monitor the product lifecycle and check when a product is approaching end of support
 * 
 * Specify which interfaces to monitor based on the provided interfaceName parameter.
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on SonicWALL NSv 270 SonicOS version 7.0.1-5145
 *
 * Creates a Custom Driver variables:
 *      - Last Order Day (LOD): The date when the product's last order day is reached
 *      - Active Retirement (ARM): The date when the product's active retirement period begins
 *      - 1 Year Support Last Order Day: The date when the product's one-year support period ends
 *      - Limited Retirement Mode (LRM): The date when the product enters limited retirement mode
 *      - End of Support (EOS): The date when the product's support ends
 *      - LOD - Remaining Days: The number of days remaining until the product's last order day
 *      - ARM - Remaining Days: The number of days remaining until the product's active retirement period begins
 *      - One-Year Support LOD - Remaining Days: The number of days remaining until the product's one-year support period ends
 *      - LRM - Remaining Days: The number of days remaining until the product enters limited retirement mode
 *      - EOS - Remaining Days: The number of days remaining until the product's support ends
 * 
 **/

//Processes the HTTP response and handles errors
function processResponse(d) {
    return function process(error, response, body) {
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        if (response.statusCode == 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(body);
    };
}

/**
 * Generates the HTTP configuration.
 * @param {string} url The URL to connect to
 * @returns {object} The HTTP configuration
 */
function generateConfig(url) {
    return {
        url: url,
        protocol: "https",
        jar: true,
        rejectUnauthorized: false
    };
}

/**
 * Logs in to the SonicWALL device using basic authentication.
 * @returns {promise} The promise for the login operation.
 */
function login() {
    var d = D.q.defer();
    var config = generateConfig("/api/sonicos/auth");
    config.auth = "basic";
    config.username = D.device.username();
    config.password = D.device.password();
    D.device.http.post(config, processResponse(d));
    return d.promise;
}

/**
 * Retrieves the firewall model
 * @returns {promise} The promise for the firewall model
 */
function getFirewallModel() {
    var d = D.q.defer();
    var config = generateConfig("/api/sonicos/reporting/status/system");
    D.device.http.get(config, processResponse(d));
    return d.promise;
}

var device = D.createExternalDevice("raw.githubusercontent.com"); 

/**
 * Retrieves the product lifecycle data
 * @returns {promise} The promise for the product lifecycle data
 */
function getProductLifecycleData() {
    var d = D.q.defer();
    var config = {
        url: "/domotz/custom-driver/master/resources/sonicwall-plc-tables.json",
        protocol: "https"
    };
    device.http.get(config, function(error, response, body) {   
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);  
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode === 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 200) {
            console.error(body);
            D.failure(D.errorType.GENERIC_ERROR);
        } else {
            d.resolve(JSON.parse(body));
        }
    });
    return d.promise;
}

/**
 * Extracts the firewall model information
 * @param {object} body The response body
 * @returns {object} The extracted model information
 */
function extractFirewallModelInfo(body) {
    var data = JSON.parse(body[0]);
    var modelParts = data.model.split(' ');
    var modelName = modelParts.slice(0, -1).join(' ');
    var modelNumber = modelParts[modelParts.length - 1];

    return { modelName: modelName, modelNumber: modelNumber };
}

/**
 * Calculates the remaining days until each phase begins
 * @param {Date} phaseDate The date of the phase
 * @returns {number} The remaining days
 */
function calculateRemainingDays(phaseDate) {
    var currentDate = new Date();
    var remainingDays = Math.ceil((phaseDate - currentDate) / (1000 * 60 * 60 * 24));
    return remainingDays;
}

/**
 * Extracts the variables from the product lifecycle data
 * @param {object} info The product lifecycle data
 */
function extractVariables(info) {
    var lastOrderDay = info.lod || "N/A";
    var activeRetirement = info.armb || "N/A";
    var oneYearLastOrder = info.oneyldo || "N/A";
    var limitedRetirementMode = info.lrmb || "N/A";
    var endOfSupport = info.eos || "N/A";
    var lodRemainingDays =  calculateRemainingDays(new Date(lastOrderDay));
    var armRemainingDays =  calculateRemainingDays(new Date(activeRetirement));
    var oneyldoRemainingDays =  calculateRemainingDays(new Date(oneYearLastOrder));
    var lrmRemainingDays =  calculateRemainingDays(new Date(limitedRetirementMode));
    var eosRemainingDays =  calculateRemainingDays(new Date(endOfSupport));

    var variables = [
        D.createVariable("lod", "Last Order Day (LOD)", lastOrderDay, null, D.valueType.STRING),
        D.createVariable("arm", "Active Retirement (ARM)", activeRetirement, null, D.valueType.STRING),
        D.createVariable("one-year-lod", "1 Year Support Last Order Day", oneYearLastOrder, null, D.valueType.STRING),
        D.createVariable("lrm", "Limited Retirement Mode (LRM)", limitedRetirementMode, null, D.valueType.STRING),
        D.createVariable("eos", "End of Support (EOS)", endOfSupport, null, D.valueType.STRING),
        D.createVariable("lod-remaining-days", "LOD - Remaining Days", lodRemainingDays || "N/A", "Day", D.valueType.STRING),
        D.createVariable("arm-remaining-days", "ARM - Remaining Days", armRemainingDays || "N/A", "Day", D.valueType.STRING),
        D.createVariable("one-year-lod-remaining-days", "One-Year Support LOD - Remaining Days", oneyldoRemainingDays || "N/A", "Day", D.valueType.STRING),
        D.createVariable("lrm-remaining-days", "LRM - Remaining Days", lrmRemainingDays || "N/A", "Day", D.valueType.STRING),
        D.createVariable("eos-remaining-days", "EOS - Remaining Days", eosRemainingDays || "N/A", "Day", D.valueType.STRING)
    ];
    D.success(variables);
}

// Filters the product lifecycle data to retrieve information for a specific SonicWall firewall model
function filtredData(body) {
    var modelData = extractFirewallModelInfo(body);
    var modelName = modelData.modelName;
    var modelNumber = modelData.modelNumber;
    var productLifecycle = body[1];
    var info;

    for (var key in productLifecycle) {
        var modelInfo = productLifecycle[key];

        if (key.indexOf(modelName) !== -1) {
            for (var type in modelInfo) {
                info = modelInfo[type];
                break;
            }
            break;
        }
    }

    if (!info) {
        console.error("Model Name not found in product lifecycle (PLC) data");
        D.failure(D.errorType.PARSING_ERROR);
    }
    var foundModelNumber = false;
    for (var subKey in info) {
        if (info[subKey].model.indexOf(modelNumber) !== -1) {
            return extractVariables(info[subKey]); 
        }
    }

    if (!foundModelNumber) {
        console.error("Model number not found in product lifecycle (PLC) data");
        D.failure(D.errorType.PARSING_ERROR);
    }
    
}

// Loads the data
function loadData(){
    return D.q.all([
        getFirewallModel(),
        getProductLifecycleData()
    ]);
}

/**
 * @remote_procedure
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the SonicWALL device.
 */
function validate(){
    login()
        .then(loadData)
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
 * @label Get Sonicwall Product lifecycle
 * @documentation This procedure is used to retrieve the product lifecycle information for a SonicWall device. The product lifecycle includes five phases: Last Day Order (LDO), Active Retirement (ARM), One-Year Support Last Day Order, Limited Retirement Mode (LRM), and End of Support (EOS). 
 * This information is used to monitor the product lifecycle and check when a product is approaching end of support
 */
function get_status() {
    login()
        .then(loadData)
        .then(filtredData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
