
var _var = D.device.createVariable;

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

var ssh_config = {
    username: D.device.username(),
    password: D.device.password(),
    port: 22,
    timeout: 30000
};

function exec_command(command, callback) {
    var config = JSON.parse(JSON.stringify(ssh_config));
    config.command = command;
    D.device.sendSSHCommand(config, function (out, err) {
        if (err) {
            console.error("error while executing command: " + command);
            console.error(err);
            D.failure();
        }
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
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    exec_command("pftop -v long -w 200 -o bytes 50", function () {
        D.success();
    });
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {

    exec_command("pftop -v long -w 200 -o bytes 50", function (lines) {
        var start = 2;
        for (var i = start; i < lines.length; i++) {
            var pftop_data = lines[i].split(/\s+/);
            if(pftop_data.length == 11){
                pftop_data.splice(4,0,"");
            }
            table.insertRecord(
                ""+(i - start), [
                    pftop_data[0],
                    pftop_data[1],
                    pftop_data[2],
                    pftop_data[3],
                    pftop_data[4],
                    pftop_data[5],
                    pftop_data[6],
                    pftop_data[7],
                    pftop_data[8],
                    pftop_data[9],
                    pftop_data[10],
                    pftop_data[11],
                ]
            );
        }

        D.success(table);

    });

}