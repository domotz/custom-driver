/**
 * Name: Palo Alto Firewall Backup configuration
 * Description: This Configuration Management Script Extracts the Palo Alto Firewall configuration and backs it up
 *
 * Communication protocol is HTTPS
 * 
 * Tested on Palo Alto Version 10.1.0
 *
 * Creates a configuration backup
 *
 * Required permissions:
 *   - Admin role with XML API
 *   - Export Configuration permissions to generate an API key
 * 
 **/

/**
 * Retrieves an API key from the Palo Alto Firewall device
 * @returns {Promise} A promise that resolves to the API key as a string
 */
function getAPIkey() {
    var d = D.q.defer()
    var config = {
        url: "/api/?type=keygen",
        protocol: "https",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        form: { 
            user: D.device.username(), 
            password: D.device.password() 
        },
        rejectUnauthorized: false
    }
    D.device.http.post(config, function(error, response, body){
        if (error) {          
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else if (response.statusCode == 401 || response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR)
        } else {
            var $ = D.htmlParse(body)
            var key = $('key').text()
            d.resolve(key)
        }
    })
    return d.promise
}

/**
 * This function sends an HTTPS GET request to the Palo Alto Firewall device using the provided API key to obtain the configuration backup
 * @param {string} key The API key used to authenticate the request
 * @returns {Promise} A promise that resolves to the configuration backup as a string
 */
function getConfigBackup(key){
    var d = D.q.defer()
    var config = {
        url: "/api/?type=export&category=configuration&key=" + key,
        protocol: "https",
        rejectUnauthorized: false
    }
    D.device.http.get(config, function(error, response, body){
        if (error) {          
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else if (response.statusCode == 401 || response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR)
        } else {
            d.resolve(body)
        }
    })
    return d.promise
}

/**
* @remote_procedure
* @label Validate Association for Backup
* @documentation This procedure is used to validate if the device is correctly associated and performs the backup process
*/
function validate(){
    getAPIkey()
        .then(getConfigBackup)
        .then(function(deviceConfiguration) {
            if (deviceConfiguration) {
                console.log("Validation successful")
                D.success()
            } else {
                console.error("Validation failed")
                D.failure(D.errorType.RESOURCE_UNAVAILABLE)
            }
        })
        .catch(function(err) {
            console.error('Error in backup procedure:', err)
            D.failure(D.errorType.GENERIC_ERROR)
        })
} 

/**
 * This function takes XML data as input and formats it with indentation to improve readability
 * It adds line breaks and indentation based on XML tags to produce a more structured format
 * @param {string} xml  The XML data to be formatted
 * @returns {string} The formatted XML data
 */
function formatXml(xml) {
    const padding = ' '.repeat(2)
    var pad = 0
    xml = xml.replace(/(>)(<)(\/*)/g, '$1\r\n$2$3')
    return xml.split('\r\n').map(function (node){
        var indent = 0
        if (node.match(/.+<\/\w[^>]*>$/)) {
            indent = 0
        } else if (node.match(/^<\/\w/) && pad > 0) {
            pad -= 1
        } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
            indent = 1
        } else {
            indent = 0
        }
        pad += indent
        return padding.repeat(pad - indent) + node
    }).join('\r\n')
}

/**
* @remote_procedure
* @label Backup Device Configuration
* @documentation This procedure backs up the device configuration 
*/
function backup(){
    getAPIkey()
        .then(getConfigBackup)
        .then(function(deviceConfiguration) {
            if (deviceConfiguration) {
                var backupResult = D.createBackup({
                    label: "Device Configuration",
                    running: formatXml(deviceConfiguration)
                })
                D.success(backupResult)
            } else {
                console.error("Unparsable output")
                D.failure(D.errorType.RESOURCE_UNAVAILABLE)
            }
        })
        .catch(function(err) {
            console.error('Error in backup procedure:', err)
            D.failure(D.errorType.GENERIC_ERROR);
        })
}