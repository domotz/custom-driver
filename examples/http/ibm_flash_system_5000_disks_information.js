/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 Managed Disks Information
 * Description: Monitors the Managed Disks Information of the IBM FlashSystem5000.
 *
 * Communication protocol is HTTPS
 *
 * Tested on FlashSystem5000 version: 8.5.0.6
 *
 * Extracts the following information from the data array:
 *      - Name
 *      - Status
 *      - Mode
 *      - Managed Disk Group ID
 *      - Managed Disk Group Name
 *      - Capacity
 *      - Control LUN Number
 *      - Controller Name
 *      - UID
 *      - Tier
 *      - Encrypted
 *      - Site ID
 *      - Site Name
 *      - Distributed
 *      - Deduplication Enabled
 *      - Over Provisioned
 *      - Supports Unmap
 *      - RAID Status
 *      - RAID Level
 *      - Redundancy
 *      - Strip Size
 *
 **/

const endpoints = [
    {
        "endpoint": "lsmdisk",
        "key": "id"
    },
    {
        "endpoint": "lsarray",
        "key": "mdisk_id"
    }
];

let httpResponses = []

var managedDisksTable = D.createTable(
    'Managed Disks Details',
    [
        {label: "Name", valueType: D.valueType.STRING},
        {label: "Status", valueType: D.valueType.STRING},
        {label: "Mode", valueType: D.valueType.STRING},
        {label: "Managed Disk Group ID", valueType: D.valueType.STRING},
        {label: "Managed Disk Group Name", valueType: D.valueType.STRING},
        {label: "Capacity", valueType: D.valueType.NUMBER, unit: "TB"},
        {label: "Control LUN Number", valueType: D.valueType.STRING},
        {label: "Controller Name", valueType: D.valueType.STRING},
        {label: "UID", valueType: D.valueType.STRING},
        {label: "Tier", valueType: D.valueType.STRING},
        {label: "Encrypted", valueType: D.valueType.STRING},
        {label: "Site ID", valueType: D.valueType.STRING},
        {label: "Site Name", valueType: D.valueType.STRING},
        {label: "Distributed", valueType: D.valueType.STRING},
        {label: "Deduplication Enabled", valueType: D.valueType.STRING},
        {label: "Over Provisioned", valueType: D.valueType.STRING},
        {label: "Supports Unmap", valueType: D.valueType.STRING},
        {label: "RAID Status", valueType: D.valueType.STRING},
        {label: "RAID Level", valueType: D.valueType.STRING},
        {label: "Redundancy", valueType: D.valueType.STRING},
        {label: "Strip Size", valueType: D.valueType.STRING}
    ]
)

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
    const headers = {
        "Content-Type": "application/json",
        'X-Auth-Username': D.device.username(),
        'X-Auth-Password': D.device.password()
    }
    return callHttps(endpoint, headers)
}

/**
 * Cleans and parses the Float value.
 * @param {string} value - The value to clean.
 * @returns {number|string} Cleaned value.
 */
function cleanFloatValue(value) {
    return parseFloat(value.replace(/[^0-9.]/g, ''))
}

/**
 * Populates the managed disks table with details from a list.
 * @param {Array<Object>} managedDisksDetailsList - List of managed disk details.
 */
function populateEndpointVariables(managedDisksDetailsList) {
    for (let i = 0; i < managedDisksDetailsList.length; i++) {
        const managedDiskDetails = managedDisksDetailsList[i]
        managedDisksTable.insertRecord(managedDiskDetails['id'], [
            managedDiskDetails['name'] || "N/A",
            managedDiskDetails['status'] || "N/A",
            managedDiskDetails['mode'] || "N/A",
            managedDiskDetails['mdisk_grp_id'] || "N/A",
            managedDiskDetails['mdisk_grp_name'] || "N/A",
            managedDiskDetails['capacity'] ? cleanFloatValue(managedDiskDetails['capacity']) : "N/A",
            managedDiskDetails['ctrl_LUN_#'] || "N/A",
            managedDiskDetails['controller_name'] || "N/A",
            managedDiskDetails['UID'] || "N/A",
            managedDiskDetails['tier'] || "N/A",
            managedDiskDetails['encrypt'] || "N/A",
            managedDiskDetails['site_id'] || "N/A",
            managedDiskDetails['site_name'] || "N/A",
            managedDiskDetails['distributed'] || "N/A",
            managedDiskDetails['dedupe'] || "N/A",
            managedDiskDetails['over_provisioned'] || "N/A",
            managedDiskDetails['supports_unmap'] || "N/A",
            managedDiskDetails['raid_status'] || "N/A",
            managedDiskDetails['raid_level'] || "N/A",
            managedDiskDetails['redundancy'] || "N/A",
            managedDiskDetails['strip_size'] || "N/A"
        ]);
    }
}

/**
 * Stores an HTTP response with its corresponding key.
 * @param {Object} response - The response object to store.
 * @param {string} key - The key used to identify the response.
 */
function storeResponse(response, key) {
    httpResponses.push({response: response, key: key});
}

/**
 * Merges multiple HTTP responses based on a shared key.
 * @returns {Array<Object>} A list of merged response objects.
 */
function mergeOutputs() {
    if (!httpResponses || httpResponses.length === 0) return [];

    let baseResponseList = httpResponses[0].response;
    const baseKey = httpResponses[0].key;

    for (let i = 1; i < httpResponses.length; i++) {
        const currentResponseList = httpResponses[i].response;
        const currentKey = httpResponses[i].key;
        baseResponseList = baseResponseList.map(function (baseObject) {
            const matchedObject = currentResponseList.find(function (currentObject) {
                return baseObject[baseKey] === currentObject[currentKey];
            });
            return matchedObject ? Object.assign({}, baseObject, matchedObject) : baseObject;
        });
    }
    return baseResponseList;
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
                    .then(function (response) {
                        storeResponse(response, endpointDetails.endpoint, endpointDetails.key)
                    })
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
 * @label Get IBM FlashSystem5000 Managed Disks Information
 * @documentation This procedure retrieves the Managed Disks Information of the IBM FlashSystem5000
 */
function get_status() {
    login()
        .then(function (body) {
            const promises = [];
            for (let i = 0; i < endpoints.length; i++) {
                const endpointDetails = endpoints[i]
                const promise = callHttpsEndpoint(body.token, "/rest/" + endpointDetails.endpoint)
                    .then(function (response) {
                        storeResponse(response, endpointDetails.endpoint, endpointDetails.key)
                    })
                promises.push(promise);
            }
            D.q.all(promises)
                .then(function () {
                    let managedDisksDetailsList = mergeOutputs()
                    populateEndpointVariables(managedDisksDetailsList)
                    D.success(managedDisksTable)
                });
        })
        .catch(function (error) {
            console.error('Validation failed: ', error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
