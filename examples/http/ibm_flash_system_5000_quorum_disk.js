/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 Quorum disk
 * Description: Monitors the Quorum disk of the IBM FlashSystem5000.
 *
 * Communication protocol is HTTPS
 *
 * Tested on FlashSystem5000 version: 8.5.0.6
 *
 * Extracts the following information from the data array:
 *      - Quorum Index
 *      - Status
 *      - Name
 *      - Controller ID
 *      - Controller Name
 *      - Active
 *      - Object Type
 *      - Override
 *      - Site ID
 *      - Site Name
 *
 **/

const endpointDetails = {
    "endpoint": "lsquorum"
}

const quorumInfoTable = D.createTable(
    'Quorum Information Details',
    [
        {label: "Quorum Index", valueType: D.valueType.STRING},
        {label: "Status", valueType: D.valueType.STRING},
        {label: "Name", valueType: D.valueType.STRING},
        {label: "Controller ID", valueType: D.valueType.STRING},
        {label: "Controller Name", valueType: D.valueType.STRING},
        {label: "Active", valueType: D.valueType.STRING},
        {label: "Object Type", valueType: D.valueType.STRING},
        {label: "Override", valueType: D.valueType.STRING},
        {label: "Site ID", valueType: D.valueType.STRING},
        {label: "Site Name", valueType: D.valueType.STRING}
    ]
);

/**
 * Sends an HTTPS POST request and returns the parsed JSON response.
 * @param {string} endpoint - The API endpoint.
 * @param {Object} headers - The request headers.
 * @returns {Promise<Object>} Parsed JSON response.
 */
function callHttps(endpoint, headers) {
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
        } else if (!response || response.statusCode === 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else if (response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        }
        else if (response.statusCode !== 200) {
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
    const headers = {
        "Content-Type": "application/json",
        'X-Auth-Username': D.device.username(),
        'X-Auth-Password': D.device.password()
    }
    return callHttps(endpoint, headers)
}

/**
 * Populates the Quorum Info table with details from a list.
 * @param {Array<Object>} quorumInfoList - List of managed disk details.
 */
function populateTable(quorumInfoList) {
    for (let i = 0; i < quorumInfoList.length; i++) {
        const quorumDetails = quorumInfoList[i];
        quorumInfoTable.insertRecord("" + (i + 1), [
            quorumDetails['quorum_index'] || "N/A",
            quorumDetails['status'] || "N/A",
            quorumDetails['name'] || "N/A",
            quorumDetails['controller_id'] || "N/A",
            quorumDetails['controller_name'] || "N/A",
            quorumDetails['active'] || "N/A",
            quorumDetails['object_type'] || "N/A",
            quorumDetails['override'] || "N/A",
            quorumDetails['site_id'] || "N/A",
            quorumDetails['site_name'] || "N/A"
        ]);
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
            callHttpsEndpoint(body.token, "/rest/" + endpointDetails.endpoint)
                .then(function () {
                    D.success()
                })
        })
        .catch(function (error) {
            console.error('Validation failed: ', error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get IBM FlashSystem5000 Quorum Info
 * @documentation This procedure retrieves the Quorum Info of the IBM FlashSystem5000
 */
function get_status() {
    login()
        .then(function (body) {
            callHttpsEndpoint(body.token, "/rest/" + endpointDetails.endpoint)
                .then(function (response) {
                    populateTable(response)
                    D.success(quorumInfoTable)
                })
        })
        .catch(function (error) {
            console.error('Validation failed: ', error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
