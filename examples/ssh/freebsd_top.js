

/**
 * This driver extracts information about top processes running under freebsd os
 * The communication protocol is SSH
 * This driver create a dynamic monitoring variables for the system statistics and top 10 processes
 * Tested under freebsd 12.3-STABLE
 */


var _var = D.device.createVariable;
// top rows to show
var rowCount = 10;
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

var ssh_config = {
    username: D.device.username(),
    password: D.device.password(),
    port: 22,
    timeout: 30000
};
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}
function exec_command(command, callback) {
    var config = JSON.parse(JSON.stringify(ssh_config));
    config.command = command;
    D.device.sendSSHCommand(config, function (out, err) {
        if(err) checkSshError(err);
        callback(out.split("\n"));
    });
}

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
* @documentation This procedure is used to validate if ssh command is running successfully
*/
function validate() {
    exec_command("top -o cpu| head -n19", function () {
        D.success();
    });
}



/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device system statistics and top processes information
*/
function get_status() {

    exec_command("top -o cpu| head -n" + (9+ rowCount), function (lines) {
        var line0_data = lines[0].match(/^last pid:\s+(.*);\s+load averages:\s+(.*),\s+(.*),\s+(.*)\s+up\s+(.*)\s+(.*)$/);
        var line1_data = lines[1].match(/^(.*)\s+processes:\s+(.*)\s+running,\s+(.*)\s+sleeping$/);
        var line2_data = lines[2].match(/^CPU:\s+(.*)%\s+user,\s+(.*)%\s+nice,\s+(.*)%\s+system,\s+(.*)%\s+interrupt,\s+(.*)%\s+idle$/);
        var line3_data = lines[3].match(/^Mem:\s+(.*)(.)\s+Active,\s+(.*)(.)\s+Inact,\s+(.*)(.)\s+Wired,\s+(.*)(.)\s+Free$/);
        var line4_data = lines[4].match(/^ARC:\s+(.*)(.)\s+Total,\s+(.*)(.)\s+MFU,\s+(.*)(.)\s+MRU,\s+(.*)(.)\s+Anon,\s+(.*)(.)\s+Header,\s+(.*)(.)\s+Other$/);
        var line5_data = lines[5].match(/^\s*(.*)(.)\s+Compressed,\s+(.*)(.)\s+Uncompressed,.*$/);
        var line6_data = lines[6].match(/^Swap:\s+(.*)(.)\s+Total,\s+(.*)(.)\s+Free$/);
        var vars = [
            _var("last_pid", "Last pid", line0_data[1]),
            _var("load_avg_1m", "Load average 1m", line0_data[2]),
            _var("load_avg_5m", "Load average 5m", line0_data[3]),
            _var("load_avg_15m", "Load average 15m", line0_data[4]),
            _var("processes", "Processes", line1_data[1]),
            _var("processes_running", "Running processes", line1_data[2]),
            _var("processes_sleeping", "Sleeping processes", line1_data[3]),
            _var("cpu_user", "CPU user", line2_data[1], "%"),
            _var("cpu_nice", "CPU nice", line2_data[2], "%"),
            _var("cpu_system", "CPU system", line2_data[3], "%"),
            _var("cpu_interrupt", "CPU interrupt", line2_data[4], "%"),
            _var("cpu_idle", "CPU idle", line2_data[5], "%"),
            _var("mem_active", "Mem active", convertToK(line3_data[1], line3_data[2]), "K"),
            _var("mem_inact", "Mem inactive", convertToK(line3_data[3], line3_data[4]), "K"),
            _var("mem_wired", "Mem wired", convertToK(line3_data[5], line3_data[6]), "K"),
            _var("mem_free", "Mem free", convertToK(line3_data[7], line3_data[8]), "K"),
            _var("arc_total", "ARC total", convertToK(line4_data[1], line4_data[2]), "K"),
            _var("arc_mfu", "ARC MFU", convertToK(line4_data[1], line4_data[2]), "K"),
            _var("arc_mru", "ARC MRU", convertToK(line4_data[3], line4_data[4]), "K"),
            _var("arc_anon", "ARC Anon", convertToK(line4_data[5], line4_data[6]), "K"),
            _var("arc_header", "ARC Header", convertToK(line4_data[7], line4_data[8]), "K"),
            _var("arc_other", "ARC Other", convertToK(line4_data[9], line4_data[10]), "K"),
            _var("arc_compressed", "ARC Compressed", convertToK(line5_data[1], line5_data[2]), "K"),
            _var("arc_uncompressed", "ARC Uncompressed", convertToK(line5_data[3], line5_data[4]), "K"),
            _var("swap_total", "SWAP Total", convertToK(line6_data[1], line6_data[2]), "K"),
            _var("swap_free", "SWAP Free", convertToK(line6_data[3], line6_data[4]), "K"),

        ];

        var start = 9;
        for (var i = start; i < lines.length; i++) {
            var process_data = lines[i].trim().replace(/\s+/gm," ").match(/^(\d+) (.*) (\d+) (\d+) (\d+) (\d+)(.) (\d+)(.) (.*) (\d+ )?(.*) (.*)% (.*)$/);
            table.insertRecord(
                ""+(i - start), [
                    process_data[1],
                    process_data[2],
                    process_data[3],
                    process_data[4],
                    process_data[5],
                    convertToK(process_data[6], process_data[7]),
                    convertToK(process_data[8], process_data[9]),
                    process_data[10],
                    process_data[11],
                    process_data[12],
                    process_data[13],
                    process_data[14]
                ]
            );
        }

        D.success(vars, table);

    });

}
