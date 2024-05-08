/**
 * Domotz Custom Driver 
 * Name: ONVIF camera monitoring
 * Description: Monitors the video capturing status of an ONVIF camera to check if capturing is still working or has stopped.
 * 
 * Communication protocol is telnet
 * 
 * Tested on LILIN camera model LD2222
 *
 * Creates a Custom Driver Variable with the status of video capturing
 * 
 **/

var username = D.device.username();
var password = D.device.password();
var host = D.device.ip();
var port = 554; //The default RTSP port
var url = "rtsp://" + host + ":" + port + "/stream0"; //The RTSP URL for video stream

var authString = username + ":" + password;
var base64AuthString = D._unsafe.buffer.from(authString).toString('base64');

var command = "DESCRIBE " + url + " RTSP/1.0\r\nCSeq: 1\r\nAuthorization: Basic " + base64AuthString + "\r\n"; 

var telnetParams = {
    port: port,
    negotiationMandatory: false,
};

// Check the health of the camera connection
function healthCheck() {
    var d = D.q.defer();
    telnetParams.command = command;
    D.device.sendTelnetCommand(telnetParams, function (out, err) {
        if (err) {
            console.error("Cannot connect to the server");
            D.failure(err);
        } else if (!out) {
            console.error("No response received from the server.");
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else {
            d.resolve(out);
        }
    });
    return d.promise;
}

// Retrieve video capture status from telnet response
function getCapturingStatus(data){
    var status;
    if (data.indexOf("200 OK")!=-1) {
        status = "OK";
    } else {
        status = "NOT OK";
    }
    var variable = [
        D.createVariable("video-capturing-status", "Video Capturing Status", status, null, D.valueType.STRING)
    ];
    D.success(variable);
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
    healthCheck()
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
* @documentation This procedure retrieves the current status of video capturing from the camera's 
*/
function get_status() {
    healthCheck()
        .then(getCapturingStatus)
        .catch(failure);
}