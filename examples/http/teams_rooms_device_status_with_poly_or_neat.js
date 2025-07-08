/**
 * @description Teams Rooms Tenant Id
 * @type STRING
 */
const teamsTenantId = D.getParameter('teamsTenantId');

/**
 * @description Teams Rooms Client Id
 * @type STRING
 */
const teamsClientId = D.getParameter('teamsClientId');

/**
 * @description Teams Rooms Client Secret
 * @type SECRET_TEXT
 */
const teamsClientSecret = D.getParameter('teamsClientSecret');

/**
 * @description Monitoring Client(Neat or Poly)
 * @type string
 */
const monitoringClient = D.getParameter('monitoringClient');
/**
 * @description Monitoring Client ID (neatOrgID or poly client_id)
 * @type string
 */
const monitoringClientId = D.getParameter('monitoringClientId');

/**
 * @description Monitoring Client secret (neatAPIKey or poly client_secret)
 * @type string
 */
const monitoringClientSecret = D.getParameter('monitoringClientSecret');
/**
 * @description Cloud Controller Device Id
 * @type STRING
 */
const cloudControllerDeviceID = D.getParameter('cloudControllerDeviceID');

/**
 * @description Room Name
 * @type STRING
 */
const roomName = D.getParameter('roomName');

const microsoftLoginService = D.createExternalDevice('login.microsoftonline.com');
const teamsManagementService = D.createExternalDevice('graph.microsoft.com');

let teamsAccessToken;
let polyAccessToken;

const teamsVariables = [];
const monitoringClientVariables = [];
const isPoly = monitoringClient.toLowerCase() === 'poly';
const isNeat = monitoringClient.toLowerCase() === 'neat';


const polyLensAPI = D.createExternalDevice('login.lens.poly.com');
const polyLensGraphQLAPI = D.createExternalDevice('api.silica-prod01.io.lens.poly.com');

/**
 * Checks for HTTP errors in the response and handles them by triggering appropriate failures.
 * @param {Object} error - The error object returned from the HTTP request.
 * @param {Object} response - The HTTP response object.
 */
