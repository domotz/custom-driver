
/**
 * this driver is using ssh for the target server
 * the ssh user should have the sudo privillege to access log files
 */

var _var = D.device.createVariable;
var validation_cmd = "ls -al";
var cpu_info_cmd = "lscpu | grep -ie '^cpu(s):' -ie '^thread(s) per core:' | awk '{print $NF}'";
var nginx_status_stats_cmds = [
    "STATUS=$(systemctl status nginx)",
    "echo status:Status:$(echo \"$STATUS\" | grep -i active | awk '{print $2 $3}')",
    "PID=$(echo \"$STATUS\" | grep PID | awk '{print $3}')",
    "echo pid:PID:$PID",
    "echo memory:Memory usage:$(echo $PID | sudo xargs pmap | tail -1 | awk '{print $2}')",
    "echo tasks:Tasks:$(echo \"$STATUS\" | grep -i tasks | awk '{print $2}')",
    "echo tasks_limit:Tasks limit:$(echo \"$STATUS\" | grep -i tasks | awk '{print substr($4,1,length($4)-1)}')",
    "echo up_from:Up from:$(echo \"$STATUS\" | grep -i active | awk '{print \"\\x27\" $6 \" \" $7 \" \" substr($8,1,length($8)-1) \"\\x27\" \" +\\\"%s\\\"\"}' | xargs date -d)date",
];
var nginx_system_config_cmd = "sudo systemctl show nginx --no-pager";
var nginx_root_conf_file_location = "/etc/nginx/nginx.conf";

function build_queries_for_log_file(id, logFile) {
    var command = "last_hour=$(date +\"%d/%b/%Y:%H\" -d \"$DATE -1 hour\");CONTENT=$(sudo grep $last_hour " + logFile + " | cut -d \" \" -f 9)";
    return [
        command,
        "echo " + id + ":all_requests:All Requests:$(echo \"$CONTENT\" | wc -l)",
        "echo " + id + ":successfull_requests:Successfull Requests:$(echo \"$CONTENT\" | grep -E 2.. | wc -l)",
        "echo " + id + ":redirected_requests:Redirected Requests:$(echo \"$CONTENT\" | grep -E 3.. | wc -l)",
        "echo " + id + ":error_requests:Error Requests:$(echo \"$CONTENT\" | grep -E \"4..|5..\" | wc -l)"
    ];
}

var ssh_config = {
    username: D.device.username(),
    password: D.device.password(),
    port: 27123,
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

function cpu_info(next) {
    exec_command(cpu_info_cmd, function (info) {
        next([
            _var("cpus", "CPU(s)", info[0]),
            _var("threads_per_core", "Thread(s) per core", info[1])
        ]);
    });
}

function nginx_status_stats(next) {
    exec_command(nginx_status_stats_cmds.join(";"), function (info) {
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

function nginx_system_config(next) {
    exec_command(nginx_system_config_cmd, function (info) {
        var variables = [];
        for (var i = 0; i < info.length; i++) {
            var keyValue = info[i].split("=");
            var value = keyValue.splice(1);
            variables.push(_var(keyValue[0], keyValue[0], value.join("=")));
        }
        next(variables);
    });
}


/* parsing all config files and generate an object containing the config */
function load_config(callback) {
    /* Executing command and ignoring errors */
    function execute_cmd(command, root, callback) {
        var config = JSON.parse(JSON.stringify(ssh_config));
        config.command = command;
        config.timeout = 5000;
        D.device.sendSSHCommand(config, function (out, err) {
            if (err) console.error(err);
            build_config(root, out ? out : "", callback);
        });
    }

    /* parser for nginx config file */
    function build_config(root, data, callback) {
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

        var ls_files = "";
        includes.forEach(function (config) {
            ls_files += " " + config.value;
        });

        var cmd = "for file in $(ls -d " + ls_files + " 2>/dev/null); do sudo cat $file; done | sudo sed  's/\s*#.*$//'";
        execute_cmd(cmd, root, callback);
    }

    var root = { name: "root", params: [] };
    var cmd = "sudo sed  's/\s*#.*$//' " + nginx_root_conf_file_location;
    execute_cmd(cmd, root, function () {
        callback(root);
    });
}

/* extracting the server_name, port and the log file */
function build_config_vars(callback) {

    function find_servers(configs) {
        if (!configs) return [];
        var servers = [];
        for (var i = 0; i < configs.length; i++) {
            var config = configs[i];
            if (config.name == "server") {
                servers.push(config.params);
            } else if (config.params) {
                var result = find_servers(config.params);
                for (var j = 0; j < result.length; j++) {
                    servers.push(result[j]);
                }
            }
        }
        return servers;
    }


    load_config(function (result) {
        var configs = [];
        var a = [].indexOf("hello");
        var servers = find_servers([result]);
        servers.forEach(function (config, index) {
            var server_name_config = config.filter(function (c) { return c.name == "server_name"; });
            var listen_config = config.filter(function (c) { return c.name == "listen" && c.value.indexOf("[") != 0; });
            var log_config = config.filter(function (c) { return c.name == "access_log"; });
            var server_name = server_name_config.length ? server_name_config[0].value.split(" ")[0] : "default";
            var listen = listen_config.length ? listen_config[0].value.split(" ")[0] : "80";
            var addr_port = listen.split(":");
            var port = addr_port.length > 1 ? addr_port[1] : addr_port[0];
            var log_file = log_config.length ? log_config[0].value : "/var/log/nginx/access.log";
            configs.push({
                server_name: server_name,
                port: port,
                log_file: log_file
            });

        });
        callback(configs);
    });
}

/* extracting some statistics from every log file and generate variables for domotz */
function requests_stats(next) {
    build_config_vars(function (configs) {
        var log_commands = [];
        configs.forEach(function (config) {
            var server_name = config.server_name;
            var port = config.port;
            var log_file = config.log_file;
            var queries = build_queries_for_log_file(server_name + ":" + port, log_file);
            queries.forEach(function (query) {
                log_commands.push(query);
            });
        });
        exec_command(log_commands.join(";"), function (results) {
            var variables = [];
            for (var i = 0; i < results.length; i++) {
                var result = results[i];
                var stat = result.split(":");
                var server = stat[0] + ":" + stat[1];
                var uid = server + "_" + stat[2];
                variables.push(_var(uid.substring(uid.length - 50, uid.length), server + "->" + stat[3], stat[4]));
            }

            next(variables);
        });
    });
}



/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    exec_command(build_queries_for_log_file("main", "/var/log/nginx/iovision-redmine.io.access.log").join(";"), function (result) {
        var variables = [];
        result.forEach(function (r) {
            var stat = r.split(":");
            variables.push(_var(stat[0] + "->" + stat[1], stat[2], stat[3]));
            //variables.push(_var(r,r,r))
        });
        D.success(variables);
    });
}

function seq_execute(functions, callback) {
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
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    seq_execute([
        nginx_status_stats,
        cpu_info,
        requests_stats,
        nginx_system_config
    ], function (variables) {
        D.success(variables);
    });
}