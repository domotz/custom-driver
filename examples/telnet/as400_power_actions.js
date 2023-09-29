/**
 * Domotz Custom Driver 
 * Name: AS400 Power Actions
 * Description:  Enables power actions (Reboot and Shoutdown) on an AS400 IBM server from the Domotz app.
 *   
 * Communication protocol is telnet
 * 
 * Tested on AS400 version :
 *       *BASE   5050     
 *       *CODE   QSYS      V6R1M1 L00
 * 
 * 
**/

var telnet = D.device.sendTelnetCommand;
var deviceUsername = D.device.username();
var devicePassword = D.device.password();
var command = deviceUsername + "\t" + devicePassword + "\r\n\r\ngo power\r\n";

// Telnet parameters for communication with the AS400 server
var telnetParams = {
    negotiationMandatory: false,
    shellPrompt: /.*Utente.*/,
    timeout: 10000
};


/**
 * Function to get AS400 power information via telnet
 * @returns {Promise} A promise that resolves after executing the telnet command 
 */
function getAS400Info() {
    var d = D.q.defer();
    telnetParams.command = command;
    telnet(telnetParams, function (out, err) {
        if (err) {
            console.error("error while executing command: " + telnetParams.command);
            failure(err);
        }
        d.resolve(out);
    });
    return d.promise;
}

// Function to handle errors
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
    getAS400Info()
        .then(function (output) {
            if (output) {
                console.info("Validation successful");
                D.success();
            } else {
                console.error("Unexpected output from AS400");
                D.failure(D.errorType.GENERIC_ERROR);
            }
        })
        .catch(failure);
}

/**
* @remote_procedure
* @label Get AS400 Power Info
* @documentation This procedure is used for retrieving AS400 power information
*/
function get_status() {
    getAS400Info()
        .then(function(){
            D.success()
        })
        .catch(failure);
}

/** 
 * @remote_procedure
 * @label Reboot
 * @documentation this button reboots the AS400 server.
 */
function custom_1(){
    telnetParams.command = command + "4\r\n\x1b[29~";
    telnet(telnetParams, function (out, err) {
        if (err) {
            console.error("Error while sending reboot command: " + telnetParams.command);
            failure(err);
        } else {
            D.success();
        }
    });
}

/**
 * @remote_procedure
 * @label Shutdown 
 * @documentation Pressing this button will shutdown the AS400 server.
 */
function custom_2(){
    telnetParams.command = command + "3\r\n\x1b[29~";
    telnet(telnetParams, function (out, err) {
        if (err) {
            console.error("Error while sending shutdown command: " + telnetParams.command);
            failure(err);
        } else {
            D.success();
        }
    });
}