function checkHTTPError(error, response) {
    if (error) {
        D.failure(D.errorType.GENERIC_ERROR);
    } else if (response.statusCode === 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else if (response.statusCode === 401 || response.statusCode === 403) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (response.statusCode !== 200) {
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * Processes the login response from the Azure API and extracts the access token.
 * @param {Object} d - The deferred promise object.
 * @returns {Function} A function to process the HTTP response.
 */
function processLoginResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        const bodyAsJSON = JSON.parse(body);
        if (bodyAsJSON.access_token) {
            teamsAccessToken = bodyAsJSON.access_token;
            d.resolve();
        } else {
            console.error('Access token not found in response body');
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
    };
}

function teamsLogin() {
    const d = D.q.defer();
    const config = {
        url: '/' + teamsTenantId + '/oauth2/v2.0/token', protocol: 'https', headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }, form: {
            grant_type: 'client_credentials',
            client_id: teamsClientId,
            client_secret: teamsClientSecret,
            scope: 'https://graph.microsoft.com/.default',
        }, rejectUnauthorized: false, jar: true,
    };
    microsoftLoginService.http.post(config, processLoginResponse(d));
    return d.promise;
}

function getPolyAccessToken() {
    console.log('Getting access token...');
    const d = D.q.defer();

    const config = {
        url: '/oauth/token', protocol: 'https', headers: {
            'Content-Type': 'application/json',
        }, body: JSON.stringify({
            grant_type: 'client_credentials', client_id: monitoringClientId, client_secret: monitoringClientSecret,
        }),
    };

    polyLensAPI.http.post(config, function (err, response, body) {
        console.log('Token response received');
        if (err) {
            console.error('Token error:', err);
            d.reject(err);
            return;
        }
        try {
            const bodyAsJSON = JSON.parse(body);
            console.log('Token parsed successfully');
            polyAccessToken = bodyAsJSON.access_token;
            d.resolve(polyAccessToken);
        } catch (e) {
            console.error('Token parsing error:', e);
            console.log('Raw token response:', body);
            d.reject(e);
        }
    });
    return d.promise;
}

/**
 * Logs in to the microsoft cloud service using OAuth2 credentials.
 * @returns {Promise} A promise that resolves upon successful login.
 */
function login() {
    const promises = [teamsLogin()];
    if (isPoly) {
        promises.push(getPolyAccessToken());
    }
    return D.q.all(promises);
}

function getNeatActions() {
    const neatPulseAPI = D.createExternalDevice('api.pulse.neat.no');

    function mapping(deviceData, key) {
        if (deviceData === undefined || deviceData === null) {
            return 'N/A';
        }
        return deviceData[key] || 'N/A';
    }

    const monitoringClientVars = [
        {
            uid: 'monitoring-client-name', key: 'roomName', label: 'Room Name', mapping, unit: null, type: D.valueType.STRING,
        }, {
            uid: 'monitoring-client-serial', key: 'serial', label: 'Serial Number', mapping, unit: null, type: D.valueType.STRING,
        }, {
            uid: 'monitoring-client-vendor-status',
            key: 'connected',
            label: 'Vendor Status',
            mapping,
            unit: null,
            type: D.valueType.BOOLEAN,
        }, {
            uid: 'monitoring-client-call-status', key: 'inCallStatus', label: 'In Call', mapping, unit: null, type: D.valueType.STRING,
        }, {
            uid: 'monitoring-client-firmware-version',
            key: 'firmwareVersion',
            label: 'Firmware Version',
            mapping,
            unit: null,
            type: D.valueType.STRING,
        }, {
            uid: 'monitoring-client-model', key: 'model', label: 'Model', mapping, unit: null, type: D.valueType.STRING,
        },
    ];

    function createDeviceInfoVariables(deviceData) {
        monitoringClientVars.forEach(function (variable) {
            monitoringClientVariables.push(
                D.device.createVariable(variable.uid, variable.label, variable.mapping(deviceData, variable.key), variable.unit,
                    variable.type));
        });
    }

    /**
     * Checks for HTTP errors and handles them appropriately.
     * @param {Error} err - The error object if an error occurred during the HTTP request.
     * @param {Object} response - The HTTP response object.
     * @param {string} body - The body of the HTTP response.
     */
    function checkHttpError(err, response, body) {
        if (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode === 429) { //Too many requests to Neat Pulse API, retry later
            createDeviceInfoVariables({});
        }
        if (response.statusCode === 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        if (response.statusCode === 401 || response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        if (response.statusCode !== 200) {
            console.error(body);
            D.failure(D.errorType.GENERIC_ERROR);
        }
    }

    function callNeatPulseAPI(url, responseCallback, method = 'GET') {
        const config = {
            url: url, protocol: 'https', headers: {
                'Authorization': 'Bearer ' + monitoringClientSecret,
            }, rejectUnauthorized: false, jar: true,
        };

        if (method === 'GET') {
            neatPulseAPI.http.get(config, function (err, response, body) {
                checkHttpError(err, response, body);
                responseCallback(JSON.parse(body));
            });
        } else {
            neatPulseAPI.http.post(config, function (err, response, body) {
                checkHttpError(err, response, body);
                responseCallback(JSON.parse(body));
            });
        }
    }

    function retrieveEndpointBasicInfo(deviceID) {
        console.log('retrieveEndpointBasicInfo');
        const d = D.q.defer();
        const url = '/v1/orgs/' + monitoringClientId + '/endpoints/' + deviceID;
        callNeatPulseAPI(url, function (bodyAsJSON) {
            createDeviceInfoVariables(bodyAsJSON);
            d.resolve(deviceID, monitoringClientVariables);
        });

        return d.promise;
    }

    return {
        findDevice: function (endpoints) {
            const d = D.q.defer();

            let device = null;
            for (let i = 0; i < endpoints.length; i++) {
                if (endpoints[i].serial === D.device.serial()) {
                    device = endpoints[i];
                    break;
                }
            }

            if (!device) {
                D.success([
                    D.createVariable('msg', 'Message', 'Serial ' + D.device.serial() + ' not found in Neat inventory', null,
                        D.valueType.STRING),
                ]);
            } else {
                d.resolve(device.id);
            }

            return d.promise;
        }, getInventory: function () {
            const d = D.q.defer();

            const url = '/v1/orgs/' + monitoringClientId + '/endpoints';

            callNeatPulseAPI(url, function (bodyAsJSON) {
                d.resolve(bodyAsJSON.endpoints);
            });

            return d.promise;
        }, getDeviceProperties: function (deviceId) {
            return retrieveEndpointBasicInfo(deviceId);
        },
    };
}

function getPolyActions() {

    function checkHttpError(err, response, body) {
        if (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode === 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        if (response.statusCode === 401 || response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        if (response.statusCode !== 200) {
            console.error(body);
            D.failure(D.errorType.GENERIC_ERROR);
        }
    }

    function mapping(deviceData, key) {
        if (deviceData === undefined || deviceData === null) {
            return 'N/A';
        }
        if (Array.isArray(key)) {
            return key.map(function (entry) {
                return deviceData[entry];
            })
            .filter(Boolean)
            .join(' / ') || 'N/A';
        }
        return deviceData[key] || 'N/A';
    }

    const monitoringClientVars = [
        {
            uid: 'monitoring-client-name', key: 'displayName', label: 'Room Name', mapping, unit: null, type: D.valueType.STRING,
        }, {
            uid: 'monitoring-client-serial', key: 'serialNumber', label: 'Serial Number', mapping, unit: null, type: D.valueType.STRING,
        }, {
            uid: 'monitoring-client-vendor-status',
            key: 'connected',
            label: 'Vendor Status',
            mapping,
            unit: null,
            type: D.valueType.BOOLEAN,
        }, {
            uid: 'monitoring-client-call-status', key: 'callStatus', label: 'In Call', mapping, unit: null, type: D.valueType.STRING,
        }, {
            uid: 'monitoring-client-firmware-version',
            key: ['softwareVersion', 'softwareBuild'],
            label: 'Firmware/Software Version',
            mapping,
            unit: null,
            type: D.valueType.STRING,
        }, {
            uid: 'monitoring-client-model', key: 'hardwareModel', label: 'Model', mapping, unit: null, type: D.valueType.STRING,
        },
    ];

    function createDeviceInfoVariables(deviceData) {
        monitoringClientVars.forEach(function (variable) {
            monitoringClientVariables.push(
                D.device.createVariable(variable.uid, variable.label, variable.mapping(deviceData, variable.key), variable.unit,
                    variable.type));
        });

    }

    return {
        getDeviceProperties: function (deviceId) {
            const d = D.q.defer();

            const query = {
                query: 'query getDevice($id: String!) {' + 'device(id: $id) {' + '    id' + '    name' + '    displayName' +
                    '    serialNumber' + '    connected' + '    hardwareModel' + '    hardwareFamily' + '    hardwareRevision' +
                    '    softwareVersion' + '    softwareBuild' + '    macAddress' + '    externalIp' + '    internalIp' +
                    '    lastDetected' + '    dateRegistered' + '    shipmentDate' + '    tenantId' + '    productId' + '    organization' +
                    '    manufacturer' + '    callStatus' + '    supportsSettings' + '    supportsSoftwareUpdate' +
                    '    supportsRemoteSessions' + '    provisioningEnabled' + '    supportsProvisioning' + '    supportsPolicies' +
                    '    hasPeripherals' + '    allPeripheralsLinked' + '    inVirtualDevice' + '    lastConfigRequestDate' +
                    '    activeApplicationName' + '    activeApplicationVersion' + '    provisioningState' + '    usbVendorId' +
                    '    usbProductId' + '    proxyAgent' + '    proxyAgentId' + '    proxyAgentVersion' + '    locationMode' + '    etag' +
                    '    zoomDeviceId' + '    zoomDeviceStatus' + '    zoomRoomId' + '    zoomRoomLink' + '    zoomRoomName' +
                    '    zoomRoomStatus' + '    teamsDeviceId' + '    teamsDeviceHealthStatus' + '    teamsRoomId' + '    teamsRoomLink' +
                    '    teamsRoomName' + '    teamsUserId' + '    teamsPresenceActivity' + '    teamsPresenceAvailability' +
                    '    product {' + '        name' + '        id' + '    }' + '    model {' + '        name' + '        id' + '    }' +
                    '    location {' + '        geohash' + '        coordinate {' + '            latitude' + '            longitude' +
                    '        }' + '    }' + '    tenant {' + '        id' + '        name' + '    }' + '}' + '}', variables: {
                    id: deviceId,
                },
            };
            const config = {
                url: '/graphql', protocol: 'https', headers: {
                    'Content-Type': 'application/json', 'Authorization': 'Bearer ' + polyAccessToken,
                }, body: JSON.stringify(query),
            };
            polyLensGraphQLAPI.http.post(config, function (err, response, body) {
                checkHttpError(err, response, body);
                const bodyAsJSON = JSON.parse(body);
                createDeviceInfoVariables(bodyAsJSON.data.device);
                d.resolve();
            });

            return d.promise;
        },
    };
}

function monitoringClientsActions() {
    if (isPoly) {
        const poly = getPolyActions();
        return {
            findDevice: poly.findDevice, getInventory: poly.getInventory, getDeviceProperties: poly.getDeviceProperties,
        };
    }
    const neat = getNeatActions();
    return {
        findDevice: neat.findDevice, getInventory: neat.getInventory, getDeviceProperties: neat.getDeviceProperties,
    };
}

/**
 * Extracts a nested value from a health object based on a key path array.
 * @param {Object} deviceHealth - The device health object.
 * @param {Array} key - Array of keys representing the path to the value.
 * @returns {string} - The extracted value or "N/A".
 */
function extractFromHealthByPath(deviceHealth, key) {
    let value = deviceHealth;
    for (let i = 0; i < key.length; i++) {
        if (value && value[key[i]] !== undefined) {
            value = value[key[i]];
        } else {
            return 'N/A';
        }
    }
    return (value === 'unknown') ? 'N/A' : value;
}

const deviceHealthExtractors = [
    {
        label: 'Connection Status', valueType: D.valueType.STRING, key: 'connectionStatus', extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth, ['connection', 'connectionStatus']);
        },
    }, {
        label: 'Exchange Login Status', valueType: D.valueType.STRING, key: 'exchangeLoginStatus', extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth, ['loginStatus', 'exchangeConnection', 'connectionStatus']);
        },
    }, {
        label: 'Teams Login Status', valueType: D.valueType.STRING, key: 'teamsLoginStatus', extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth, ['loginStatus', 'teamsConnection', 'connectionStatus']);
        },
    }, {
        label: 'Room Camera', valueType: D.valueType.STRING, key: 'roomCameraHealth', extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth, ['peripheralsHealth', 'roomCameraHealth', 'connection', 'connectionStatus']);
        },
    }, {
        label: 'Content Camera', valueType: D.valueType.STRING, key: 'contentCameraHealth', extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth, ['peripheralsHealth', 'contentCameraHealth', 'connection', 'connectionStatus']);
        },
    }, {
        label: 'Speaker', valueType: D.valueType.STRING, key: 'speakerHealth', extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth, ['peripheralsHealth', 'speakerHealth', 'connection', 'connectionStatus']);
        },
    }, {
        label: 'Communication Speaker', valueType: D.valueType.STRING, key: 'communicationSpeakerHealth', extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth,
                ['peripheralsHealth', 'communicationSpeakerHealth', 'connection', 'connectionStatus']);
        },
    }, {
        label: 'Microphone', valueType: D.valueType.STRING, key: 'microphoneHealth', extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth, ['peripheralsHealth', 'microphoneHealth', 'connection', 'connectionStatus']);
        },
    }, {
        label: 'OS Update Status',
        valueType: D.valueType.STRING,
        key: 'operatingSystemSoftwareUpdateStatus',
        extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth, ['softwareUpdateHealth', 'operatingSystemSoftwareUpdateStatus']);
        },
    }, {
        label: 'Admin Agent Update Status',
        valueType: D.valueType.STRING,
        key: 'adminAgentSoftwareUpdateStatus',
        extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth, ['softwareUpdateHealth', 'adminAgentSoftwareUpdateStatus', 'softwareFreshness']);
        },
    }, {
        label: 'Company Portal Update Status',
        valueType: D.valueType.STRING,
        key: 'companyPortalSoftwareUpdateStatus',
        extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth,
                ['softwareUpdateHealth', 'companyPortalSoftwareUpdateStatus', 'softwareFreshness']);
        },
    }, {
        label: 'Teams Client Update Status',
        valueType: D.valueType.STRING,
        key: 'teamsClientSoftwareUpdateStatus',
        extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth, ['softwareUpdateHealth', 'teamsClientSoftwareUpdateStatus', 'softwareFreshness']);
        },
    }, {
        label: 'Firmware Update Status',
        valueType: D.valueType.STRING,
        key: 'firmwareSoftwareUpdateStatus',
        extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth, ['softwareUpdateHealth', 'firmwareSoftwareUpdateStatus', 'softwareFreshness']);
        },
    }, {
        label: 'Partner Agent Update Status',
        valueType: D.valueType.STRING,
        key: 'partnerAgentSoftwareUpdateStatus',
        extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth, ['softwareUpdateHealth', 'partnerAgentSoftwareUpdateStatus', 'softwareFreshness']);
        },
    }, {
        label: 'Compute Health', valueType: D.valueType.STRING, key: 'computeHealth', extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth, ['hardwareHealth', 'computeHealth', 'connection', 'connectionStatus']);
        },
    }, {
        label: 'HDMI Ingest', valueType: D.valueType.STRING, key: 'hdmiIngestHealth', extract: function (deviceHealth) {
            return extractFromHealthByPath(deviceHealth, ['hardwareHealth', 'hdmiIngestHealth', 'connection', 'connectionStatus']);
        },
    },
];

