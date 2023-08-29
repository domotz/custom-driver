/**
 * Domotz Custom Driver 
 * Name: AS400 Power Info and Power Actions
 * Description:  Monitors AS400 IBM server power information and actions
 *   
 * Communication protocol is telnet
 * 
 * Tested on AS400 version :
 *       *BASE   5050     
 *       *CODE   QSYS      V6R1M1 L00
 * 
 * Returns a table with the following columns:
 *   - Date
 *   - Day
 *   - Power Up
 *   - Power Off
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

var table = D.createTable(
    "Power Info and Power Actions",
    [
        { label: "Date" },
        { label: "Day" },
        { label: "Power Up" },
        { label: "Power Off" }
    ]
);

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
        d.resolve(out.replace(/\\x1B\\[[0-9;]*[a-zA-Z]/g, " "));
    });
    return d.promise;
}

/**
 * Function to parse errors from AS400 information
 * @param {[string]} result  list of information returned by the AS400 server
 * @returns Promise that waits for the error parsing 
 */
function powerParsing(result) {
    var menuOptionIndex = result.indexOf("Immettere una opzione di menu");
    if (menuOptionIndex !== -1) {
        var optionCommand = "1\r\n";
        telnetParams.command = command + optionCommand; 
        var d = D.q.defer();
        telnet(telnetParams, function (out, err) {
            if (err) {
                console.error("error while executing command: " + telnetParams.command);
                failure(err);
            }
            d.resolve(out.replace(/\\x1B\\[[0-9;]*[a-zA-Z]/g, " "));
        });
        return d.promise;
    }
}

/**
* @remote_procedure
* @label Shutdown AS400 Server
* @documentation This procedure sends a shutdown command to the AS400 server.
*/
function shutdownAS400Server() {
    var shutdownCommand = "3\r\n";
    telnetParams.command = command + shutdownCommand;
    
    telnet(telnetParams, function (out, err) {
        if (err) {
            console.error("Error while sending shutdown command: " + telnetParams.command);
            failure(err);
        } else {
            console.info("Shutdown command sent successfully");
            D.success();
        }
    });
}

/**
* @remote_procedure
* @label Reboot AS400 Server
* @documentation This procedure reboots the AS400 server.
*/
function rebootAS400Server() {
    var rebootCommand = "4\r\n"; 
    telnetParams.command = command + rebootCommand;
    
    telnet(telnetParams, function (out, err) {
        if (err) {
            console.error("Error while sending reboot command: " + telnetParams.command);
            failure(err);
        } else {
            console.info("Reboot command sent successfully");
            D.success();
        }
    });
}

/**
 * Function to parse power actions from AS400 information
 * @param {string} result - Information returned by the AS400 server
 * @returns {Promise} A promise that resolves after parsing power actions 
 */
function parseInfo(results) {
    var data = results.match(/(\d+\/\d+\/\d+)\s+(\w{3})(?:\s+(\d{2}:\d{2}:\d{2})\s+(\d{2}:\d{2}:\d{2}))?/g);
    for (var i = 0; i < data.length; i++) {
        var item = data[i];
        var splitData = item.split(/\s+/);
        var date = splitData[0] || "-";
        var day = splitData[1] || "-";
        var powerUp = splitData[2] || "-";
        var powerOff = splitData[3] || "-";
        var recordId = D.crypto.hash(date + "_"+ day, "sha256", null, "hex").slice(0, 50);
        table.insertRecord(recordId,[date, day, powerUp, powerOff]);
    }
    D.success(table);
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
 * Function to parse AS400 power information and populate the table
 * @param {string} results - Information returned by the AS400 server
 * @returns {void} Populates the table with AS400 power information
 */
function get_status() {
    getAS400Info()
        .then(powerParsing)
        .then(parseInfo)
        .then(D.success)
        .catch(failure);
}