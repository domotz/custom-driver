
/**
 * this driver is using ssh for the target server
 * the ssh user should have the sudo privilege to access log files
 * this driver is tested under nginx version: nginx/1.14.0 (Ubuntu)
 * applicable for linux based systems
 */

var _var = D.device.createVariable;
var validationCmd = "ls -al";
var cpuInfoCmd = "lscpu | grep -ie '^cpu(s):' -ie '^thread(s) per core:' | awk '{print $NF}'";
var nginxStatusStatsCmds = [
    "STATUS=$(systemctl status nginx)",
    "echo status:Status:$(echo \"$STATUS\" | grep -i active | awk '{print $2 $3}')",
    "PID=$(echo \"$STATUS\" | grep PID | awk '{print $3}')",
    "echo pid:PID:$PID",
    "echo memory:Memory usage:$(echo $PID | sudo xargs pmap | tail -1 | awk '{print $2}')",
    "echo tasks:Tasks:$(echo \"$STATUS\" | grep -i tasks | awk '{print $2}')",
    "echo tasks_limit:Tasks limit:$(echo \"$STATUS\" | grep -i tasks | awk '{print substr($4,1,length($4)-1)}')",
    "echo up_from:Up from:$(echo \"$STATUS\" | grep -i active | awk '{print \"\\x27\" $6 \" \" $7 \" \" substr($8,1,length($8)-1) \"\\x27\" \" +\\\"%s\\\"\"}' | xargs date -d)date",
];
var nginxSystemConfigCmd = "sudo systemctl show nginx --no-pager";
var nginxRootConfFileLocation = "/etc/nginx/nginx.conf";

function buildQueriesForLogFile(id, logFile) {
    var command = "last_hour=$(date +\"%d/%b/%Y:%H\" -d \"$DATE -1 hour\");CONTENT=$(sudo grep $last_hour " + logFile + " | cut -d \" \" -f 9)";
    return [
        command,
        "echo " + id + ":all_requests:All Requests:$(echo \"$CONTENT\" | wc -l)",
        "echo " + id + ":successfull_requests:Successfull Requests:$(echo \"$CONTENT\" | grep -E 2.. | wc -l)",
        "echo " + id + ":redirected_requests:Redirected Requests:$(echo \"$CONTENT\" | grep -E 3.. | wc -l)",
        "echo " + id + ":error_requests:Error Requests:$(echo \"$CONTENT\" | grep -E \"4..|5..\" | wc -l)"
    ];
}

var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 30000
};

