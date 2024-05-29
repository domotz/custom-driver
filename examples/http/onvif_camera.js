/**
 * Domotz Custom Driver 
 * Name: ONVIF camera monitoring
 * Description: Monitors the video capturing status of an ONVIF camera to check if capturing is still working or has stopped.
 * 
 * Communication protocol is ONVIF
 * 
 * Tested on LILIN camera model LD2222
 *
 * Creates a Custom Driver table  with video capturing status for each camera profiles
 * 
 **/

// Device credentials
var username = D.device.username();
var password = D.device.password();

// Table for Streaming status
var table = D.createTable(
    "Video Streaming Status",
    [
        { label: "Streaming status" }
    ]
);

// HTTP request parameters
var url = "/onvif/device_service"; 

// This parameter specifies which camera profile's video capturing status to monitor
// Example usage:
// profileName = ["Profile1", "Profile2"] to monitor specific profiles
// or
// profileName = ["All"] to monitor all profiles.
var profileName = D.getParameter("profileName");

// ONVIF port parameter
// The port number can be found in the camera's manual or through the camera's admin web app settings. Default is 80.
var onvifPort = D.getParameter("onvifPort");

var telnetParams = {
    negotiationMandatory: false,
    port: 554
};

// Generate nonce for digest authentication
var nonce = Math.random().toString(36).substring(2,7);
var currentDate = new Date();

// The current timestamp in UTC format required for the Created element in the digest authentication
var created =
    currentDate.getUTCFullYear() + "-" +
    ((currentDate.getUTCMonth() + 1) < 10 ? "0" : "") + (currentDate.getUTCMonth() + 1) + "-" +
    (currentDate.getUTCDate() < 10 ? "0" : "") + currentDate.getUTCDate() + "T" +
    (currentDate.getUTCHours() < 10 ? "0" : "") + currentDate.getUTCHours() + ":" +
    (currentDate.getUTCMinutes() < 10 ? "0" : "") + currentDate.getUTCMinutes() + ":" +
    (currentDate.getUTCSeconds() < 10 ? "0" : "") + currentDate.getUTCSeconds() + "Z";

// Combine nonce, created timestamp, and password to create the string for hashing
var combinedString =  nonce + created + password;
// Hash the combined string using SHA1 and encode it in base64 for the Password Digest
var passwordDigest = D.crypto.hash(combinedString, 'sha1', null, 'base64');

/**
 * Generates the security envelope for SOAP requests.
 * @returns {string} The security envelope
 */
function getSecurityEnvelope() {
    return '<wsse:Security>' +
           '<wsse:UsernameToken>' +
           '<wsse:Username>' + username + '</wsse:Username>' +
           '<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">' + passwordDigest + '</wsse:Password>' +
           '<wsse:Nonce>' + D._unsafe.buffer.from(nonce).toString('base64') + '</wsse:Nonce>' +
           '<wsse:Created>' + created + '</wsse:Created>' +
           '</wsse:UsernameToken>' +
           '</wsse:Security>';
}

/**
 * Sends a SOAP request and returns a promise with the parsed response.
 * @param {string} body  The SOAP request body.
 * @param {function} parseResponse  A function to parse the response body.
 * @returns A promise that resolves with the parsed response.
 */
function sendSoapRequest(body, parseResponse) {
    var d = D.q.defer();
    var config = {
        url: url,
        username: username,
        password: password,
        port: onvifPort,
        body: body
    };
    D.device.http.post(config, function(error, response, body) {
        if (error) {
            console.error(error);
            d.reject(D.errorType.GENERIC_ERROR);
        } else if (!response) {
            d.reject(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode == 400) {
            d.reject(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 200) {
            d.reject(D.errorType.GENERIC_ERROR);
        } else {
            var result = parseResponse(body);
            d.resolve(result);
        }
    });
    return d.promise;
}

/**
 * Retrieves profile tokens.
 * @returns A promise that resolves with an array of profile tokens.
 */
function getProfiles() {
    var payload = '<?xml version="1.0" encoding="UTF-8"?>' +
                   '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:trt="http://www.onvif.org/ver10/media/wsdl" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext1.0.xsd">' +
                   '<soap:Header>' + getSecurityEnvelope() + '</soap:Header>' +
                   '<soap:Body>' +
                   '<trt:GetProfiles/>' +
                   '</soap:Body>' +
                   '</soap:Envelope>';

    return sendSoapRequest(payload, function(body) {
        var $ = D.htmlParse(body);
        console.log(body);
        var profiles = $("trt\\:Profiles");
        var profileTokens = [];
        profiles.each(function(index, element) {
            var token = $(element).attr("token");
            profileTokens.push(token);
        });
        return profileTokens;
    });
}

/**
 * Retrieves the stream URIs for each profile token.
 * @param {Array} profileTokens - Array of profile tokens.
 * @returns A promise that resolves with an array of stream URIs.
 */
function getStreamURIs(profileTokens) {
    var startPayload = '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:trt="http://www.onvif.org/ver10/media/wsdl">' +
                       '<soap:Header>' + getSecurityEnvelope() + '</soap:Header>' +
                       '<soap:Body>';
    var endPayload = '</soap:Body></soap:Envelope>';
    var promises = profileTokens.map(function(profileToken) {
        var payload = startPayload + '<trt:GetStreamUri>' +
                                    '<trt:StreamSetup>' +
                                    '<trt:Stream xmlns:trt="http://www.onvif.org/ver10/media/wsdl">RTP-Unicast</trt:Stream>' +
                                    '<trt:Transport xmlns:trt="http://www.onvif.org/ver10/media/wsdl">' +
                                    '<trt:Protocol>RTSP</trt:Protocol>' +
                                    '</trt:Transport>' +
                                    '</trt:StreamSetup>' +
                                    '<trt:ProfileToken>' + profileToken + '</trt:ProfileToken>' +
                                    '</trt:GetStreamUri>' + endPayload;

        return sendSoapRequest(payload, function(body) {
            var $ = D.htmlParse(body);
            var uris = [];
            $("tt\\:Uri").each(function(index, element) {
                uris.push($(element).text());
            });
            return { profileName: profileToken, uris: uris }; 
        });
    });

    return D.q.all(promises);

}

/**
 * Retrieves the nonce and realm values from the WWW-Authenticate header of an RTSP DESCRIBE request.
 * @param {string} uri The RTSP URI to send the DESCRIBE request to.
 * @returns {Promise} A promise that resolves with an object containing the realm and nonce values.
 */
function getNonceAndRealm(uri) {
    var d = D.q.defer();
    var command = "DESCRIBE " + uri + " RTSP/1.0\r\nCSeq: 1\r\n";
    telnetParams.command = command;

    D.device.sendTelnetCommand(telnetParams, function(out, err) {
        if (err) {
            d.reject("Initial request failed: " + err);
        } else {
            var authenticateHeaderArray = out.match(/WWW-Authenticate: (.+)/);
            if (authenticateHeaderArray && authenticateHeaderArray[1]) {
                var authenticateHeader = authenticateHeaderArray[1];
                var realmMatch = authenticateHeader.match(/realm="([^"]*)"/);
                var nonceMatch = authenticateHeader.match(/nonce="([^"]*)"/);

                if (realmMatch && nonceMatch) {
                    var realm = realmMatch[1];
                    var nonce = nonceMatch[1];
                    d.resolve({ realm: realm, nonce: nonce });
                } else {
                    d.reject("realm or nonce not found in WWW-Authenticate header");
                }
            } else {
                d.resolve({ realm: "", nonce: "" });
            }
        }
    });
    return d.promise;
}

