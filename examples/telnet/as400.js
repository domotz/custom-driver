
var telnet = D.device.sendTelnetCommand;

var deviceUsername = D.device.username();
var devicePassword = D.device.password();
var command = deviceUsername + "\t" + devicePassword + "\r\n\r\nWRKPRB\r\n"
var telnetParams = {
    negotiationMandatory: false,
    shellPrompt: /.*Utente.*/,
    timeout: 10000
};

var table = D.createTable(
    "AS400",
    [
        { label: "Codice riferimento sistema" },
        { label: "Data e ora di rilevazione" },
    ]
);

/**
 * 
 * @returns Promise wait for redis information
 */
function getAS400Info() {
    var d = D.q.defer();
    telnetParams.command = command
    telnet(telnetParams, function (out, err) {
        if (err) {
            console.error("error while executing command: " + telnetParams.command);
            failure(err);
        }
        d.resolve(out.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, " "));
    });

    return d.promise;
}

function errorParsing(result) {
    var errorCount = result.split("READY").length - 1
    var errorCheckCmds = Array(errorCount).fill("5\r\n\r\n\x1B[B")
    var errorCheckCmds = errorCheckCmds.join("")
    telnetParams.command = command + errorCheckCmds
    var d = D.q.defer();
    telnet(telnetParams, function (out, err) {
        if (err) {
            console.error("error while executing command: " + telnetParams.command);
            failure(err);
        }
        d.resolve(out.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, " "));
    });

    return d.promise;
}

/**
 * 
 * @param {[string]} results list of information returned by redis server
 * @returns monitoring variables
 */
function parseInfo(results) {
    var srcs = results.match(/SRC[^ ]*/g)
    var dates = results.match(/\d\d\/\d\d\/\d\d\s+\d\d:\d\d:\d\d/g)
    var problemIds = results.match(/ID problema[\s\.\:]*\d{10}/g)
    for (var i = 0; i < problemIds.length; i++) {
        var problemIdRow = problemIds[i].split(" ")
        table.insertRecord(problemIdRow[problemIdRow.length - 1], [
            srcs[i],
            dates[i]
        ])
    }
    return table

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
    getAS400Info()
        .then(function () { D.success(); })
        .catch(failure);

}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    getAS400Info()
        .then(errorParsing)
        .then(parseInfo)
        .then(D.success)
        .catch(failure);
}