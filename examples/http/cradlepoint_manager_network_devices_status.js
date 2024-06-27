/**
 * Domotz Custom Driver
 * Name: Cradlepoint NetCloud Manager - Network Device Status
 * Description: Retrieves the status of network devices for monitoring.
 *
 * Communication protocol is https.
 *
 * Output:
 * Extracts the following information from the data array:
 * - ID
 * - Model
 * - Product
 * - Status
 */

// device Ids list filter param
var deviceIdsFilter = D.getParameter('deviceIds')
// headers params
var X_CP_API_ID = D.getParameter('X_CP_API_ID')
var X_CP_API_KEY = D.getParameter('X_CP_API_KEY')
var X_ECM_API_ID = D.getParameter('X_ECM_API_ID')
var X_ECM_API_KEY = D.getParameter('X_ECM_API_KEY')

var headers = {
    'X-CP-API-ID': X_CP_API_ID,
    'X-CP-API-KEY': X_CP_API_KEY,
    'X-ECM-API-ID': X_ECM_API_ID,
    'X-ECM-API-KEY': X_ECM_API_KEY
}

var url =  "/api/v2/net_devices";
if (deviceIdsFilter.length !== 1 && deviceIdsFilter[0].toLowerCase() !== 'all') {
    url += deviceIdsFilter.join(',');
}

// call API config
var httpParams = {
    protocol: "https",
    url: url,
    headers: headers
};

// Creation of network devices status table
var networkDevicesStatusTable = D.createTable(
    'Network Devices Status',
    [
        { label: 'Model', valueType: D.valueType.STRING },
        { label: 'Product', valueType: D.valueType.STRING },
        { label: 'Status', valueType: D.valueType.STRING }
    ]
)

// calling get network devices status API
function getNetworkDevicesStatus() {
    var d = D.q.defer();
    var device = D.createExternalDevice('www.cradlepointecm.com')
    device.http.get(httpParams, function (error, response, body) {
        if (error) {
            console.error(error);
            return d.failure(D.errorType.GENERIC_ERROR);
        }
        if(!response){
            d.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode === 401 || response.statusCode === 403) {
            d.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode !== 200) {
            d.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    getNetworkDevicesStatus().then(function () {
        D.success();
    })
        .catch(function () {
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used for retrieving device * variables data
 */
function get_status() {
    getNetworkDevicesStatus()
        .then(function (bodyResponse) {
            var networkDevicesStatus = bodyResponse.data;
            if (!networkDevicesStatus.length) {
                console.info('There are no network devices status related to this filter.');
            }
            if (!Array.isArray(networkDevicesStatus) && typeof networkDevicesStatus === 'object') {
                networkDevicesStatus = [networkDevicesStatus];
            }

            for (let k = 0; k < networkDevicesStatus.length; k++) {
                populateTable(
                    networkDevicesStatus[k].id,
                    networkDevicesStatus[k].mfg_model,
                    networkDevicesStatus[k].mfg_product,
                    networkDevicesStatus[k].connection_state
                );
            }

            D.success(networkDevicesStatusTable);
        })
        .catch(function () {
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * Populates a table with network devices status Table information.
 */
function populateTable (id, Model, Product, Status) {
    var recordId = sanitize(id)
    Model = Model || 'N/A'
    Product = Product || 'N/A'
    Status = Status || 'N/A'
    networkDevicesStatusTable.insertRecord(recordId, [Model, Product, Status])
}

/**
 * @description Sanitizes the given output string by removing reserved words and special characters,
 * limiting its length to 50 characters, replacing spaces with hyphens, and converting it to lowercase.
 * @param {string} output - The string to be sanitized.
 * @returns {string} - The sanitized string.
 */
function sanitize (output) {
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}