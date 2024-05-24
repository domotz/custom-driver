/**
 * Domotz Custom Driver 
 * Name: Cisco Meraki Channel Utilisation
 * Description: This script extracts channel utilization information from Cisco Meraki networks using the Meraki Dashboard API.
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on Cisco Meraki version wireless-25-13 
 *
 * Creates a Custom Driver table with the following columns:
 *      - Network: Network name 
 *      - Device: Device model
 *      - Channel: Channel id 
 *      - Channel Utilization: Percentage of total channel utiliation for the given radio
 *      - Wifi Utilization: Percentage of wifi channel utiliation for the given radio
 *      - Non Wifi Utilization: Percentage of non-wifi channel utiliation for the given radio
 *      - Start Timestamp: The start time of the channel utilization interval
 *      - End Timestamp: The end time of the channel utilization interval
 * 
 **/

var device = D.createExternalDevice("api.meraki.com"); 

// The Id of the organization, obtained from the Cisco Meraki dashboard
var organizationId = D.getParameter("organizationID"); 

// If networkId is 'ALL', it returns all network IDs for the given organization.
// Otherwise, it resolves with the specified networkId
var networkId = D.getParameter("networkID"); // The ID of the network

// Table to store channel utilization data 
var table = D.createTable(
    "Channel Utilization",
    [
        { label: "Network", valueType: D.valueType.STRING },
        { label: "Device", valueType: D.valueType.STRING },
        { label: "Channel", valueType: D.valueType.STRING },
        { label: "Channel Utilization", unit: "%", valueType: D.valueType.NUMBER },
        { label: "Wifi Utilization",  unit: "%", valueType: D.valueType.NUMBER },
        { label: "Non Wifi Utilization",  unit: "%", valueType: D.valueType.NUMBER },
        { label: "Start Timestamp", valueType: D.valueType.DATETIME },
        { label: "End Timestamp", valueType: D.valueType.DATETIME }
    ]
);

/**
 * Function to retrieve network information from the Meraki Dashboard API.
 * @returns {Promise} A promise that resolves with an array of network information.
 */
function getNetworkInfo() {
    var d = D.q.defer();
    var config = {
        url: "/api/v1/organizations/" + organizationId + "/networks",
        protocol: "https",
        headers: {
            "Authorization": "Bearer " + D.device.password(),
            "Content-Type": "application/json"
        }
    };
    device.http.get(config, function(error, response, body) {   
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);  
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode === 401) {
            console.error("Invalid API key");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 200) {
            console.error(body);
            D.failure(D.errorType.GENERIC_ERROR);
        } else {
            var data = JSON.parse(body);
            var networksInfo = [];
            if (networkId.toUpperCase() === "ALL") {
                data.forEach(function(network) {
                    networksInfo.push({ id: network.id, name: network.name });
                });
            } else {
                var networkFound = false;
                for (var i = 0; i < data.length; i++) {
                    if (data[i].id === networkId) {
                        networksInfo.push({ id: data[i].id, name: data[i].name });
                        networkFound = true;
                        break;
                    }
                }
                if (!networkFound) {
                    console.error("Network with specified ID not found.");
                }
            }
            d.resolve(networksInfo);
        }
    });
    return d.promise;
}

/**
 * Function to retrieve channel utilization data for each network.
 * @param {Array} networksInfo Array of network information.
 * @returns {Promise} A promise that resolves with an array of channel utilization information
 */
function getChannelUtilization(networksInfo) {
    var promises = networksInfo.map(function(network) {
        var d = D.q.defer();
        var config = {
            url: "/api/v1/networks/" + network.id + "/networkHealth/channelUtilization",
            protocol: "https",
            headers: {
                "Authorization": "Bearer " + D.device.password(),
                "Content-Type": "application/json"
            }
        };
        device.http.get(config, function(error, response, body) {   
            if (error) {
                console.error(error);
                D.failure(D.errorType.GENERIC_ERROR);  
            } else if (response.statusCode == 404) {
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            } else if (response.statusCode === 401) {
                console.error("Invalid API key");
                D.failure(D.errorType.AUTHENTICATION_ERROR);
            } else if (response.statusCode === 400) {
                console.error("Channel utilization data not available for network: " +  network.id + ". Only wireless networks are supported.");        
                d.resolve(null);
            } else if (response.statusCode != 200) {
                D.failure(D.errorType.GENERIC_ERROR);
            } else {
                d.resolve({ id: network.id, name: network.name, body: body }); 
            }
        });
        return d.promise;
    });
    return D.q.all(promises)
        .then(function(results) {
            return results.filter(function(result) { return result !== null; });
        });
}

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

function formatTimestamp(timestamp) {
    var date = new Date(timestamp);
    var formattedDate =
                (date.getUTCMonth() + 1 < 10 ? "0" : "") + (date.getUTCMonth() + 1) + "/" +
                (date.getUTCDate() < 10 ? "0" : "") + date.getUTCDate() + "/" +
                date.getUTCFullYear() + " " +
                (date.getUTCHours() < 10 ? "0" : "") + date.getUTCHours() + ":" +
                (date.getUTCMinutes() < 10 ? "0" : "") + date.getUTCMinutes() + ":" +
                (date.getUTCSeconds() < 10 ? "0" : "") + date.getUTCSeconds();
    return formattedDate;
}

// Function to extract data from the response body and populates custom table
function extractData(data) {
    data.forEach(function(networkData) {      
        var name = networkData.name; 
        var devices = JSON.parse(networkData.body);  
        devices.forEach(function(deviceData){
            for (var channelId in deviceData) {
                var model = deviceData.model;
                if (Array.isArray(deviceData[channelId])) {
                    var lastChannelUtilization = deviceData[channelId].length - 1;
                    var lastEntry = deviceData[channelId][lastChannelUtilization];
                    var channelUtilization = lastEntry.utilization ? lastEntry.utilization : 0;
                    var wifiUtilization = lastEntry.wifi ? lastEntry.wifi : 0;
                    var nonWifiUtilization = lastEntry.non_wifi ? lastEntry.non_wifi : 0;
                    var startTimestamp = lastEntry.start_ts ? lastEntry.start_ts : "N/A";
                    var endTimestamp = lastEntry.end_ts ? lastEntry.end_ts : "N/A";
                    var recordId = sanitize(name + "-" + model + "-" + channelId);
                    table.insertRecord(recordId, [ 
                        name,
                        model,
                        channelId,
                        channelUtilization,
                        wifiUtilization,
                        nonWifiUtilization,
                        formatTimestamp(startTimestamp),
                        formatTimestamp(endTimestamp)
                    ]);
                }
            }            
        }); 
    });
    D.success(table);
}

/**
 * @remote_procedure
 * @label Validate Cisco Meraki Channel Utilization
 * @documentation This procedure is used to validate the ability to retrieve channel utilization info from Cisco Meraki networks
 */
function validate(){
    getNetworkInfo()
        .then(getChannelUtilization)
        .then(function (response) {
            if (response && response.length > 0) {
                console.log("Validation successful");
                D.success();
            } else {
                console.error("Validation failed");
                D.failure(D.errorType.PARSING_ERROR);
            }
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get Channel Utilization data 
 * @documentation This procedure is used to retrieve channel utilization information from Cisco Meraki networks.
 */
function get_status() {
    getNetworkInfo()
        .then(getChannelUtilization)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}