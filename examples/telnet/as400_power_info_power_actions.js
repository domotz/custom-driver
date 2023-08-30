/**
 * Domotz Custom Driver 
 * Name: AS400 Power Info and Power Actions
 * Description:  Monitors power information and enables power actions (Reboot and Shoutdown) on an AS400 IBM server.
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
    "Power Info",
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
 * Function to handle AS400 menu option and retrieve power info
 * @param {string} result - Information returned by the AS400 server
 * @returns {Promise} A promise that resolves after parsing power info
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
 * Function to parse AS400 power information and populate the table
 * @param {string} results  Information returned by the AS400 server
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
* @remote_procedure
* @label Get AS400 Power Info
* @documentation This procedure is used for retrieving AS400 power information
*/
function get_status() {
    getAS400Info()
        .then(powerParsing)
        .then(parseInfo)
        .then(D.success)
        .catch(failure);
}

/**
 * @remote_procedure
 * @label Reboot AS400
 * @documentation This procedure initiate a reboot of the AS400 server
 */
function custom_1(){
    telnetParams.command = telnetParams.command = command + "4\r\n\x1b[29~";
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
 * @label Shutdown AS400 
 * @documentation This procedure sends a shutdown command to the AS400 server.
 */
function custom_2(){
    telnetParams.command = command + "3\r\n";
    telnet(telnetParams, function (out, err) {
        if (err) {
            console.error("Error while sending shutdown command: " + telnetParams.command);
            failure(err);
        } else {
            D.success();
        }
    });
}