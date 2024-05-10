/**
 * Domotz Custom Driver 
 * Name: ONVIF camera monitoring
 * Description: Monitors the video capturing status of an ONVIF camera to check if capturing is still working or has stopped.
 * 
 * Communication protocol is telnet
 * 
 * Tested on LILIN camera model LD2222
 *
 * Creates a Custom Driver table  with video capturing status for each camera profiles
 * 
 **/

// Device credentials
var username = D.device.username();
var password = D.device.password();

// Encoding credentials for authorization
var authString = username + ":" + password;
var base64AuthString = D._unsafe.buffer.from(authString).toString('base64');

// HTTP request parameters
var method = "POST";
var endpoint = "/onvif/device_service";
var host = D.device.ip();

//Http command to send requests to the ONVIF device 
var command = method + ' ' + endpoint + ' HTTP/1.1\r\nHost: ' + host + '\r\nAuthorization: Basic ' + base64AuthString + '\r\n\r\n';

var filterProfileName = D.getParameter("profileName");

//HTttp parameters 
var httpParams = {
    port: 80,
    negotiationMandatory: false,
};

// Telnet parameters
var telnetParams = {
    negotiationMandatory: false,
    port: 554
};

/**
 * Retrieves the profiles from the ONVIF camera.
 * @returns A promise that resolves with an array of profile tokens.
 */
function getProfiles() {
    var d = D.q.defer();
    // SOAP request to retrieve profiles
    var xmlProfiles = '<?xml version="1.0" encoding="UTF-8"?>\r\n' + 
                      '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:trt="http://www.onvif.org/ver10/media/wsdl">\r\n' + 
                      '<soap:Body>\r\n' + 
                      '<trt:GetProfiles/>\r\n' + 
                      '</soap:Body>\r\n' + 
                      '</soap:Envelope>\r\n';

    httpParams.command = command + xmlProfiles;
    D.device.sendTelnetCommand(httpParams, function (out, err) {
        if (err) {
            failure(err);
        }
        else if (!out) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        else if (out.indexOf("The action requested requires authorization and the sender is not authorized") != -1) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } 
        else {
            var $ = D.htmlParse(out);
            var profiles = $("trt\\:Profiles"); 
            var profileTokens = [];
            profiles.each(function(index, element) {
                var token = $(element).attr("token");
                profileTokens.push(token);
            });
            d.resolve(profileTokens);
        }
    });
    return d.promise;
}

/**
 * Retrieves the stream URIs for each profile token
 * @param {Array} profileTokens Array of profile tokens
 * @returns A promise that resolves with an array of stream URIs
 */
function getStreamURIs(profileTokens){
    var xmlStreamUris = '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:trt="http://www.onvif.org/ver10/media/wsdl">';
        xmlStreamUris += '<soap:Body>';

    var promises = [];

    profileTokens.forEach(function(profileToken) {
        var d = D.q.defer();
        var streamUris = xmlStreamUris + '<trt:GetStreamUri>' +
                                         '<trt:StreamSetup>' +
                                         '<trt:Stream xmlns:trt="http://www.onvif.org/ver10/media/wsdl">RTP-Unicast</trt:Stream>' +
                                         '<trt:Transport xmlns:trt="http://www.onvif.org/ver10/media/wsdl">' +
                                         '<trt:Protocol>RTSP</trt:Protocol>' +
                                         '</trt:Transport>' +
                                         '</trt:StreamSetup>' +
                                         '<trt:ProfileToken>' + profileToken + '</trt:ProfileToken>' +
                                         '</trt:GetStreamUri>' +
                                         '</soap:Body>' +
                                         '</soap:Envelope>';

        httpParams.command = command + streamUris;

        D.device.sendTelnetCommand(httpParams, function(out, err) {
            if (err) {
                d.reject(err);
            } else if (!out) {
                d.reject(D.errorType.RESOURCE_UNAVAILABLE);
            } else if (out.indexOf("The action requested requires authorization and the sender is not authorized") !== -1) {
                d.reject(D.errorType.AUTHENTICATION_ERROR);
            } else {
                var $ = D.htmlParse(out);
                $("tt\\:Uri").each(function(index, element) {
                    var uri = $(element).text();
                    d.resolve(uri);
                });
            }
        });
        promises.push(d.promise);
    });
    return D.q.all(promises);
}

/**
 * Checks the health of the camera connection.
 * @param {Array} streamUris Array of stream URIs.
 * @returns A promise that resolves with an array of health statuses.
 */
function healthCheck(streamUris) {
    var healthPromises = [];

    streamUris.forEach(function(uri) {
        var d = D.q.defer();
        var command = "DESCRIBE " + uri + " RTSP/1.0\r\nCSeq: 1\r\nAuthorization: Basic " + base64AuthString + "\r\n";
        telnetParams.command = command;
        D.device.sendTelnetCommand(telnetParams, function(out, err) {
            if (err) {
               d.resolve("NOT OK")
            } else {
                d.resolve(out); 
            }
        });

        healthPromises.push(d.promise);
    });

    return D.q.all(healthPromises)
       
}

// Table for capturing status
var table = D.createTable(
    "Video Streaming Status",
    [
        { label: "Streaming status" }
    ]
);


// Retrieves the capturing status and populates the Custom Driver Table
function getCapturingStatus(data){
    data.forEach(function(response, index) {
        
        var status;

        if (response.indexOf("200 OK")!=-1) {
            status = "OK"
        } else {
            status = "NOT OK"; 
        } 
        var profileName =  response.split("Content-Type: ")
        var profile = profileName[0].split("/")

        if (!filterProfileName || profile[4] === filterProfileName || filterProfileName === "ALL") {
            var recordId = (index + 1) + "-" + profile[4];
            table.insertRecord(recordId, [status]);
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
