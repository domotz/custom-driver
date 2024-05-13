/**
 * Domotz Custom Driver 
 * Name: ONVIF camera monitoring
 * Description: Monitors the video capturing status of an ONVIF camera to check if capturing is still working or has stopped.
 * 
 * Communication protocols is Telnet and HTTP
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
var url = "/onvif/device_service";

var filterProfileName = D.getParameter("profileName");

// Telnet parameters
var telnetParams = {
    negotiationMandatory: false,
    port: 554
};

// Table for capturing status
var table = D.createTable(
    "Video Streaming Status",
    [
        { label: "Streaming status" }
    ]
);

/**
 * Retrieves the profiles from the ONVIF camera.
 * @returns A promise that resolves with an array of profile tokens.
 */
function getProfiles() {
    var d = D.q.defer();
    var config = {
        url: url,
        username: username,
        password: password,
        auth: "basic",
        jar: true,
        rejectUnauthorized: false,
        body: '<?xml version="1.0" encoding="UTF-8"?>\n<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:trt="http://www.onvif.org/ver10/media/wsdl">\n<soap:Body>\n<trt:GetProfiles/>\n</soap:Body>\n</soap:Envelope>' 
    };
    D.device.http.post(config, function(error, response, body){
        if (error) {          
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } else if (!response) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode == 400) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        } else {

            var $ = D.htmlParse(body);
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
    var xmlPayload = '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:trt="http://www.onvif.org/ver10/media/wsdl"><soap:Body>';

    var promises = [];
   
    profileTokens.forEach(function(profileToken) {
        var d = D.q.defer();
        var streamUris = xmlPayload + '<trt:GetStreamUri>' +
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

        var config = {
            url: url,
            username: username,
            password: password,
            auth: "basic",
            jar: true,
            rejectUnauthorized: false,
            body: streamUris
        };
                                     
        D.device.http.post(config, function(error, response, body){

            if (error) {          
                console.error(error);
                D.failure(D.errorType.GENERIC_ERROR);
            } else if (!response) {
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            } else if (response.statusCode == 400) {
                D.failure(D.errorType.AUTHENTICATION_ERROR);
            } else if (response.statusCode != 200) {
                D.failure(D.errorType.GENERIC_ERROR);
            } else {
                var $ = D.htmlParse(body);

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
                d.resolve("NOT OK");
            } else {
                d.resolve(out); 
            }
        });

        healthPromises.push(d.promise);
    });

    return D.q.all(healthPromises);
       
}

// Retrieves the capturing status and populates the Custom Driver Table
function getCapturingStatus(data){
    data.forEach(function(response, index) {
        
        var status;

        if (response.indexOf("200 OK")!=-1) {
            status = "OK";
        } else {
            status = "NOT OK"; 
        } 
        var profileName =  response.split("Content-Type: ");
        var profile = profileName[0].split("/");

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