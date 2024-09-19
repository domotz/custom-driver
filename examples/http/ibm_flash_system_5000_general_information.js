/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 General Information
 * Description: Monitors the general information of the IBM FlashSystem5000.
 *
 * Communication protocol is HTTPS
 *
 * Tested on FlashSystem5000 version: 8.5.0.6
 *
 * Custom Driver Variables:
 *      - ID
 *      - Name
 *      - Version
 *      - Total MDisk Capacity
 *      - Space in Mdisk Groups
 *      - Space Allocated to VDisks
 *      - Total Free Space
 *      - Total VDisk Copy Capacity
 *      - Total Used Capacity
 *      - Total VDisk Capacity
 *      - Total Allocated Extent Capacity
 *      - Email State
 *      - Total Drive Raw Capacity
 *      - Topology Status
 *      - Product Name
 *      - Physical Capacity
 *      - Physical Free Capacity
 *      - Secure Remote Access Status
 *      - Active Monitor User Count
 *      - Remote Support Status
 *
 **/

const endpoints = [{
    "endpoint": "lssystem",
    "rows": [
        { "id": "id", "name": "ID", "extraction": "id", "valueType": D.valueType.STRING, "unit": null },
        { "id": "name", "name": "Name", "extraction": "name", "valueType": D.valueType.STRING, "unit": null },
        { "id": "version", "name": "Version", "extraction": "code_level", "valueType": D.valueType.STRING, "unit": null },
        { "id": "total-mdisk-capacity", "name": "Total MDisk Capacity", "extraction": "total_mdisk_capacity", "valueType": D.valueType.NUMBER, "unit": "TB" },
        { "id": "space_in_mdisk_grps", "name": "Space in Mdisk Groups", "extraction": "space_in_mdisk_grps", "valueType": D.valueType.NUMBER, "unit": "TB" },
        { "id": "space_allocated_to_vdisks", "name": "Space Allocated to VDisks", "extraction": "space_allocated_to_vdisks", "valueType": D.valueType.NUMBER, "unit": "TB" },
        { "id": "total_free_space", "name": "Total Free Space", "extraction": "total_free_space", "valueType": D.valueType.NUMBER, "unit": "TB" },
        { "id": "total_vdiskcopy_capacity", "name": "Total VDisk Copy Capacity", "extraction": "total_vdiskcopy_capacity", "valueType": D.valueType.NUMBER, "unit": "TB" },
        { "id": "total_used_capacity", "name": "Total Used Capacity", "extraction": "total_used_capacity", "valueType": D.valueType.NUMBER, "unit": "TB" },
        { "id": "total_vdisk_capacity", "name": "Total VDisk Capacity", "extraction": "total_vdisk_capacity", "valueType": D.valueType.NUMBER, "unit": "TB" },
        { "id": "total_allocated_extent_capacity", "name": "Total Allocated Extent Capacity", "extraction": "total_allocated_extent_capacity", "valueType": D.valueType.NUMBER, "unit": "TB" },
        { "id": "email_state", "name": "Email State", "extraction": "email_state", "valueType": D.valueType.STRING, "unit": null },
        { "id": "total_drive_raw_capacity", "name": "Total Drive Raw Capacity", "extraction": "total_drive_raw_capacity", "valueType": D.valueType.NUMBER, "unit": "TB" },
        { "id": "topology_status", "name": "Topology Status", "extraction": "topology_status", "valueType": D.valueType.STRING, "unit": null },
        { "id": "product_name", "name": "Product Name", "extraction": "product_name", "valueType": D.valueType.STRING, "unit": null },
        { "id": "physical_capacity", "name": "Physical Capacity", "extraction": "physical_capacity", "valueType": D.valueType.NUMBER, "unit": "TB" },
        { "id": "physical_free_capacity", "name": "Physical Free Capacity", "extraction": "physical_free_capacity", "valueType": D.valueType.NUMBER, "unit": "TB" }
    ]
}, {
    "endpoint": "lssra",
    "rows": [
        { "id": "secure-remote-access-status", "name": "Secure Remote Access Status", "extraction": "status", "valueType": D.valueType.STRING, "unit": null },
        { "id": "active-monitor-user-count", "name": "Active Monitor User Count", "extraction": "active_monitor_user_count", "valueType": D.valueType.NUMBER, "unit": null },
        { "id": "remote-support-status", "name": "Remote Support Status", "extraction": "remote_support_status", "valueType": D.valueType.STRING, "unit": null }
    ]
}];

