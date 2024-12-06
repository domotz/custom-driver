/**
 * Domotz Custom Driver
 * Name: Webinars List
 * Description: This script retrieves information about Zoom Webinars List
 *
 * Communication protocol is HTTPS
 *
 * Tested on Zoom API v2
 *
 * requirements:
 * Granular Scopes: webinar:read:list_webinars,webinar:read:list_webinars:admin
 *
 * Creates Custom Driver table with the following columns:
 *    -
 *
 **/

const accountId = D.getParameter("accountId")
const clientId = D.getParameter("clientId")
const clientSecret = D.getParameter("clientSecret")

const webinarIds = D.getParameter('webinarIds')

const zoomLogin = D.createExternalDevice("zoom.us")
const zoomResources = D.createExternalDevice("api.zoom.us")

let accessToken
let pageToken
let webinars = []
let pageSize = 30

const webinarTypes = {
    5: "Webinar",
    6: "Recurring webinar without a fixed time",
    9: "Recurring webinar with a fixed time",
};


const webinarExtractors = [{valueType: D.valueType.NUMBER, key: 'id', extract: getInfoByKey},
    {label: 'Agenda', valueType: D.valueType.STRING, key: 'agenda', extract: getInfoByKey},
    {label: 'Created At', valueType: D.valueType.DATETIME, key: 'created_at', extract: getInfoByKey},
    {label: 'Duration', valueType: D.valueType.NUMBER, unit: 'minutes', key: 'duration', extract: getInfoByKey},
    {label: 'Host ID', valueType: D.valueType.STRING, key: 'host_id', extract: getInfoByKey},
    {label: 'Join URL', valueType: D.valueType.STRING, key: 'join_url', extract: getInfoByKey},
    {label: 'Start Time', valueType: D.valueType.DATETIME, key: 'start_time', extract: getInfoByKey},
    {label: 'Timezone', valueType: D.valueType.STRING, key: 'timezone', extract: getInfoByKey},
    {label: 'Topic', valueType: D.valueType.STRING, key: 'topic', extract: getInfoByKey},
    {label: 'Type', valueType: D.valueType.NUMBER, key: 'type', extract: getTypeByCode},
    {label: 'UUID', valueType: D.valueType.STRING, key: 'uuid', extract: getInfoByKey},
    {label: 'Is Simulive', valueType: D.valueType.STRING, key: 'is_simulive', extract: getBooleanInfoByKey}
];

const webinarsProperties = webinarExtractors.filter(function (row) {
    return row.label
})

const webinarsTable = D.createTable("Webinars List", webinarsProperties)

/**
 * Retrieves the value of a specific key from an object.
 * @param {Object} row
 * @param {string} key
 * @param valueType
 */
function getInfoByKey(row, key, valueType) {
    if(row[key]){
        if( valueType === D.valueType.NUMBER) {
            const match = row[key].match(/[\d.]+/)
            return match ? parseFloat(match[0]) : "N/A";
        }
        if( valueType === D.valueType.DATETIME) {
            return row[key].getTime();
        }
        return row[key] || "N/A"
    }
    return "N/A"
}

/**
 * Returns a boolean value as a human-readable string based on a key in the row object.
 */
function getBooleanInfoByKey(row, key, valueType) {
    if(row[key] !== undefined){
        return row[key] ? "Yes" : "No"
    }
    return "N/A"
}

/**
 * Gets the webinar type label by code.
 * @param {Object} row - The object containing the webinar type code.
 * @returns {string|null} - The webinar type label or null if not found.
 */
function getTypeByCode(row) {
    return webinarTypes[row.type] || "N/A";
}

/**
 * Checks for HTTP errors in the response and handles them by triggering appropriate failures
 * @param {Object} error The error object returned from the HTTP request
 * @param {Object} response The HTTP response object
 */
function checkHTTPError(error, response) {
    if (error) {
        console.error(error)
        D.failure(D.errorType.GENERIC_ERROR)
    } else if (response.statusCode === 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    } else if (response.statusCode === 401 || response.statusCode === 403) {
        D.failure(D.errorType.AUTHENTICATION_ERROR)
    } else if (response.statusCode !== 200) {
        D.failure(D.errorType.GENERIC_ERROR)
    }
}

/**
 * Processes the login response and extracts the access token
 * @param {Object} d  The deferred promise object
 * @returns {Function} A function to process the HTTP response
 */
function processLoginResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response)
        const bodyAsJSON = JSON.parse(body)
        if (bodyAsJSON.access_token) {
            accessToken = bodyAsJSON.access_token
            d.resolve()
        } else {
            console.error("Access token not found in response body")
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        }
    }
}

/**
 * Processes the Webinars data and handles pagination if necessary.
 * @param {Error|null} error - The error object, if any, from the API response.
 * @param {Object} response - The HTTP response object.
 * @param {Object} d - A deferred object for resolving or rejecting the promise.
 * @param {string} body - The raw response body as a JSON string.
 */
