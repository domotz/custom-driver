
/**
 * This driver extract information from top command for freebsd os
 * Communication protocol is ssh
 * Create variables to monitor cpu, memory and other parameters
 * Create a table that contains top processes result
 * Tested under freebsd 12.3-STABLE
 */

var createVar = D.device.createVariable;

var table = D.createTable(
    "Top processes",
    [
        { label: "PID" },
        { label: "USERNAME" },
        { label: "THR" },
        { label: "PRI" },
        { label: "NICE" },
        { label: "SIZE" },
        { label: "RES" },
        { label: "STATE" },
        { label: "C" },
        { label: "TIME" },
        { label: "WCPU", unit: "%" },
        { label: "COMMAND" }
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
    execCommand("top -o cpu| head -n19", function () {
        D.success();
    });
}



/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {

    execCommand("top -o cpu| head -n19", function (lines) {
        var line0Data = lines[0].match(/^last pid:\s+(.*);\s+load averages:\s+(.*),\s+(.*),\s+(.*)\s+up\s+(.*)\s+(.*)$/);
        var line1Data = lines[1].match(/^(.*)\s+processes:\s+(.*)\s+running,\s+(.*)\s+sleeping$/);
        var line2Data = lines[2].match(/^CPU:\s+(.*)%\s+user,\s+(.*)%\s+nice,\s+(.*)%\s+system,\s+(.*)%\s+interrupt,\s+(.*)%\s+idle$/);
        var line3Data = lines[3].match(/^Mem:\s+(.*)(.)\s+Active,\s+(.*)(.)\s+Inact,\s+(.*)(.)\s+Wired,\s+(.*)(.)\s+Free$/);
        var line4Data = lines[4].match(/^ARC:\s+(.*)(.)\s+Total,\s+(.*)(.)\s+MFU,\s+(.*)(.)\s+MRU,\s+(.*)(.)\s+Anon,\s+(.*)(.)\s+Header,\s+(.*)(.)\s+Other$/);
        var line5Data = lines[5].match(/^\s*(.*)(.)\s+Compressed,\s+(.*)(.)\s+Uncompressed,.*$/);
        var line6Data = lines[6].match(/^Swap:\s+(.*)(.)\s+Total,\s+(.*)(.)\s+Free$/);
        var vars = [
            createVar("last_pid", "Last pid", line0Data[1]),
            createVar("load_avg_1m", "Load average 1m", line0Data[2]),
            createVar("load_avg_5m", "Load average 5m", line0Data[3]),
            createVar("load_avg_15m", "Load average 15m", line0Data[4]),
            createVar("processes", "Processes", line1Data[1]),
            createVar("processes_running", "Running processes", line1Data[2]),
            createVar("processes_sleeping", "Sleeping processes", line1Data[3]),
            createVar("cpu_user", "CPU user", line2Data[1], "%"),
            createVar("cpu_nice", "CPU nice", line2Data[2], "%"),
            createVar("cpu_system", "CPU system", line2Data[3], "%"),
            createVar("cpu_interrupt", "CPU interrupt", line2Data[4], "%"),
            createVar("cpu_idle", "CPU idle", line2Data[5], "%"),
            createVar("mem_active", "Mem active", convertToK(line3Data[1], line3Data[2]), "K"),
            createVar("mem_inact", "Mem inactive", convertToK(line3Data[3], line3Data[4]), "K"),
            createVar("mem_wired", "Mem wired", convertToK(line3Data[5], line3Data[6]), "K"),
            createVar("mem_free", "Mem free", convertToK(line3Data[7], line3Data[8]), "K"),
            createVar("arc_total", "ARC total", convertToK(line4Data[1], line4Data[2]), "K"),
            createVar("arc_mfu", "ARC MFU", convertToK(line4Data[1], line4Data[2]), "K"),
            createVar("arc_mru", "ARC MRU", convertToK(line4Data[3], line4Data[4]), "K"),
            createVar("arc_anon", "ARC Anon", convertToK(line4Data[5], line4Data[6]), "K"),
            createVar("arc_header", "ARC Header", convertToK(line4Data[7], line4Data[8]), "K"),
            createVar("arc_other", "ARC Other", convertToK(line4Data[9], line4Data[10]), "K"),
            createVar("arc_compressed", "ARC Compressed", convertToK(line5Data[1], line5Data[2]), "K"),
            createVar("arc_uncompressed", "ARC Uncompressed", convertToK(line5Data[3], line5Data[4]), "K"),
            createVar("swap_total", "SWAP Total", convertToK(line6Data[1], line6Data[2]), "K"),
            createVar("swap_free", "SWAP Free", convertToK(line6Data[3], line6Data[4]), "K"),

        ];

        var start = 9;
        for (var i = start; i < lines.length; i++) {
            var processData = lines[i].replace(/\s+/gm," ").match(/^\s*(\d+)\s+(.*)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)(.)\s+(\d+)(.)\s+(.*)\s+(\d+)\s+(.*)\s+(.*)%\s+(.*)$/);
            table.insertRecord(
                ""+(i - start), [
                    processData[1],
                    processData[2],
                    processData[3],
                    processData[4],
                    processData[5],
                    convertToK(processData[6], processData[7]),
                    convertToK(processData[8], processData[9]),
                    processData[10],
                    processData[11],
                    processData[12],
                    processData[13],
                    processData[14]
                ]
            );
        }

        D.success(vars, table);

    });

}
