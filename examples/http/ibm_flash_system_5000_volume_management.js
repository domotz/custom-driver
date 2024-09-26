/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 Volume Management
 * Description: Monitors the Volume Management of the IBM FlashSystem5000.
 *
 * Communication protocol is HTTPS
 *
 * Tested on FlashSystem5000 version: 8.5.0.6
 *
 * Extracts the following information from the data array:
 *      - Name
 *      - IO Group ID
 *      - IO Group Name
 *      - Status
 *      - Disk Group ID
 *      - Disk Group Name
 *      - Capacity
 *      - Type
 *      - VDisk UID
 *      - FC Map Count
 *      - Copy Count
 *      - Fast Write State
 *      - SE Copy Count
 *      - RC Change
 *      - Compressed Copy Count
 *      - Parent Disk Group ID
 *      - Parent Disk Group Name
 *      - Formatting
 *      - Encrypted
 *      - State
 *      - Analysis Time
 *      - Thin Size
 *      - Thin Savings
 *      - Thin Savings Ratio
 *      - Compressed Size
 *      - Compression Savings
 *      - Compression Savings Ratio
 *      - Total Savings
 *      - Total Savings Ratio
 *      - Copy ID
 *      - Copy Status
 *      - Sync
 *      - Primary
 *      - Copy Type
 *      - SE Copy
 *      - Easy Tier
 *      - Easy Tier Status
 *      - Compressed Copy
 *      - Encrypted
 *      - Deduplicated Copy
 *
 **/

const endpoints = [
    {
        "endpoint": "lsvdisk",
        "key": "id"
    },
    {
        "endpoint": "lsvdiskanalysis",
        "key": "id"
    },
    {
        "endpoint": "lsvdiskcopy",
        "key": "vdisk_id"
    }
];

let httpResponses = []