function processWebinars(error, response, d, body) {
    checkHTTPError(error, response)
    if (error) {
        d.reject(error)
        return
    }
    const bodyAsJSON = JSON.parse(body)
    if (!Array.isArray(bodyAsJSON.webinars) || bodyAsJSON.webinars.length === 0) {
        console.error("No Webinar found.")
        D.failure(D.errorType.GENERIC_ERROR)
        return
    }
    webinars = webinars.concat(extractWebinars(bodyAsJSON.webinars))
    if (bodyAsJSON.next_page_token) {
        pageToken = bodyAsJSON.next_page_token
        retrieveWebinars()
            .then(function (Qos) {
                d.resolve(Qos)
            })
            .catch(function (err) {
                console.error("Error fetching next page of Webinar:", err)
                d.reject(err)
            })
    } else {
        console.log("All Webinars retrieved successfully.")
        d.resolve(webinars)
    }
}

/**
 * Generates the configuration object for the API request.
 * @returns {Object} - The configuration object containing the API endpoint, headers, and options.
 */
function generateConfig() {
    const url = "/v2/users/me/webinars?page_size=" + pageSize
    return {
        url: pageToken ? url + "&next_page_token=" + pageToken : url, protocol: "https", headers: {
            "Authorization": "Bearer " + accessToken
        }, rejectUnauthorized: false, jar: true
    }
}

/**
 * Retrieve Webinars.
 * @returns {promise}
 */
function retrieveWebinars() {
    const d = D.q.defer()
    const config = generateConfig();
    zoomResources.http.get(config, function (error, response, body) {
        processWebinars(error, response, d, body);
    })
    return d.promise
}

/**
 * Extracts relevant information from a Zoom room response
 * @param {Object} webinars The raw Zoom room data
 * @returns {Object} A simplified object with only necessary fields
 */
function extractWebinars(webinars) {
    return webinars.map(function (webinar) {
        return webinarExtractors.reduce(function (acc, item) {
            if(item.extract) {
                acc[item.key] = item.extract(webinar, item.key);
            }
            return acc;
        }, {});
    }, []);
}

/**
 * Sanitizes the output by removing reserved words and formatting it
 * @param {string} output The string to be sanitized
 * @returns {string} The sanitized string
 */
function sanitize(output) {
    const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
    const recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
    return output.toString().replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}

/**
 * Filters the Zoom Webinars based on the provided webinarIds parameter
 * @param {Array} webinars The list of Zoom Webinars to filter
 * @returns {Array} A filtered list of Webinars
 */
function filterWebinars(webinars) {
    return webinars.filter(function (webinar) {
        return (webinarIds.length === 1 && webinarIds[0].toLowerCase() === 'all') || webinarIds.some(function (id) {
            return id.toLowerCase() === webinar.id.toLowerCase()
        })
    })
}

/**
 * Generates the HTTP configuration for the login API request.
 * @returns {Object} The HTTP configuration.
 */
function generateLoginConf() {
    return {
        url: "/oauth/token", protocol: "https", headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + D._unsafe.buffer.from(clientId + ":" + clientSecret).toString("base64")
        }, form: {
            "grant_type": "account_credentials", "account_id": accountId
        }, rejectUnauthorized: false, jar: true
    };
}

/**
 * Logs in to Zoom using the provided credentials and retrieves an access token
 * @returns {Promise} A promise that resolves when login is successful
 */
function login() {
    const d = D.q.defer()
    const config = generateLoginConf();
    zoomLogin.http.post(config, processLoginResponse(d))
    return d.promise
}

/**
 * Inserts a record into the output table.
 * @param {Object} webinars - The object to insert into the output table.
 */
function insertRecord(webinars) {
    const recordValues = webinarsProperties.map(function (item) {
        return webinars[item.key] || 'N/A';
    });
    webinarsTable.insertRecord(sanitize(webinars.id), recordValues);
}

/**
 * Populates all Webinars into the output table.
 * @param {Array} webinars - A list of Webinars objects to be inserted into the table.
 */
function populateTable(webinars) {
    webinars.map(function (webinar) {
        insertRecord(webinar)
    });
}

/**
 * @remote_procedure
 * @label Validate Zoom connection
 * @documentation This procedure is used to validate if the Zoom API is accessible and if the login credentials are correct
 */
function validate() {
    login()
        .then(retrieveWebinars)
        .then(D.success)
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * @remote_procedure
 * @label Get Zoom Webinars
 * @documentation This procedure retrieves the list of Zoom Webinars, filters based on roomId, and populates a table with room details
 */
function get_status() {
    login()
        .then(retrieveWebinars)
        .then(function (result) {
            const filteredWebinars = filterWebinars(result)
            populateTable(filteredWebinars);
            D.success(webinarsTable);
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}