function execCommand(command, callback) {
    var config = JSON.parse(JSON.stringify(sshConfig));
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

function cpuInfo(next) {
    execCommand(cpuInfoCmd, function (info) {
        next([
            _var("cpus", "CPU(s)", info[0]),
            _var("threads_per_core", "Thread(s) per core", info[1])
        ]);
    });
}

function nginxStatusStats(next) {
    execCommand(nginxStatusStatsCmds.join(";"), function (info) {
        var variables = [];
        for (var i = 0; i < info.length; i++) {
            var param = info[i];
            var data = param.split(":");
            var value = "";
            var unit = "";
            if (data[2]) {
                var valueUnit = data[2].match(/^([\d,\.]*)(.*)$/);
                value = valueUnit[1];
                unit = valueUnit[2];
                if (!value) value = unit;
            }
            variables.push(_var(
                data[0],
                data[1] + (unit ? " (" + unit + ")" : ""),
                value,
                unit)
            );
        }
        next(variables);
    });
}

function nginxSystemConfig(next) {
    execCommand(nginxSystemConfigCmd, function (info) {
        var variables = [];
        for (var i = 0; i < info.length; i++) {
            var keyValue = info[i].split("=");
            var value = keyValue.splice(1);

            variables.push(_var(keyValue[0], keyValue[0], value.join("=").substring(0, 500)));
        }
        next(variables);
    });
}


/* parsing all config files and generate an object containing the config */
function loadConfig(callback) {
    /* Executing command and ignoring errors */
    function executeCmd(command, root, callback) {
        var config = JSON.parse(JSON.stringify(sshConfig));
        config.command = command;
        config.timeout = 5000;
        D.device.sendSSHCommand(config, function (out, err) {
            if (err) console.error(err);
            buildConfig(root, out ? out : "", callback);
        });
    }

    /* parser for nginx config file */
    function buildConfig(root, data, callback) {
        var dataToProcess = data.toString().replace(/\n/g, "").trim().replace(/\s*\t*(\{|\}|;)\s*\t*/g, "$1");
        var param = "";
        var currentNode = root;
        var nodeQueu = [];
        var includes = [];
        for (var i = 0; i < dataToProcess.length; i++) {
            var c = dataToProcess[i];
            if (c === ";") {
                if (!param) continue;
                var keyValue = param.trim().split(" ");
                var newParam = { name: keyValue[0], value: keyValue.slice(1).join(" ").trim() };
                currentNode.params.push(newParam);
                param = "";
                if (keyValue[0] == "include") {
                    newParam.params = [];
                    includes.push(newParam);
                }
            } else if (c === "{") {
                var node = { name: param, params: [] };
                nodeQueu.push(currentNode);
                currentNode.params.push(node);
                currentNode = node;
                param = "";
            } else if (c === "}") {
                if (param) {
                    keyValue = param.trim().split(" ");
                    currentNode.params.push({ name: keyValue[0], value: keyValue.slice(1).join(" ").trim() });
                    param = "";
                }
                currentNode = nodeQueu.pop();
                if (!currentNode) {
                    break;
                }
            } else {
                param += c;
            }
        }
        if (!includes.length) return callback(root);

        var lsFiles = "";
        includes.forEach(function (config) {
            lsFiles += " " + config.value;
        });

        var cmd = "for file in $(ls -d " + lsFiles + " 2>/dev/null); do sudo cat $file; done | sudo sed  's/\s*#.*$//'";
        executeCmd(cmd, root, callback);
    }

    var root = { name: "root", params: [] };
    var cmd = "sudo sed  's/\s*#.*$//' " + nginxRootConfFileLocation;
    executeCmd(cmd, root, function () {
        callback(root);
    });
}

/* extracting the server_name, port and the log file */
function buildConfigVars(callback) {

    function findServers(configs) {
        if (!configs) return [];
        var servers = [];
        for (var i = 0; i < configs.length; i++) {
            var config = configs[i];
            if (config.name == "server") {
                servers.push(config.params);
            } else if (config.params) {
                var result = findServers(config.params);
                for (var j = 0; j < result.length; j++) {
                    servers.push(result[j]);
                }
            }
        }
        return servers;
    }


    loadConfig(function (result) {
        var configs = [];
        var a = [].indexOf("hello");
        var servers = findServers([result]);
        servers.forEach(function (config, index) {
            var serverNameConfig = config.filter(function (c) { return c.name == "server_name"; });
            var listenConfig = config.filter(function (c) { return c.name == "listen" && c.value.indexOf("[") != 0; });
            var logConfig = config.filter(function (c) { return c.name == "access_log"; });
            var serverName = serverNameConfig.length ? serverNameConfig[0].value.split(" ")[0] : "default";
            var listen = listenConfig.length ? listenConfig[0].value.split(" ")[0] : "80";
            var addrPort = listen.split(":");
            var port = addrPort.length > 1 ? addrPort[1] : addrPort[0];
            var logFile = logConfig.length ? logConfig[0].value : "/var/log/nginx/access.log";
            configs.push({
                serverName: serverName,
                port: port,
                logFile: logFile
            });

        });
        callback(configs);
    });
}

var table = D.createTable("Nginx request stats", [
    { label: "Server name" },
    { label: "Server port" },
    { label: "All requests" },
    { label: "Successful requests" },
    { label: "Redirected requests" },
    { label: "Error requests" }
]);

/* extracting some statistics from every log file and generate variables for domotz */
function requestsStats(next) {
    buildConfigVars(function (configs) {
        var logCommands = [];
        configs.forEach(function (config) {
            var serverName = config.serverName;
            var port = config.port;
            var logFile = config.logFile;
            var queries = buildQueriesForLogFile(serverName + ":" + port, logFile);
            queries.forEach(function (query) {
                logCommands.push(query);
            });
        });
        execCommand(logCommands.join(";"), function (results) {
            var variables = [];
            for (var i = 0; i < results.length; i += 4) {
                var allReq = results[i];
                var sucReq = results[i + 1];
                var redReq = results[i + 2];
                var errReq = results[i + 3];

                var row = [null, null];
                var uid;
                var server;
                var port;
                [allReq, sucReq, redReq, errReq].forEach(function (statString) {
                    var stat = statString.split(":");
                    server = stat[0];
                    port = stat[1];
                    uid = server + "_" + port;
                    row.push(stat[4]);
                });
                row[0] = server;
                row[1] = port;
                table.insertRecord(uid, row);
            }

            next(variables);
        });
    });
}

function seqExecute(functions, callback) {
    var callbackVariables = [];
    function executeNext(functionIndex) {
        if (functionIndex == functions.length) return callback(callbackVariables);
        functions[functionIndex](function (variables) {
            for (var j = 0; j < variables.length; j++) {
                callbackVariables.push(variables[j]);
            }
            executeNext(++functionIndex);
        });
    }
    executeNext(0);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    function validateCallback(result) {
        execCommand(buildQueriesForLogFile("main", "/var/log/nginx/iovision-redmine.io.access.log").join(";"), function (result) {
            var variables = [];
            result.forEach(function (r) {
                var stat = r.split(":");
                variables.push(_var(stat[0] + "->" + stat[1], stat[2], stat[3]));
            });
            D.success(variables);
        });
    }
    execCommand(
        nginxSystemConfigCmd,
        validateCallback
    )

}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    seqExecute([
        nginxStatusStats,
        cpuInfo,
        requestsStats,
        nginxSystemConfig
    ], function (variables) {
        D.success(variables, table);
    });
}