/**
 * Processes the response from the Devices API call and extracts device information.
 * @param {Object} d - The deferred promise object.
 * @returns {Function} A function to process the HTTP response.
 */
function processDevicesResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        const bodyAsJSON = JSON.parse(body);

        if (!bodyAsJSON.value) {
            console.error('No Devices found in the response');
            D.failure(D.errorType.GENERIC_ERROR);
        }
        let deviceInfoList = bodyAsJSON.value;
        if (!deviceInfoList.length) {
            console.info('There is no Devices');
        }

        d.resolve(deviceInfoList);
    };
}

/**
 * Retrieves Teams devices for the subscription.
 * @returns {Promise} A promise that resolves with the device data.
 */
function retrieveDevices() {
    const d = D.q.defer();
    const config = {
        url: '/beta/teamwork/devices', protocol: 'https', headers: {
            'Authorization': 'Bearer ' + teamsAccessToken,
        }, rejectUnauthorized: false, jar: true,
    };
    teamsManagementService.http.get(config, processDevicesResponse(d));
    return d.promise;
}

/**
 *
 * @param {[{hardwareDetail:{serialNumber: string}}]} devices
 * @returns {{hardwareDetail:{serialNumber: string}}|null}
 */
function filterDevices(devices) {
    const filtered = devices.filter(function (device) {
        return device.hardwareDetail && device.hardwareDetail.serialNumber && D.device.serial() &&
            device.hardwareDetail.serialNumber.toLowerCase() === D.device.serial().toLowerCase();
    });

    if (filtered && filtered.length > 0) {
        console.info('Teams Device found: ' + filtered[0].hardwareDetail.serialNumber);
        return filtered[0];
    }
    return null;
}

