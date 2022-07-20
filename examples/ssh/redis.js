var _var = D.device.createVariable;
var ssh = D.device.sendSSHCommand;


var redis_config = {
    // host: "ip or dns",
    // port: "6379",
    //auth: "password"
};

var ssh_config = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 30000
};

function build_redis_command() {
    var host = redis_config.host;
    var port = redis_config.port;
    var auth = redis_config.auth;
    return "redis-cli" + (host ? " -h " + host : "") + (port ? " -p " + port : "") + (auth ? " -a " + auth : "") + " info";
}

function execute_ssh(command) {
    var d = D.q.defer();
    ssh_config.command = command;
    ssh(ssh_config, function (out, err) {
        if (err) {
            console.error("error while executing command: " + command);
            console.error(err);
            D.failure();
        }
        d.resolve(out.split("\n"));
    });

    return d.promise;
}

function convertToK(value, unit) {
    switch (unit) {
    case "G": return value * 1000000;
    case "M": return value * 1000;
    default: return value;
    }
}

function parse_info(results) {
    return results.map(function (line) {
        return line.split(":");
    }).filter(function (info) {
        return info.length == 2;
    }).filter(function(info){
        return !info[0].match(/.*_human$/);
    }).map(function (info) {

        var key = info[0];
        var value = info[1].trim();
        var last_char = value[value.length - 1];
        // var unit;
        // if (["%", "M", "G", "K",].indexOf(last_char) >= 0) {
        //     unit = last_char;
        //     value = value.substring(0, value.length - 1);
        //     value = convertToK(value, unit);
        //     unit = (unit == "%" ? unit : "K");
        // }
        return _var(key, key.split("_").join(" "), value);
    });
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {

}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    execute_ssh(build_redis_command())
        .then(parse_info)
        .then(D.success)
        .catch(function(error){
            console.error(error);
            D.failure();
        });
}