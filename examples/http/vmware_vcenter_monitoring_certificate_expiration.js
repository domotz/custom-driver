/**
 * Domotz Custom Driver
 * Name: VMWare vCenter Monitoring Certificate expiration
 * Description: This script is designed to retrieve and monitor VMware vCenter certificates, ensuring their validity by checking their expiration dates.
 * It extracts information for four types of vCenter server certificates: Machine SSL certificates, VMware Certificate Authority, STS Signing Certificates, and Trusted Root certificates.
 * 
 * Communication protocols is HTTPS and SSH
 * 
 * Tested on VMWare vCenter version 8.0.2
 * 
 * Creates Custom Driver table containing the following columns:
 *      - Issuer: The issuer of the certificate
 *      - Usage: The usage of the certificate
 *      - Expiry: The expiration date of the certificate
 *      - Remaining days: The number of days remaining until the certificate expires
 *      - Is valid: Indicates if the certificate is still valid
 * 
 **/

// SSH options configuration
var sshOptions = {
    inter_command_timeout_ms: 1000,
    global_timeout_ms: 10000,
    prompt_regex: /Command>|[$]/
}

// Table to store certificates information
var table = D.createTable(
    "Certificates",
    [
        { label: "Issuer", valueType: D.valueType.STRING },
        { label: "Usage", valueType: D.valueType.STRING },
        { label: "Expiry", valueType: D.valueType.DATETIME },
        { label: "Remaining days" , unit: "days", valueType: D.valueType.NUMBER },
        { label: "Is valid", valueType: D.valueType.STRING }
    ]
)

/**
 * Function to generate configuration options for HTTP requests
 * @param {string} url The URL to send the request to
 * @returns {object} The configuration object with URL, protocol, jar, and rejectUnauthorized properties
 */
function generateConfig (url) {
    return {
        url: url,
        protocol: "https",
        jar: true,
        rejectUnauthorized: false
    }
}

// Function to handle the login procedure
function login () {
    var d = D.q.defer()
    var config = generateConfig("/api/session")
    config.auth = "basic"
    config.username = D.device.username()
    config.password = D.device.password()
    D.device.http.post(config, function (error, response, body){
        if (error) {          
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else if (response.statusCode == 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        } else if (response.statusCode != 201) {
            D.failure(D.errorType.GENERIC_ERROR)
        } 
        d.resolve(JSON.parse(body))
    })
    return d.promise
}

/**
 * Function to perform HTTP GET request
 * @param {string} url The URL to send the GET request to
 * @param {object} sessionId The response from the login request, containing the session ID
 * @returns A promise containing the body of the response
 */
function httpGet (url, sessionId) {
    var d = D.q.defer()
    var config = generateConfig(url)
    config.headers = {
        "vmware-api-session-id": sessionId 
    },
    D.device.http.get(config, function (error, response, body) {
        if (error) {          
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR)
        } 
        d.resolve(JSON.parse(body))
    })
    return d.promise
}

/**
 * Function to get TLS certificates
 * @param {object} sessionId The session ID from the login request
 * @returns A promise containing the TLS certificates information
 */
function getTLSCertificate (sessionId) {
    return httpGet("/api/vcenter/certificate-management/vcenter/tls", sessionId)
}

/**
 * Function to get Signing certificates
 * @param {object} sessionId The session ID from the login request
 * @returns A promise containing the concatenated signing certificate chain
 */
function getSigningCertificate (sessionId) {
    return httpGet("/api/vcenter/certificate-management/vcenter/signing-certificate", sessionId)
        .then(function(certifs){
            var signingCertChain = certifs.signing_cert_chains.map(function(chain) {
                return chain.cert_chain
            })
            var activeCertChain = certifs.active_cert_chain.cert_chain
            var concatenatedCertChain = signingCertChain[0].join('\n') + '\n' + activeCertChain.join('\n')
            return concatenatedCertChain
        })
}

/**
 * Function to get Trusted Root certificates
 * @param {object} sessionId The session ID from the login request
 * @returns A promise containing the trusted root certificates
 */