/**
 * Extends device health extractors to include display health statuses.
 * @param {Object} deviceHealth - The health data for a device.
 */
function extendDisplayExtractors(deviceHealth) {
    const displays = (deviceHealth && deviceHealth.peripheralsHealth && deviceHealth.peripheralsHealth.displayHealthCollection) || [];
    displays.forEach(function (display, index) {
        const displayKey = 'display_' + (index + 1) + '_status';
        if (!deviceHealthExtractors.some(function (extractor) { return extractor.key === displayKey; })) {
            deviceHealthExtractors.push({
                label: 'Display ' + (index + 1) + ' Status', valueType: D.valueType.STRING, key: displayKey, extract: function (health) {
                    return (health && health.peripheralsHealth && health.peripheralsHealth.displayHealthCollection &&
                        health.peripheralsHealth.displayHealthCollection[index] &&
                        health.peripheralsHealth.displayHealthCollection[index].connection &&
                        health.peripheralsHealth.displayHealthCollection[index].connection.connectionStatus) || 'N/A';
                },
            });
        }
    });
}


/**
 * Extracts device health information from the source health data using the defined extractors.
 * @param {Object} deviceHealth - The health data of the device.
 * @returns {Object} - Extracted device health information.
 */
function extractDeviceHealthInfo(deviceHealth) {
    const info = deviceHealth;
    info.id = deviceHealth.id;
    return info;
}