const volumeTable = D.createTable(
    'Volumes Details',
    [
        {label: "Name", valueType: D.valueType.STRING},
        {label: "IO Group ID", valueType: D.valueType.STRING},
        {label: "IO Group Name", valueType: D.valueType.STRING},
        {label: "Status", valueType: D.valueType.STRING},
        {label: "Disk Group ID", valueType: D.valueType.STRING},
        {label: "Disk Group Name", valueType: D.valueType.STRING},
        {label: "Capacity", valueType: D.valueType.NUMBER, unit: "GB"},
        {label: "Type", valueType: D.valueType.STRING},
        {label: "VDisk UID", valueType: D.valueType.STRING},
        {label: "FC Map Count", valueType: D.valueType.NUMBER},
        {label: "Copy Count", valueType: D.valueType.NUMBER},
        {label: "Fast Write State", valueType: D.valueType.STRING},
        {label: "SE Copy Count", valueType: D.valueType.NUMBER},
        {label: "RC Change", valueType: D.valueType.STRING},
        {label: "Compressed Copy Count", valueType: D.valueType.NUMBER},
        {label: "Parent Disk Group ID", valueType: D.valueType.STRING},
        {label: "Parent Disk Group Name", valueType: D.valueType.STRING},
        {label: "Formatting", valueType: D.valueType.STRING},
        {label: "Encrypted", valueType: D.valueType.STRING},
        {label: "State", valueType: D.valueType.STRING},
        {label: "Analysis Time", valueType: D.valueType.STRING},
        {label: "Thin Size", valueType: D.valueType.NUMBER, unit: "GB"},
        {label: "Thin Savings", valueType: D.valueType.NUMBER, unit: "GB"},
        {label: "Thin Savings Ratio", valueType: D.valueType.NUMBER, unit: "%"},
        {label: "Compressed Size", valueType: D.valueType.NUMBER, unit: "GB"},
        {label: "Compression Savings", valueType: D.valueType.NUMBER, unit: "GB"},
        {label: "Compression Savings Ratio", valueType: D.valueType.NUMBER, unit: "%"},
        {label: "Total Savings", valueType: D.valueType.NUMBER, unit: "GB"},
        {label: "Total Savings Ratio", valueType: D.valueType.NUMBER, unit: "%"},
        {label: "Copy ID", valueType: D.valueType.STRING},
        {label: "Copy Status", valueType: D.valueType.STRING},
        {label: "Sync", valueType: D.valueType.STRING},
        {label: "Primary", valueType: D.valueType.STRING},
        {label: "Copy Type", valueType: D.valueType.STRING},
        {label: "SE Copy", valueType: D.valueType.STRING},
        {label: "Easy Tier", valueType: D.valueType.STRING},
        {label: "Easy Tier Status", valueType: D.valueType.STRING},
        {label: "Compressed Copy", valueType: D.valueType.STRING},
        {label: "Encrypted", valueType: D.valueType.STRING},
        {label: "Deduplicated Copy", valueType: D.valueType.STRING}
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
 * Cleans and parses the Float value.
 * @param {string} value - The value to clean.
 * @returns {number|string} Cleaned value.
 */
function cleanFloatValue(value) {
    return parseFloat(value.replace(/[^0-9.]/g, ''))
}

/**
 * Populates the storage pools table with details from a list.
 * @param {Array<Object>} volumeDetailsList - List of managed disk details.
 */
function populateTable(volumeDetailsList) {
    for (let i = 0; i < volumeDetailsList.length; i++) {
        const volumeDetails = volumeDetailsList[i];
        volumeTable.insertRecord(volumeDetails['id'], [
            volumeDetails['name'] || "N/A",
            volumeDetails['IO_group_id'] || "N/A",
            volumeDetails['IO_group_name'] || "N/A",
            volumeDetails['status'] || "N/A",
            volumeDetails['mdisk_grp_id'] || "N/A",
            volumeDetails['mdisk_grp_name'] || "N/A",
            volumeDetails['capacity'] ? convertToGigabytes(volumeDetails['capacity']) : "N/A",
            volumeDetails['type'] || "N/A",
            volumeDetails['vdisk_UID'] || "N/A",
            volumeDetails['fc_map_count'] ? cleanFloatValue(volumeDetails['fc_map_count']) : "N/A",
            volumeDetails['copy_count'] ? cleanFloatValue(volumeDetails['copy_count']) : "N/A",
            volumeDetails['fast_write_state'] || "N/A",
            volumeDetails['se_copy_count'] ? cleanFloatValue(volumeDetails['se_copy_count']) : "N/A",
            volumeDetails['RC_change'] || "N/A",
            volumeDetails['compressed_copy_count'] ? cleanFloatValue(volumeDetails['compressed_copy_count']) : "N/A",
            volumeDetails['parent_mdisk_grp_id'] || "N/A",
            volumeDetails['parent_mdisk_grp_name'] || "N/A",
            volumeDetails['formatting'] || "N/A",
            volumeDetails['encrypt'] || "N/A",
            volumeDetails['state'] || "N/A",
            volumeDetails['analysis_time'] ? formatDate(volumeDetails['analysis_time']) : "N/A",
            volumeDetails['thin_size'] ? convertToGigabytes(volumeDetails['thin_size']) : "N/A",
            volumeDetails['thin_savings'] ? convertToGigabytes(volumeDetails['thin_savings']) : "N/A",
            volumeDetails['thin_savings_ratio'] ? cleanFloatValue(volumeDetails['thin_savings_ratio']) : "N/A",
            volumeDetails['compressed_size'] ? convertToGigabytes(volumeDetails['compressed_size']) : "N/A",
            volumeDetails['compression_savings'] ? convertToGigabytes(volumeDetails['compression_savings']) : "N/A",
            volumeDetails['compression_savings_ratio'] ? cleanFloatValue(volumeDetails['compression_savings_ratio']) : "N/A",
            volumeDetails['total_savings'] ? convertToGigabytes(volumeDetails['total_savings']) : "N/A",
            volumeDetails['total_savings_ratio'] ? cleanFloatValue(volumeDetails['total_savings_ratio']) : "N/A",
            volumeDetails['copy_id'] || "N/A",
            volumeDetails['status'] || "N/A",
            volumeDetails['sync'] || "N/A",
            volumeDetails['primary'] || "N/A",
            volumeDetails['type'] || "N/A",
            volumeDetails['se_copy'] || "N/A",
            volumeDetails['easy_tier'] || "N/A",
            volumeDetails['easy_tier_status'] || "N/A",
            volumeDetails['compressed_copy'] || "N/A",
            volumeDetails['encrypt'] || "N/A",
            volumeDetails['deduplicated_copy'] || "N/A"
        ]);
    }
}

/**
 * Retrieves data from multiple endpoints and stores the responses.
 * @param {Object} body - Contains the token for API calls.
 * @returns {Promise} A promise that resolves when all data is retrieved and stored.
 */
function retrieveAndStoreData(body) {
    const promises = [];
    for (let i = 0; i < endpoints.length; i++) {
        const endpointDetails = endpoints[i]
        const promise = callHttpsEndpoint(body.token, "/rest/" + endpointDetails.endpoint)
            .then(function (response) {
                storeResponse(response, endpointDetails.key)
            })
        promises.push(promise)
    }
    return D.q.all(promises)
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
 * Converts input with units (MB, GB, TB) to gigabytes.
 * @param {string} inputValue - The value with unit.
 * @returns {string} Converted value in gigabytes.
 */
function convertToGigabytes(inputValue) {
    const valueUnitRegex = /^(\d+\.?\d*)\s*(\D+)$/;
    const matchedResult = inputValue.match(valueUnitRegex);
    if (matchedResult) {
        return formatValueToGigabytes(parseFloat(matchedResult[1]), matchedResult[2].trim());
    } else {
        throw new Error('Invalid input format');
    }
}

/**
 * Converts a value to gigabytes based on the unit.
 * @param {number} value - The numeric value.
 * @param {string} unit - The unit (MB, GB, TB).
 * @returns {string} Value in gigabytes.
 */
function formatValueToGigabytes(value, unit) {
    switch (unit.toLowerCase()) {
        case 'mb':
            return (value / 1024).toFixed(4);
        case 'gb':
            return value.toFixed(2);
        case 'tb':
            return (value * 1024).toFixed(2);
        default:
            throw new Error('Unknown unit: ' + unit);
    }
}

/**
 * Formats a date into a string in the format 'MM-DD-YYYY HH:mm:ss'.
 * @param {String} timestamp The date .
 * @returns {string} The formatted date string.
 */
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const year = parseInt('20' + timestamp.slice(0, 2));
    const month = parseInt(timestamp.slice(2, 4)) - 1;
    const day = parseInt(timestamp.slice(4, 6));
    const hour = parseInt(timestamp.slice(6, 8));
    const minute = parseInt(timestamp.slice(8, 10));
    const second = parseInt(timestamp.slice(10, 12));
    const dateTime = new Date(year, month, day, hour, minute, second);
    return (dateTime.getMonth() + 1) + '-' + dateTime.getDate() + '-' + dateTime.getFullYear() + ' ' + dateTime.getHours() + ':' + dateTime.getMinutes() + ':' + dateTime.getSeconds()
}


/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    login()
        .then(retrieveAndStoreData)
        .then(mergeOutputs)
        .then(function () {
            D.success()
        })
        .catch(function (error) {
            console.error('Validation failed: ', error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get IBM FlashSystem5000 Volume Management
 * @documentation This procedure retrieves the Volume Management of the IBM FlashSystem5000
 */
function get_status() {
    login()
        .then(retrieveAndStoreData)
        .then(mergeOutputs)
        .then(function (managedDisksDetailsList) {
            populateTable(managedDisksDetailsList)
            D.success(volumeTable)
        })
        .catch(function (error) {
            console.error('Validation failed: ', error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}