function getTrustedRootCertificate (sessionId){
    return httpGet("/api/vcenter/certificate-management/vcenter/trusted-root-chains/", sessionId)
        .then(function (response) {
            var chainIds = response.map(function(cert){
                return cert.chain
            })
            var promises = chainIds.map(function(chainId) {
                return httpGet("/api/vcenter/certificate-management/vcenter/trusted-root-chains/" + chainId, sessionId)
                    .then(function (certifs) {
                        var rootCertChain = certifs.cert_chain.cert_chain.map(function(chain) {
                            return chain
                        })                   
                        return rootCertChain[0]
                    })       
            })
            return D.q.all(promises)
        })
        .catch(function (error) {
            console.error("Error getting trusted root certificates:", error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * Function to load all certificates
 * @param {string} sessionId  The session ID for authentication
 * @returns An array of promises for certificate retrieval
 */
function loadCertificates (sessionId){
    return D.q.all([
        getTLSCertificate (sessionId),
        getSigningCertificate (sessionId),
        getTrustedRootCertificate (sessionId)
    ])
}

/**
 * Function to generate SSH commands for certificate processing
 * @param {Array} certificates An array containing certificate data
 * @returns {Array} An array of SSH commands for processing certificates
 */
function genarateCommands (certificates) {
    return [
        'shell.set --enabled true', // Command to enable the shell
        'shell', // Command to enter the shell
        'echo "' + certificates[1] + '" | openssl x509 -text', // OpenSSL command for Signing Certificate
        'echo "' + certificates[2] + '" | openssl x509 -text' // OpenSSL command for Trusted Root Certificate
    ]
}

/**
 * Function to execute a command on the device via SSH
 * @param {string} certificate The certificate to be processed by the command
 * @returns A promise containing the command output
 */
function executeCommands (certificates) {
    var d = D.q.defer()
    sshOptions.commands = genarateCommands(certificates)
    D.device.sendSSHCommands(sshOptions, function (out, err) {
        if (err) {
            d.reject(err)
        } else {
            var data = JSON.stringify(out)
            if (data.indexOf("command not found") != -1){
                console.error("Command not found. Unable to retrieve certificates information.")
                D.failure(D.errorType.PARSING_ERROR)
            } else {
                d.resolve(data)
            }
        }
    })
    return d.promise
}

/**
 * Function to calculate the remaining days until certificate expiry
 * @param {string} expiryDate The expiration date of the certificate
 * @returns {number} The number of days remaining until expiry
 */
function calculateRemainingDays(expiryDate){
    var currentDate = new Date()
    var remainingDays = Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24))
    return remainingDays >= 0 ? remainingDays : 0
}

/**
 * Function to check if the certificate is still valid
 * @param {number} remainingDays The number of days remaining until expiry
 * @returns {boolean} True if the certificate is valid, otherwise false
 */
function certificateValidity(remainingDays){
    return remainingDays > 0
}

/**
 * Function to convert date to UTC format
 * @param {string} dateToConvert The date string to be converted
 * @returns {string} The date string in UTC format
 */
function convertToUTC(dateToConvert) {
    var date = new Date(dateToConvert)
    var month = (date.getUTCMonth() + 1 < 10 ? "0" : "") + (date.getUTCMonth() + 1)
    var day = (date.getUTCDate() < 10 ? "0" : "") + date.getUTCDate()
    var year = date.getUTCFullYear()
    var hours = (date.getUTCHours() < 10 ? "0" : "") + date.getUTCHours()
    var minutes = (date.getUTCMinutes() < 10 ? "0" : "") + date.getUTCMinutes()
    var seconds = (date.getUTCSeconds() < 10 ? "0" : "") + date.getUTCSeconds()
    return month + "/" + day + "/" + year + " " + hours + ":" + minutes + ":" + seconds + " UTC"
}

/**
 * Function to populate the table with certificate information
 * @param {string} serialNumber The serial number of the certificate
 * @param {string} issuer The issuer of the certificate
 * @param {string} usage The usage of the certificate
 * @param {string} expiry The expiration date of the certificate
 */
function populateTable(serialNumber, issuer, usage, expiry) {
    var remainingDays = calculateRemainingDays(new Date(expiry))
    var isValid = certificateValidity(remainingDays)
    var expiryUTC = convertToUTC(expiry)
    var cleanedUsage = usage.filter(function(value) {
        return value.trim() !== ''
    }).join(', ')
    table.insertRecord(
        serialNumber, [issuer, cleanedUsage, expiryUTC, remainingDays, isValid]
    )
}

/**
 * Function to extract certificate information from command output
 * @param {string} data The command output containing certificate information
 */
function extractCertificatesInfo (data){  
    var certificatesInfo = data.split("echo")
      for (var i = 1; i < certificatesInfo.length; i++) {
        var cleanedData = certificatesInfo[i].replace(/ +(?= )/g, '').trim()
        var serialNumberInfo = cleanedData.split("Serial Number:")[1]
        var serialNumber = serialNumberInfo.split("\\r\\n ", 2)
        var ouInfo = cleanedData.split("OU = ")[1]
        var organizationalUnit = ouInfo.split("\\r\\n", 1)
        var oInfo = cleanedData.split("O = ")[1]
        var organization = oInfo.split(",", 1)
        var issuer = organizationalUnit[0] + " - " + organization[0]
        var usageInfo = cleanedData.split("Key Usage: ")[1].trim()
        var usage = usageInfo.split("\\r\\n ", 2)   
        var notAfterInfo = cleanedData.split("Not After : ")[1]
        var expiry = notAfterInfo.split("\\r\\n ", 1)
        populateTable(serialNumber[1], issuer, usage, expiry[0])
    }
    D.success(table)
}

/**
 * @remote_procedure
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the VMWare vCenter device
 */
function validate (){
    login()
        .then(loadCertificates)
        .then(executeCommands)
        .then(function (response) {
            if (response) {
                console.info("Data available")
                D.success()
            } else {
                console.error("No data available")
                D.failure(D.errorType.GENERIC_ERROR)
            }
        })
        .catch(function (err) {
            console.error(err)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * @remote_procedure
 * @label Get VMware vCenter Certificates Information
 * @documentation This procedure is used to retrieve and store certificates information for VMware vCenter
 */
function get_status() {
    login()
        .then(loadCertificates)
        .then(function(data){   
            var tlsInfo = data[0]
            var tlsSerialNumber = tlsInfo.serial_number
            var tlsOU = tlsInfo.issuer_dn.match(/OU=([^,]+)/)[1]
            var tlsO = tlsInfo.issuer_dn.match(/O=([^,]+)/)[1]
            var tlsIssuer = tlsOU + " - " + tlsO
            var tlsUsage = tlsInfo.key_usage
            var tlsExpiry = tlsInfo.valid_to
            populateTable(tlsSerialNumber, tlsIssuer, tlsUsage, tlsExpiry)
            return executeCommands(data)
        })
        .then(extractCertificatesInfo)
        .catch(function (err) {
            console.error(err)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}