/**
 * Processes the response from the health API and extracts relevant device health info.
 * @param {Object} d - The deferred promise object.
 * @param {Object} deviceDetails
 * @returns {Function} A function to process the HTTP response.
 */
function processDeviceHealthResponse(d, deviceDetails) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        const bodyAsJSON = JSON.parse(body);
        if (!bodyAsJSON) {
            console.error('No health status found in the response');
        }
        extendDisplayExtractors(bodyAsJSON);
        const deviceHealthInfo = extractDeviceHealthInfo(bodyAsJSON);
        d.resolve({ deviceHealthInfo, deviceDetails });
    };
}

/**
 * Retrieves the health information for each device.
 * @param {Array} deviceDetails - Array of devices to fetch health information for.
 * @returns {Promise} - A promise that resolves with the health data for all devices.
 */
function retrieveDeviceHealthInfo(deviceDetails) {
    const d = D.q.defer();
    if (deviceDetails === null || deviceDetails === undefined) {
        return d.reject();
    }

    const config = {
        url: '/beta/teamwork/devices/' + deviceDetails.id + '/health', protocol: 'https', headers: {
            'Authorization': 'Bearer ' + teamsAccessToken,
        }, rejectUnauthorized: false, jar: true,
    };
    teamsManagementService.http.get(config, processDeviceHealthResponse(d, deviceDetails));
    return d.promise;
}

