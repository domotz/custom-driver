/**
 * Name: pfSense Configuration Backup
 * Description: This Configuration Management Script extracts the pfSense configuration and backs it up
 *
 * Communication protocol is HTTPS
 *
 * Tested on pfsense Version 2.7.2-RELEASE
 *
 * Notes:
 * - Non-default users are recommended unless the default admin user has the interactive menu disabled.
 * - Requires HTTPS communication, with the CSRF token fetched dynamically from the backup page.
 *
 * Required permissions: User with the "WebCfg - Diagnostics: Backup/Restore" privilege
 */

/**
 * @remote_procedure
 * @label Validate Association for Backup
 * @documentation Validates if the device is accessible and the configuration backup process is functional.
 */
function validate() {
    fetchCSRFToken()
        .then(performLogin)
        .then(function () {
            console.info("Validation successful")
            D.success()
        })
        .catch(function (error) {
            console.error("Validation failed: ", error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * @remote_procedure
 * @label Backup pfsense Configuration
 * @documentation Retrieves and stores the configuration backup for the pfSense device.
 */
function backup() {
    fetchCSRFToken()
        .then(performLogin)
        .then(downloadConfiguration)
        .catch(function (error) {
            console.error("Backup operation failed:", error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * Utility function to check HTTP errors and trigger appropriate failures.
 * @param {Object} error - The error object.
 * @param {Object} response - The HTTP response object.
 */
function checkHTTPError(error, response) {
    console.info("HTTP Response Code:", response ? response.statusCode : "No Response")
    if (error) {
        console.error("HTTP Error:", error)
        D.failure(D.errorType.GENERIC_ERROR)
    } else if (response.statusCode === 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    } else if (response.statusCode === 401 || response.statusCode === 403) {
        D.failure(D.errorType.AUTHENTICATION_ERROR)
    } else if (response.statusCode !== 200 && response.statusCode !== 302) {
        D.failure(D.errorType.GENERIC_ERROR)
    }
}

/**
 * Handles HTTP 302 redirects and follows the location header dynamically.
 * @param {Object} response - The HTTP response object.
 * @returns {String} Redirect URL.
 */
function handleRedirect(response) {
    if (response.statusCode === 302 && response.headers && response.headers.location) {
        var baseUrl = "https://" + D.device.ip()
        return response.headers.location.startsWith("http")
            ? response.headers.location
            : baseUrl + response.headers.location
    }
    return null
}

/**
 * Generates a configuration object for HTTP requests to pfSense.
 * @param {string} url - The endpoint to send the request to.
 * @param {Object} form - The form data to include in the request.
 * @returns {Object} The configuration object for the HTTP request.
 */
function generateConfig(url, form) {
    return {
        url: url,
        protocol: "https",
        rejectUnauthorized: false,
        jar: true,
        headers: {
            "Accept": "text/html",
            "Content-Type": "application/x-www-form-urlencoded"
        },
        form: form
    }
}

/**
 * Fetches the CSRF token required for operations.
 * @returns {Promise<Object>} A promise resolving to the CSRF token.
 */
function fetchCSRFToken() {
    var d = D.q.defer()
    var config =  generateConfig("/diag_backup.php")

    D.device.http.get(config, function (error, response, body) {
        checkHTTPError(error, response)
        var tokenMatch = /var csrfMagicToken = "(.*?)"/.exec(body)
        if (tokenMatch) {
            d.resolve(tokenMatch[1])
        } else {
            console.error("CSRF token not found in response.")
            D.failure(D.errorType.GENERIC_ERROR)
        }
    })

    return d.promise
}

/**
 * Logs in to the pfSense web GUI and establishes a session.
 * @param {Object} csrfToken - The CSRF token to include in the login request.
 * @returns {Promise<Object>} A promise resolving to session data.
 */
function performLogin(csrfToken) {
    var d = D.q.defer()
    var config = generateConfig("/index.php", {
        login: "Login",
        usernamefld: D.device.username(),
        passwordfld: D.device.password(),
        __csrf_magic: csrfToken
    })

    D.device.http.post(config, function (error, response) {
        checkHTTPError(error, response)
        var redirectURL = handleRedirect(response)
        if (redirectURL) {
            fetchCSRFToken()
                .then(function (data) {
                    d.resolve(data)
                }).catch(function (error) {
                d.reject(error)
            })
        } else {
            console.error("Login failed; redirect URL not found.")
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        }
    })

    return d.promise
}

/**
 * Downloads the configuration file from pfSense after successful login.
 * @param {Object} csrfToken - The CSRF token to include in the download request.
 * @returns {Promise<Object>} A promise resolving to the configuration backup data.
 */
function downloadConfiguration(csrfToken) {
    var d = D.q.defer()
    var config = generateConfig("/diag_backup.php", {
        download: "download",
        donotbackuprrd: "yes",
        __csrf_magic: csrfToken
    })

    D.device.http.post(config, function (error, response, body) {
        checkHTTPError(error, response)
        if (body && body.startsWith("<?xml")) {
            D.success(D.createBackup({
                label: "pfSense Configuration Backup",
                running: body
            }))
        } else {
            console.error("Unexpected response; backup failed.")
            D.failure(D.errorType.GENERIC_ERROR)
        }
    })
    return d.promise
}
