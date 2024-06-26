/**
 * Domotz Custom Driver
 * Name: Cradlepoint NetCloud Manager - Network Device Status
 * Description: Retrieves the status of network devices for monitoring.
 *
 * Communication protocol is https.
 *
 * Request Method: GET
 *
 * Output:
 * Extracts the following information from the data array:
 * - ID
 * - Model
 * - Product
 * - Status
 */

// device Ids list filter param
const deviceIdsFilter = D.getParameter('deviceIds')
// headers params
const X_CP_API_ID = D.getParameter('X_CP_API_ID')
const X_CP_API_KEY = D.getParameter('X_CP_API_KEY')
const X_ECM_API_ID = D.getParameter('X_ECM_API_ID')
const X_ECM_API_KEY = D.getParameter('X_ECM_API_KEY')

var headers = {
    'X-CP-API-ID': X_CP_API_ID,
    'X-CP-API-KEY': X_CP_API_KEY,
    'X-ECM-API-ID': X_ECM_API_ID,
    'X-ECM-API-KEY': X_ECM_API_KEY
}

if (deviceIdsFilter.length === 1 && deviceIdsFilter[0].toLowerCase() === 'all') {
    var url =  "/api/v2/net_devices";
}else{
    var url =  "/api/v2/net_devices/?id__in=" + deviceIdsFilter.join(',');
}

// call API config
var httpParams = {
    protocol: "https",
    port: "",
    url: url,
    headers: headers
};

/**
* Utility function.
* Checks if the response object contains any errors.
* Triggers Failure Callback in case of authentication error or unacceptable status codes.
*/
function validateAuthentication(response) {
    if (response.statusCode === 401 || response.statusCode === 403) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (response.statusCode >= 400) {
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

// calling get network devices status API
function getNetworkDevicesStatus(successCallback) {
    const device = D.createExternalDevice('www.cradlepointecm.com')
    device.http.get(httpParams, function (error, response) {
        if (error) {
            console.error(error);
            return D.failure(D.errorType.GENERIC_ERROR);
        }
        if(!response){
            D.failure(D.errorType.GENERIC_ERROR);
        }
        validateAuthentication(response);
        successCallback(response);
    });
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    getNetworkDevicesStatus(function () {
        D.success();
    });
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    getNetworkDevicesStatus(function (response) {
        var networkDevicesStatus = JSON.parse(response.body).data;
        if (!networkDevicesStatus.length) {
            console.info('There are no network devices status related to this filter.')
        }
        if (!Array.isArray(networkDevicesStatus) && typeof result === 'object') {
            networkDevicesStatus = [].push(result)
        }
        for (let k = 0; k < networkDevicesStatus.length; k++) {
            populateTable(
                networkDevicesStatus[k].id,
                networkDevicesStatus[k].mfg_model,
                networkDevicesStatus[k].mfg_product,
                networkDevicesStatus[k].connection_state
            )
        }
        D.success(networkDevicesStatusTable);
    });
}

// Creation of network devices status table
const networkDevicesStatusTable = D.createTable(
    'Network Devices Status',
    [
        { label: 'Model' },
        { label: 'Product' },
        { label: 'Status' },
    ]
)

/**
 * Populates a table with network devices status Table information.
 */
function populateTable (id, Model, Product, Status) {
    const recordId = sanitize(id)
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
    const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
    const recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}