/**
 * Converts a date to an ISO string format without milliseconds.
 * @param {Date} date - The date to be converted.
 * @returns {string} The ISO string representation of the date.
 */
function toISOStringNoMs(date) {
    return date.toISOString().split('.')[0];
}

/**
 * Counts the attendees of a meeting based on their type and status.
 * @param {Array} attendees - The list of attendees for a meeting.
 * @returns {Object} An object with counts for different attendee types and statuses.
 */
function countAttendees(attendees) {
    var counts = {
        total: attendees.length, required: 0, optional: 0, resource: 0, accepted: 0, declined: 0, tentativelyAccepted: 0, none: 0,
    };
    attendees.forEach(function (attendee) {
        var type = attendee.type;
        var status = attendee.status;
        var response = status.response;
        if (counts[type] !== undefined) {
            counts[type]++;
        }
        if (counts[response] !== undefined) {
            counts[response]++;
        }
    });
    return counts;
}

const ongoingMeetingInfoExtractors = [
    {
        label: 'Total Attendees', valueType: D.valueType.STRING, key: 'attendees', extract: function (meeting) {
            return countAttendees(meeting.attendees).total;
        },
    }, {
        label: 'Required Attendees', valueType: D.valueType.STRING, key: 'required', extract: function (meeting) {
            return countAttendees(meeting.attendees).required;
        },
    }, {
        label: 'Optional Attendees', valueType: D.valueType.STRING, key: 'optional', extract: function (meeting) {
            return countAttendees(meeting.attendees).optional;
        },
    }, {
        label: 'Resource Attendees', valueType: D.valueType.STRING, key: 'resource', extract: function (meeting) {
            return countAttendees(meeting.attendees).resource;
        },
    }, {
        label: 'Accepted', valueType: D.valueType.STRING, key: 'accepted', extract: function (meeting) {
            return countAttendees(meeting.attendees).accepted;
        },
    }, {
        label: 'Tentatively Accepted', valueType: D.valueType.STRING, key: 'tentativelyAccepted', extract: function (meeting) {
            return countAttendees(meeting.attendees).tentativelyAccepted;
        },
    }, {
        label: 'Declined', valueType: D.valueType.STRING, key: 'declined', extract: function (meeting) {
            return countAttendees(meeting.attendees).declined;
        },
    }, {
        label: 'Absent', valueType: D.valueType.STRING, key: 'none', extract: function (meeting) {
            return countAttendees(meeting.attendees).none;
        },
    },
];


/**
 * Extracts ongoing meeting information from a list of meetings.
 * @param {Array} meetings - The list of ongoing meetings.
 * @returns {Array} A list of extracted information for each meeting.
 */
function extractOngoingMeetingsInfo(meetings) {
    function extractInfo(room, idKey, extractors) {
        if (!room || !room[idKey]) {
            return null;
        }
        const extractedInfo = {};
        extractors.forEach(function (row) {
            extractedInfo[row.key] = row.extract(room);
        });
        return extractedInfo;
    }

    return extractInfo(meetings, 'id', ongoingMeetingInfoExtractors);
}

function processOngoingMeetingsResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        const bodyAsJSON = JSON.parse(body);
        if (!bodyAsJSON.value) {
            console.error('No calendar data returned, cannot check for ongoing Microsoft Teams meetings');
            D.failure(D.errorType.GENERIC_ERROR);
        }

        let meetings = bodyAsJSON.value.map(function (room) {
            let ongoingMeetings = extractOngoingMeetingsInfo(room);
            if (!ongoingMeetings || ongoingMeetings.length === 0) {
                console.info('There are no ongoing meetings at the moment in room:', email);
            }
            return ongoingMeetings;
        });
        d.resolve(meetings);
    };
}