/**
 * Generates the Digest Authorization header for RTSP requests.
 * @param {string} realm The realm value from the WWW-Authenticate header.
 * @param {string} nonce The nonce value from the WWW-Authenticate header.
 * @param {string} uri The RTSP URI.
 * @param {string} method The RTSP method
 * @returns {string} The Digest Authorization header.
 */
function generateDigestAuth(realm, nonce, uri, method) {
    var hash1 = D.crypto.hash(username + ":" + realm + ":" + password, "md5", "utf8", "hex");
    var hash2 = D.crypto.hash(method + ":" + uri, "md5", "utf8", "hex");
    var response = D.crypto.hash(hash1 + ":" + nonce + ":" + hash2, "md5", "utf8", "hex");
    var authHeader = 'Digest username="' + username + '", realm="' + realm + '", nonce="' + nonce + '", uri="' + uri + '", response="' + response + '"';
    return authHeader;
}

/**
 * Checks the health of the camera connection.
 * @param {Array} streamUrisProfiles Array of objects containing profile names and corresponding stream URIs.
 * @returns A promise that resolves with an array of health statuses.
 */
function healthCheck(streamUrisProfiles) {
    var healthPromises = [];

    streamUrisProfiles.forEach(function(stream) {
        var profileName = stream.profileName;
        var uris = stream.uris;
        uris.forEach(function(uri) {
            var d = D.q.defer();
            getNonceAndRealm(uri)
                .then(function(digestParams) {
                    var authHeader = generateDigestAuth(digestParams.realm, digestParams.nonce, uri, "DESCRIBE");
                    var command = "DESCRIBE " + uri + " RTSP/1.0\r\nCSeq: 2\r\nAuthorization: " + authHeader + "\r\n";
                    telnetParams.command = command;
                    telnetParams.timeout = 1000;
                    D.device.sendTelnetCommand(telnetParams, function(out, err) {
                        if (err) {
                            console.log(err);
                        } else {
                            d.resolve({ healthStatus: out, profileName: profileName });
                        }
                    });
                }).catch(function(error) {
                    console.log(error);
                    d.resolve({ healthStatus: "NOT OK", profileName: profileName });
                });

            healthPromises.push(d.promise);
        });
    });
    return D.q.all(healthPromises);
}

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Retrieves the capturing status and populates the Custom Driver Table
function getCapturingStatus(data){
    data.forEach(function(response, index) {
        var status;
        if (response.healthStatus.indexOf("200 OK") != -1) {
            status = "OK";
        } else {
            status = "NOT OK"; 
        } 
         
        var name = response.profileName; 
        var recordId = (index + 1) + "-" + name;

        if (profileName[0].toLowerCase() === "all" || profileName.indexOf(name) !== -1 ) {

            table.insertRecord(sanitize(recordId), [status]);
        }
    });
    D.success(table);
}

function failure(err) {
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    getProfiles()
        .then(getStreamURIs)
        .then(healthCheck)
        .then(function (output) {
            if (output) {
                console.info("Validation successful");
                D.success();
            } else {
                console.error("Unexpected output from ONVIF Camera");
                D.failure(D.errorType.GENERIC_ERROR);
            }
        })
        .catch(failure);
}

/**
* @remote_procedure
* @label Get Video Capturing Status
* @documentation This procedure retrieves the current status of video capturing from the camera's streams
*/
function get_status() {
    getProfiles()
        .then(getStreamURIs)
        .then(healthCheck)
        .then(getCapturingStatus)
        .catch(failure);
}