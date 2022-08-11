/**
 * This driver extract 50 first rows for pftop command
 * Communication protocol is ssh
 * Create a table that contains pftop result
 * SSH Daemon should be enabled in pfsense, please check this documentation to enable it: https://docs.netgate.com/pfsense/en/latest/recipes/ssh-access.html
 * Tested under pfsense 2.6.0-RELEASE
 */

var createVar = D.device.createVariable;

var table = D.createTable(
    "pfTop",
    [
        { label: "PR" },
        { label: "DIR" },
        { label: "SRC" },
        { label: "DEST" },
        { label: "GW" },
        { label: "STATE" },
        { label: "AGE" },
        { label: "EXP" },
        { label: "PKTS" },
        { label: "BYTES" },
        { label: "AVG"},
        { label: "RULE" }
    ]
);

var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    port: 22,
    timeout: 30000
};

/**
 * 
 * @param {object} err check ssh different errors
 */
function checkSshError(err){
    console.error(err);
    if(err.message){
        console.error(err.message);
    }
    if(err.code == 5){
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    }else if(err.code == 255){
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    }
    console.error("error while executing command: " + command);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
 * 
 * @param {string} command ssh command to be executed
 * @param {function} callback a function will be called if ssh command is successfully done
 */
function execCommand(command, callback) {
    var config = JSON.parse(JSON.stringify(sshConfig));
    config.command = command;
    D.device.sendSSHCommand(config, function (out, err) {
        if (err) {
            checkSshError(err);
        }
        callback(out.split("\n"));
    });
}

/**
 * 
 * @param {number} count an integer that will be converted
 * @param {string} unit source unit
 * @returns convert the count to K unit
 */
function convertToK(count, unit) {
    switch (unit) {
    case "K": return count;
    case "M": return count * 1000;
    case "G": return count * 1000000;
    }
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    execCommand("pftop -v long -w 200 -o bytes 50", function () {
        D.success();
    });
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {

    execCommand("pftop -v long -w 200 -o bytes 50", function (lines) {
        var start = 2;
        for (var i = start; i < lines.length; i++) {
            var pftopData = lines[i].split(/\s+/);
            if(pftopData.length == 11){
                pftopData.splice(4,0,"");
            }
            table.insertRecord(
                ""+(i - start), [
                    pftopData[0],
                    pftopData[1],
                    pftopData[2],
                    pftopData[3],
                    pftopData[4],
                    pftopData[5],
                    pftopData[6],
                    pftopData[7],
                    pftopData[8],
                    pftopData[9],
                    pftopData[10],
                    pftopData[11],
                ]
            );
        }

        D.success(table);

    });

}