function retrieveOngoingMeetings(room) {
    console.log('retrieveOngoingMeetings', room);
    const email = room.emailAddress;
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 60000);
    const d = D.q.defer();
    const config = {
        url: '/v1.0/users/' + email + '/calendarView?startDateTime=' + toISOStringNoMs(now) + '&endDateTime=' + toISOStringNoMs(end),
        protocol: 'https',
        headers: {
            'Authorization': 'Bearer ' + teamsAccessToken, 'Content-Type': 'application/json',
        },
        rejectUnauthorized: false,
        jar: true,
    };
    teamsManagementService.http.get(config, processOngoingMeetingsResponse(d));
    return d.promise;
}

function processRoomAvailabilityResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        const bodyAsJSON = JSON.parse(body);
        if (!bodyAsJSON.value) {
            console.error('No Schedule data found in the response');
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(bodyAsJSON);
    };
}

function deviceTeamsDataPromise() {
    const d = D.q.defer();
    retrieveDevices()
    .then(filterDevices)
    .then(retrieveDeviceHealthInfo)
    .then(d.resolve);
    return d.promise;
}

function roomAvailabilityPromise() {
    const d = D.q.defer();
    const schedules = [roomName];
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 60000);
    const postData = {
        schedules: schedules, startTime: {
            dateTime: toISOStringNoMs(now), timeZone: 'UTC',
        }, endTime: {
            dateTime: toISOStringNoMs(end), timeZone: 'UTC',
        },
    };
    const config = {
        url: '/v1.0/users/' + schedules[0] + '/calendar/getSchedule', protocol: 'https', headers: {
            'Authorization': 'Bearer ' + teamsAccessToken, 'Content-Type': 'application/json',
        }, body: JSON.stringify(postData), rejectUnauthorized: false, jar: true,
    };
    teamsManagementService.http.post(config, processRoomAvailabilityResponse(d));
    return d.promise;
}

function monitoringClientPromise() {
    const d = D.q.defer();
    const actions = monitoringClientsActions();

    try {
        if (cloudControllerDeviceID && cloudControllerDeviceID.trim() !== '') {
            actions.getDeviceProperties(cloudControllerDeviceID)
            .then(d.resolve)
            .catch(function (error) {
                console.error(error);
                D.failure(D.errorType.GENERIC_ERROR);
            });
        } else {
            actions.getInventory()
            .then(actions.findDevice)
            .then(actions.getDeviceProperties)
            .then(d.resolve)
            .catch(function (error) {
                console.error(error);
                D.failure(D.errorType.GENERIC_ERROR);
            });
        }
    } catch (err) {
        console.error('Error executing get_status() function ' + err);
        D.failure(D.errorType.GENERIC_ERROR);
    }
    return d.promise;
}

function fetchDataInParallel() {
    return D.q.all([
        deviceTeamsDataPromise(),
        retrieveOngoingMeetings({ 'emailAddress': roomName }),
        roomAvailabilityPromise(),
        monitoringClientPromise(),
    ]);
}

function extractor(path, data, modifier) {
    const keys = path.split('.');
    let value = data;
    for (let i = 0; i < keys.length; i++) {
        if (value && (value[keys[i]] !== undefined || value[keys[i]] !== null)) {
            value = value[keys[i]];
        } else {
            return 'N/A';
        }
    }
    return modifier ? modifier(value) : value;
}