let result = []

/**
 * Sends an HTTPS POST request and returns the parsed JSON response.
 * @param {string} endpoint - The API endpoint.
 * @param {Object} headers - The request headers.
 * @returns {Promise<Object>} Parsed JSON response.
 */
function callHttps(endpoint,headers){
    const d = D.q.defer();
    const config = {
        url: endpoint,
        protocol: "https",
        port: 7443,
        rejectUnauthorized: false,
        headers: headers
    };
    D.device.http.post(config, function (error, response, body) {
        if (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        } else if (!response) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else if (response.statusCode === 400) {
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        } else if (response.statusCode !== 200) {
            D.failure(D.errorType.GENERIC_ERROR)
        } else {
            d.resolve(JSON.parse(body));
        }
    })
    return d.promise
}

/**
 * Calls an HTTPS endpoint with an authentication token.
 * @param {string} token - Auth token for the request.
 * @param {string} endpoint - The API endpoint.
 * @returns {Promise<Object>} Parsed JSON response.
 */
function callHttpsEndpoint(token, endpoint) {
    const headers = {"X-Auth-Token": token}
    return callHttps(endpoint, headers)
}

/**
 * Logs in using the device's credentials.
 * @returns {Promise<Object>} Parsed JSON login response.
 */
function login() {
    const endpoint = "/rest/auth"
    const headers = {"Content-Type": "application/json",'X-Auth-Username': D.device.username(),'X-Auth-Password': D.device.password()}
    return callHttps(endpoint, headers)
}

/**
 * Cleans and parses the value based on its type.
 * @param {string} value - The value to clean.
 * @param {string} valueType - Type of the value.
 * @returns {number|string} Cleaned value.
 */
function cleanValue(value, valueType) {
    return valueType === D.valueType.NUMBER ? parseFloat(value.replace(/[^0-9.]/g, '')) : value
}

/**
 * Populates variables from the response and row definitions.
 * @param {Object} response - The API response data.
 * @param {Array} rows - Row definitions for data extraction.
 * @returns {void}
 */
function populateEndpointVariables(response, rows) {
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        result.push(D.createVariable(row.id, row.name, cleanValue(response[row.extraction], row.valueType), row.unit, row.valueType))
    }
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    login()
        .then(function (body) {
            const promises = [];
            for (let i = 0; i < endpoints.length; i++) {
                const endpointDetails = endpoints[i]
                const promise = callHttpsEndpoint(body.token, "/rest/" + endpointDetails.endpoint)
                promises.push(promise);
            }
            D.q.all(promises)
                .then(function () {
                    D.success()
                });
        })
        .catch(function (error) {
            console.error('Validation failed: ', error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get IBM FlashSystem5000 General Information
 * @documentation This procedure retrieves the general information of the IBM FlashSystem5000
 */
function get_status() {
    login()
        .then(function (body) {
            const promises = [];
            for (let i = 0; i < endpoints.length; i++) {
                const endpointDetails = endpoints[i]
                const promise = callHttpsEndpoint(body.token, "/rest/" + endpointDetails.endpoint)
                    .then(function (response) {
                        populateEndpointVariables(response, endpointDetails.rows)
                    })
                promises.push(promise);
            }
            D.q.all(promises)
                .then(function () {
                    D.success(result)
                });
        })
        .catch(function (error) {
            console.error('Validation failed: ', error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
