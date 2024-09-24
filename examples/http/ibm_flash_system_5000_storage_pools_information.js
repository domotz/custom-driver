/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 Storage pools Information
 * Description: Monitors the Storage pools Information of the IBM FlashSystem5000.
 *
 * Communication protocol is HTTPS
 *
 * Tested on FlashSystem5000 version: 8.5.0.6
 *
 * Extracts the following information from the data array:
 *      - Managed Disk Group Name
 *      - Status
 *      - Managed Disk Count
 *      - Virtual Disk Count
 *      - Capacity
 *      - Extent Size
 *      - Free Capacity
 *      - Virtual Capacity
 *      - Used Capacity
 *      - Real Capacity
 *      - Overallocation
 *      - Warning Threshold
 *      - Easy Tier Mode
 *      - Easy Tier Status
 *      - Compression Status
 *      - Virtual Capacity
 *      - Compressed Capacity
 *      - Uncompressed Capacity
 *      - Parent Managed Disk Group ID
 *      - Parent Managed Disk Group Name
 *      - Child Managed Disk Group Count
 *      - Child Managed Disk Group Capacity
 *      - Type
 *      - Encryption Enabled
 *      - Owner Type
 *      - Owner ID
 *      - Owner Name
 *      - Site ID
 *      - Site Name
 *      - Data Reduction Enabled
 *      - Used Capacity Before Reduction
 *      - Used Capacity After Reduction
 *      - Overhead Capacity
 *      - Deduplication Saving
 *      - Reclaimable Capacity
 *      - FCM Overallocation Max
 *      - Provisioning Policy ID
 *      - Provisioning Policy Name
 *
 **/

const endpointDetails = {
    "endpoint": "lsmdiskgrp"
}