function buildVariables(results) {
    const teamsData = results && results[0];
    const deviceHealthInfo = teamsData && teamsData.deviceHealthInfo || {};
    const deviceDetails = teamsData && teamsData.deviceDetails || {};
    const roomStatus = results[1];
    const roomAvailability = results[2];
    const monitoringClient = results[3];
    const roomLocationDetails = getRoomLocationDetails(roomName);

    teamsVariables.push(D.createVariable('country', 'Country', roomLocationDetails.country, null, D.valueType.STRING));
    teamsVariables.push(D.createVariable('city', 'City', roomLocationDetails.city, null, D.valueType.STRING));
    teamsVariables.push(D.createVariable('building', 'Building', roomLocationDetails.building, null, D.valueType.STRING));
    teamsVariables.push(D.createVariable('floor', 'Floor', roomLocationDetails.floor, null, D.valueType.STRING));
    teamsVariables.push(D.createVariable('room', 'Room', roomLocationDetails.room, null, D.valueType.STRING));

    const manufacturer = extractor('hardwareDetail.manufacturer', deviceDetails);
    const model = extractor('hardwareDetail.model', deviceDetails);

    teamsVariables.push(
        D.createVariable('deviceModel&Brand', 'Device Brand/model', manufacturer + ' / ' + model, null, D.valueType.STRING));

    teamsVariables.push(D.createVariable(
        'teamsStatus',
        'Teams Status',
        extractor('connection.connectionStatus', deviceHealthInfo),
        null,
        D.valueType.STRING));

    teamsVariables.push(
        D.createVariable('teamsHealthStatus',
            'Teams Health Status',
            extractor('healthStatus',
                deviceDetails),
            null,
            D.valueType.STRING));

    teamsVariables.push(D.createVariable('teamsFirmwareUpdateStatus',
        'Teams Firmware Update Status',

        extractor('softwareUpdateHealth.firmwareSoftwareUpdateStatus.softwareFreshness',
            deviceHealthInfo),
        null,

        D.valueType.STRING));

    teamsVariables.push(
        D.createVariable('teamsDeviceType',
            'Teams Device Type',
            extractor('deviceType',
                deviceDetails),
            null,
            D.valueType.STRING));

    teamsVariables.push(
        D.createVariable('teamsUsedBy',
            'Teams Used By',
            extractor('currentUser.displayName',
                deviceDetails),
            null,
            D.valueType.STRING));

    teamsVariables.push(D.createVariable('teamsLoginStatus',
        'Teams Login Status',

        extractor('loginStatus.teamsConnection.connectionStatus',
            deviceHealthInfo),
        null,
        D.valueType.STRING));

    teamsVariables.push(D.createVariable('confCallInProgress',
        'Conf call in progress',
        extractor('value.0.availabilityView',
            roomAvailability,
            function (roomStatus) {
            const roomStatusMap = {
                '0': 'Free', '1': 'Tentative', '2': 'Busy', '3': 'Out of office',
            };
            return roomStatusMap[roomStatus] || 'N/A';
        }), null, D.valueType.STRING));

    teamsVariables.push(D.createVariable('serialNumber', 'Serial Number', extractor('hardwareDetail.serialNumber', deviceDetails), null,
        D.valueType.STRING));

}


function publishVariables() {
    const allVars = teamsVariables.concat(monitoringClientVariables);
    allVars.concat(teamsVariables);
    allVars.concat(monitoringClientVariables);
    D.success(allVars);
}

/**
 * @remote_procedure
 * @label Get Teams devices
 * @documentation This procedure is used to extract Microsoft Teams Rooms Devices, including general information and detailed health status for each device
 */
function get_status() {
    login()
    .then(fetchDataInParallel)
    .then(buildVariables)
    .then(publishVariables)
    .catch(function (error) {
        console.error(error);
        D.failure(D.errorType.GENERIC_ERROR);
    });
}

const locationsMap = {
    'e': 'East', 'w': 'West', 'n': 'North', 's': 'South',
};

function getRoomLocationDetails(roomName) {
    const chunks = roomName.split(/(?<=\w)-/g);
    if (chunks.length < 5) {
        console.error('Invalid room name format:', roomName);
        return {
            country: 'N/A', city: 'N/A', building: 'N/A', floor: 'N/A', room: 'N/A',
        };
    }

    const details = {
        country: chunks[0] || 'N/A',
        city: chunks[1] || 'N/A',
        building: chunks[2] || 'N/A',
        floor: chunks[3] || 'N/A',
        room: chunks[4] || 'N/A',
    };
    details.room = details.room.split('@')[0];
    const location = details.room.split(/\d/)[0];

    if (Number.isNaN(Number(location))) {
        const roomNumber = details.room.substring(1, details.room.length);
        if (Number.isNaN(Number(roomNumber))) {
            details.room = location;
        } else {
            details.room = locationsMap[location.toLowerCase()] + ', ' + details.room.substring(1, details.room.length);
        }

    }
    return details;
}

/**
 * @remote_procedure
 * @label Validate Teams connection
 * @documentation This procedure is used to validate connectivity and permission by ensuring Teams Rooms data are accessible via the Microsoft Graph API.
 */
function validate() {
    login()
    .then(function () { D.success(); })
    .catch(function (error) {
        console.error(error);
        D.failure(D.errorType.GENERIC_ERROR);
    });
}