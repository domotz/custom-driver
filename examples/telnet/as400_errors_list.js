
/**
 * Domotz Custom Driver 
 * Name: AS400
 * Description: This script can monitor the AS400 IBM servers errors list
 *   
 * Communication protocol is telnet
 * 
 * Tested on AS400 version :
 *       *BASE   5050     
 *       *CODE   QSYS      V6R1M1 L00
 * 
 * Return a table with this columns:
 *      - id: Problem ID
 *      - Error code: System Reference Code
 *      - Error Date: Date and Time of Detection
 * 
 * Creates a custom driver variable for AS400 errors: Errors No.
 * 
**/
var telnet = D.device.sendTelnetCommand;
var deviceUsername = D.device.username();
var devicePassword = D.device.password();
var command = deviceUsername + "\t" + devicePassword + "\r\n\r\nWRKPRB\r\n";

// Telnet parameters for communication with the AS400 server
var telnetParams = {
    negotiationMandatory: false,
    shellPrompt: /.*Utente.*/,
    timeout: 10000
};

var table = D.createTable(
    "AS400",
    [
        { label: "Error Code" },
        { label: "Error Date" },
    ]
);

/**
 * Function to get AS400 information via telnet
 * @returns Promise that waits for the telnet command 
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
function errorParsing(result) {
    var errorCount = result.split("READY").length - 1;
    var errorCheckCmds = [];
    for (var i = 0; i < errorCount; i++) {
        errorCheckCmds.push("5\r\n\r\n\x1B[B");
    }
    var errorCheck = errorCheckCmds.join("");
    telnetParams.command = command + errorCheck;
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

/**
 * Function to parse AS400 information and populate the table
 * @param {[string]} results list of information returned by the AS400 server
 * @returns The populated table with AS400 errors information
 */
function parseInfo(results) {
    var srcs = results.match(/SRC[^ ]*/g);
    var dates = results.match(/\d\d\/\d\d\/\d\d\s+\d\d:\d\d:\d\d/g);
    var problemIds = results.match(/ID problema[\s\.\:]*\d{10}/g);  
    for (var i = 0; i < problemIds.length; i++) {
        var problemIdRow = problemIds[i].split(" ");
        table.insertRecord(problemIdRow[problemIdRow.length - 1], [
            srcs[i],
            dates[i]
        ]);
    }
    var errorsCount = [
        D.createVariable("errorsNo", "Errors No", problemIds.length)
    ];
    console.info("Number Of Errors: " + problemIds.length)
    D.success(errorsCount, table);
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
* @label Get Device Variables
* @documentation This procedure is used for retrieving the status of AS400 server errors 
*/
function get_status() {
    getAS400Info()
        .then(errorParsing)
        .then(parseInfo)
        .then(D.success)
        .catch(failure);
}