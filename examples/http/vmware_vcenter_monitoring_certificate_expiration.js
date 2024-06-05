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
    inter_command_timeout_ms: 6000,
    global_timeout_ms: 30000,
    prompt: "$",
};

// Table to store certificates information
var table = D.createTable(
    "Certificates",
    [
        { label: "Issuer", valueType: D.valueType.STRING },
        { label: "Usage", valueType: D.valueType.STRING },
        { label: "Expiry", valueType: D.valueType.DATETIME },
        { label: "Remaining days" , unit: "Day", valueType: D.valueType.NUMBER },
        { label: "Is valid", valueType: D.valueType.STRING }
    ]
);

// Function to handle the login procedure
function login() {
    var d = D.q.defer();
    var config = {
        url: "/api/session",
        username: D.device.username(),
        password: D.device.password(),
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    };
    D.device.http.post(config, function(error, response, body){
        if (error) {          
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode == 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 201) {
            D.failure(D.errorType.GENERIC_ERROR);
        } 
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

/**
 * Function to perform HTTP GET request
 * @param {string} url The URL to send the GET request to
 * @param {object} sessionId The response from the login request, containing the session ID
 * @returns A promise containing the body of the response
 */
function httpGet(url, sessionId) {
    var d = D.q.defer();
    var config = {
        url: url,   
        protocol: "https",
        jar: true,
        rejectUnauthorized: false,
        headers: {
            "vmware-api-session-id": sessionId 
        }
    };
    D.device.http.get(config, function (error, response, body) {
        if (error) {          
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        } 
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

/**
 * Function to get TLS certificates
 * @param {object} sessionId The session ID from the login request
 * @returns A promise containing the TLS certificates information
 */
function getTLSCertificate(sessionId) {
    return httpGet("/api/vcenter/certificate-management/vcenter/tls", sessionId);   
}

/**
 * Function to get Signing certificates
 * @param {object} sessionId The session ID from the login request
 * @returns A promise containing the concatenated signing certificate chain
 */
function getSigningCertificate(sessionId) {
    return httpGet("/api/vcenter/certificate-management/vcenter/signing-certificate", sessionId)
        .then(function(certifs){
            var signingCertChain = certifs.signing_cert_chains.map(function(chain) {
                return chain.cert_chain;
            });
            var activeCertChain = certifs.active_cert_chain.cert_chain;   
            var concatenatedCertChain = signingCertChain[0].join('\n') + '\n' + activeCertChain.join('\n');
            return concatenatedCertChain;        
        });  
}

/**
 * Function to get Trusted Root certificates
 * @param {object} sessionId The session ID from the login request
 * @returns A promise containing the trusted root certificates
 */
function getTrustedRootCertificate(sessionId){
    return httpGet("/api/vcenter/certificate-management/vcenter/trusted-root-chains/", sessionId)
        .then(function (response) {
            var chainIds = response.map(function(cert){
                return cert.chain;
            });
            var promises = chainIds.map(function(chainId) {
                return httpGet("/api/vcenter/certificate-management/vcenter/trusted-root-chains/" + chainId, sessionId)
                    .then(function (certifs) {
                        var rootCertChain = certifs.cert_chain.cert_chain.map(function(chain) {
                            return chain;
                        });                   
                        return rootCertChain[0];
                    });         
            });

            return D.q.all(promises); 
        })
        .catch(function (error) {
            console.error("Error getting trusted root certificates:", error);
            D.failure(D.errorType.GENERIC_ERROR);
        });   
}

/**
 * Function to execute a command on the device via SSH
 * @param {string} certificate The certificate to be processed by the command
 * @returns A promise containing the command output
 */
function executeCommand(certificate) {
    var d = D.q.defer();
    var openShellCommand = "shell";
    var opensslCommand = 'echo "' + certificate + '" | openssl x509 -text';

    var commands = [openShellCommand, opensslCommand]; 
    sshOptions.commands = commands; 

    D.device.sendSSHCommands(sshOptions, function (out, err) {      
        if (err) {
            d.reject(err)
        } else {
            var data = JSON.stringify(out)
            if (data.indexOf("command not found") != -1){
                console.error("Command not found. Unable to retrieve certificates information.")
                D.failure(D.errorType.PARSING_ERROR);
            } else {
                d.resolve(data);
            }
        }
    });
    return d.promise;
}

/**
 * Function to calculate the remaining days until certificate expiry
 * @param {string} expiryDate The expiration date of the certificate
 * @returns {number} The number of days remaining until expiry
 */
function calculateRemainingDays(expiryDate){
    var expiryDate = new Date(expiryDate);
    var currentDate = new Date();
    return remainingDays = Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
}

/**
 * Function to check if the certificate is still valid
 * @param {number} remainingDays The number of days remaining until expiry
 * @returns {boolean} True if the certificate is valid, otherwise false
 */
function certificateValidity(remainingDays){
    return remainingDays > 0;
}

/**
 * Function to convert date to UTC format
 * @param {string} dateToConvert The date string to be converted
 * @returns {string} The date string in UTC format
 */
function convertToUTC(dateToConvert) {
    var date = new Date(dateToConvert);
    var month = (date.getUTCMonth() + 1 < 10 ? "0" : "") + (date.getUTCMonth() + 1);
    var day = (date.getUTCDate() < 10 ? "0" : "") + date.getUTCDate();
    var year = date.getUTCFullYear();
    var hours = (date.getUTCHours() < 10 ? "0" : "") + date.getUTCHours();
    var minutes = (date.getUTCMinutes() < 10 ? "0" : "") + date.getUTCMinutes();
    var seconds = (date.getUTCSeconds() < 10 ? "0" : "") + date.getUTCSeconds();
    return month + "/" + day + "/" + year + " " + hours + ":" + minutes + ":" + seconds + " UTC";
}

/**
 * Function to populate the table with certificate information
 * @param {string} serialNumber The serial number of the certificate
 * @param {string} issuer The issuer of the certificate
 * @param {string} usage The usage of the certificate
 * @param {string} expiry The expiration date of the certificate
 */
function populateTable(serialNumber, issuer, usage, expiry) {
    var remainingDays = calculateRemainingDays(expiry);
    var isValid = certificateValidity(remainingDays);
    var expiryUTC = convertToUTC(expiry)
    var cleanedUsage = usage.filter(function(value) {
        return value.trim() !== '' && value.trim() !== '[]';
    }).join(', ');

    table.insertRecord(
        serialNumber, [issuer, cleanedUsage, expiryUTC, remainingDays, isValid]
    );
}

/**
 * Function to process vCenter certificates information and populate the table
 * @param {Array} data The array containing certificate information
 */
function vCenterCertificatesInfo (data){  
    data.forEach(function(certificatesInfo){
        certificates =  certificatesInfo.replace(/ +(?= )/g,'').trim();
        var usageInfo = certificatesInfo.split("Key Usage:")[1];
        var usage = usageInfo.split("\\r\\n", 2);
        
        var cleanedData = certificatesInfo.replace(/\\r\\n/g, '\n').replace(/ +(?= )/g,'').trim();
        var serialNumberMatch = cleanedData.match(/Serial Number:\s*([^]+?)\s*Signature Algorithm:/);
        var serialNumber = serialNumberMatch ? serialNumberMatch[1] : "N/A";

        var ouMatch = cleanedData.match(/OU = ([^,]+?)\s*Validity/);
        var ouInfo = ouMatch ? ouMatch[1] : "N/A";

        var oMatch = cleanedData.match(/O = ([^,]+)/);
        var oInfo = oMatch ? oMatch[1] : "N/A";

        var notAfterMatch = cleanedData.match(/Not After\s*:\s*([^]+?)\s*Subject:/);
        var expiry = notAfterMatch ? notAfterMatch[1] : "N/A";

        populateTable(serialNumber, ouInfo + " - " + oInfo, usage, expiry);
    });
    D.success(table);
}

/**
 * Function to load all certificates
 * @param {string} sessionId  The session ID for authentication
 * @returns An array of promises for certificate retrieval
 */
function loadCertificates(sessionId){
    return D.q.all([
        getTLSCertificate(sessionId),
        getSigningCertificate(sessionId),
        getTrustedRootCertificate(sessionId)
    ]);
}

/**
 * @remote_procedure
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the VMWare vCenter device
 */
function validate(){
    login()
        .then(loadCertificates)
        .then(function (response) {
            if (response) {
                console.info("Data available");
                D.success();
            } else {
                console.error("No data available");
                D.failure(D.errorType.GENERIC_ERROR);
            }
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get VMware vCenter Certificates Information
 * @documentation This procedure is used to retrieves and stores certificates information for 
 */
function get_status() {
    login()
        .then(loadCertificates)
        .then(function(data){   
            var tlsInfo = data[0];
            var serialNumber = tlsInfo.serial_number;
            var ouInfo = tlsInfo.issuer_dn.match(/OU=([^,]+)/)[1];
            var oInfo = tlsInfo.issuer_dn.match(/O=([^,]+)/)[1];
            var issuer = ouInfo + " - " + oInfo;
            var expiry = tlsInfo.valid_to;
            var usage = tlsInfo.key_usage;

            populateTable(serialNumber, issuer, usage, expiry);
    
            return D.q.all([
                executeCommand(data[1]),
                executeCommand(data[2])
            ]);
        })
        .then(vCenterCertificatesInfo)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}