var storagePoolsTable = D.createTable(
    'Storage Pools Details',
    [
        {label: "Managed Disk Group Name", valueType: D.valueType.STRING},
        {label: "Status", valueType: D.valueType.STRING},
        {label: "Managed Disk Count", valueType: D.valueType.NUMBER},
        {label: "Virtual Disk Count", valueType: D.valueType.NUMBER},
        {label: "Capacity", valueType: D.valueType.NUMBER, unit: "TB"},
        {label: "Extent Size", valueType: D.valueType.NUMBER},
        {label: "Free Capacity", valueType: D.valueType.NUMBER, unit: "TB"},
        {label: "Virtual Capacity", valueType: D.valueType.NUMBER, unit: "TB"},
        {label: "Used Capacity", valueType: D.valueType.NUMBER, unit: "TB"},
        {label: "Real Capacity", valueType: D.valueType.NUMBER, unit: "TB"},
        {label: "Overallocation", valueType: D.valueType.NUMBER, unit: "%"},
        {label: "Warning Threshold", valueType: D.valueType.NUMBER, unit: "%"},
        {label: "Easy Tier Mode", valueType: D.valueType.STRING},
        {label: "Easy Tier Status", valueType: D.valueType.STRING},
        {label: "Compression Status", valueType: D.valueType.STRING},
        {label: "Virtual Capacity", valueType: D.valueType.NUMBER, unit: "MB"},
        {label: "Compressed Capacity", valueType: D.valueType.NUMBER, unit: "MB"},
        {label: "Uncompressed Capacity", valueType: D.valueType.NUMBER, unit: "MB"},
        {label: "Parent MDisk Group ID", valueType: D.valueType.STRING},
        {label: "Parent MDisk Group Name", valueType: D.valueType.STRING},
        {label: "Child MDisk Group Count", valueType: D.valueType.NUMBER},
        {label: "Child MDisk Group Capacity", valueType: D.valueType.NUMBER, unit: "MB"},
        {label: "Type", valueType: D.valueType.STRING},
        {label: "Encryption Enabled", valueType: D.valueType.STRING},
        {label: "Owner Type", valueType: D.valueType.STRING},
        {label: "Owner ID", valueType: D.valueType.STRING},
        {label: "Owner Name", valueType: D.valueType.STRING},
        {label: "Site ID", valueType: D.valueType.STRING},
        {label: "Site Name", valueType: D.valueType.STRING},
        {label: "Data Reduction Enabled", valueType: D.valueType.STRING},
        {label: "Used Capacity Before Reduction", valueType: D.valueType.NUMBER, unit: "MB"},
        {label: "Used Capacity After Reduction", valueType: D.valueType.NUMBER, unit: "MB"},
        {label: "Overhead Capacity", valueType: D.valueType.NUMBER, unit: "MB"},
        {label: "Deduplication Capacity Saving", valueType: D.valueType.NUMBER, unit: "MB"},
        {label: "Reclaimable Capacity", valueType: D.valueType.NUMBER, unit: "MB"},
        {label: "FCM Overallocation Max", valueType: D.valueType.NUMBER, unit: "%"},
        {label: "Provisioning Policy ID", valueType: D.valueType.STRING},
        {label: "Provisioning Policy Name", valueType: D.valueType.STRING}
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
 * @param {Array<Object>} storagePoolsDetailsList - List of managed disk details.
 */
function populateTable(storagePoolsDetailsList) {
    for (let i = 0; i < storagePoolsDetailsList.length; i++) {
        const managedDiskDetails = storagePoolsDetailsList[i]
        storagePoolsTable.insertRecord(managedDiskDetails['id'], [
            managedDiskDetails['name'] || "N/A",
            managedDiskDetails['status'] || "N/A",
            managedDiskDetails['mdisk_count'] ? cleanFloatValue(managedDiskDetails['mdisk_count']) : "N/A",
            managedDiskDetails['vdisk_count'] ? cleanFloatValue(managedDiskDetails['vdisk_count']) : "N/A",
            managedDiskDetails['capacity'] ? cleanFloatValue(managedDiskDetails['capacity']) : "N/A",
            managedDiskDetails['extent_size'] ? cleanFloatValue(managedDiskDetails['extent_size']) : "N/A",
            managedDiskDetails['free_capacity'] ? cleanFloatValue(managedDiskDetails['free_capacity']) : "N/A",
            managedDiskDetails['virtual_capacity'] ? cleanFloatValue(managedDiskDetails['virtual_capacity']) : "N/A",
            managedDiskDetails['used_capacity'] ? cleanFloatValue(managedDiskDetails['used_capacity']) : "N/A",
            managedDiskDetails['real_capacity'] ? cleanFloatValue(managedDiskDetails['real_capacity']) : "N/A",
            managedDiskDetails['overallocation'] ? cleanFloatValue(managedDiskDetails['overallocation']) : "N/A",
            managedDiskDetails['warning'] ? cleanFloatValue(managedDiskDetails['warning']) : "N/A",
            managedDiskDetails['easy_tier'] || "N/A",
            managedDiskDetails['easy_tier_status'] || "N/A",
            managedDiskDetails['compression_active'] || "N/A",
            managedDiskDetails['compression_virtual_capacity'] ? cleanFloatValue(managedDiskDetails['compression_virtual_capacity']) : "N/A",
            managedDiskDetails['compression_compressed_capacity'] ? cleanFloatValue(managedDiskDetails['compression_compressed_capacity']) : "N/A",
            managedDiskDetails['compression_uncompressed_capacity'] ? cleanFloatValue(managedDiskDetails['compression_uncompressed_capacity']) : "N/A",
            managedDiskDetails['parent_mdisk_grp_id'] || "N/A",
            managedDiskDetails['parent_mdisk_grp_name'] || "N/A",
            managedDiskDetails['child_mdisk_grp_count'] ? cleanFloatValue(managedDiskDetails['child_mdisk_grp_count']) : "N/A",
            managedDiskDetails['child_mdisk_grp_capacity'] ? cleanFloatValue(managedDiskDetails['child_mdisk_grp_capacity']) : "N/A",
            managedDiskDetails['type'] || "N/A",
            managedDiskDetails['encrypt'] || "N/A",
            managedDiskDetails['owner_type'] || "N/A",
            managedDiskDetails['owner_id'] || "N/A",
            managedDiskDetails['owner_name'] || "N/A",
            managedDiskDetails['site_id'] || "N/A",
            managedDiskDetails['site_name'] || "N/A",
            managedDiskDetails['data_reduction'] || "N/A",
            managedDiskDetails['used_capacity_before_reduction'] ? cleanFloatValue(managedDiskDetails['used_capacity_before_reduction']) : "N/A",
            managedDiskDetails['used_capacity_after_reduction'] ? cleanFloatValue(managedDiskDetails['used_capacity_after_reduction']) : "N/A",
            managedDiskDetails['overhead_capacity'] ? cleanFloatValue(managedDiskDetails['overhead_capacity']) : "N/A",
            managedDiskDetails['deduplication_capacity_saving'] ? cleanFloatValue(managedDiskDetails['deduplication_capacity_saving']) : "N/A",
            managedDiskDetails['reclaimable_capacity'] ? cleanFloatValue(managedDiskDetails['reclaimable_capacity']) : "N/A",
            managedDiskDetails['easy_tier_fcm_over_allocation_max'] ? cleanFloatValue(managedDiskDetails['easy_tier_fcm_over_allocation_max']) : "N/A",
            managedDiskDetails['provisioning_policy_id'] || "N/A",
            managedDiskDetails['provisioning_policy_name'] || "N/A"
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
                .then(function (response) {
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
 * @label Get IBM FlashSystem5000 Storage pools Information
 * @documentation This procedure retrieves the Storage pools Information of the IBM FlashSystem5000
 */
function get_status() {
    login()
        .then(function (body) {
            callHttpsEndpoint(body.token, "/rest/" + endpointDetails.endpoint)
                .then(function (response) {
                    populateTable(response)
                    D.success(storagePoolsTable)
                })
        })
        .catch(function (error) {
            console.error('Validation failed: ', error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
