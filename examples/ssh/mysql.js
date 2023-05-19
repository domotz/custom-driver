/**
 * Domotz Custom Driver 
 * Name: Mysql Server Monitoring
 * Description: Monitors Mysql service on Linux. 
 * 
 * Communication protocol is SSH.
 * 
 * Tested on Linux:
 * Ubuntu 22.04
 * Debian 10
 * Centos 7
 * 
 * Please Note that:
 *  
 * - Your MySQL must run as systemd service for this command to work
 * - This works in Debian derivatives and Centos, other Linux distributions might different paths
 * 
 * The driver will create the following variables:
 * - Status
 * - Version
 * - Used Ram
 * - Uptime
 * - Threads
 * - Questions
 * - Opens
 * - Flush tables
 * - Open tables
 * - Average Queries
 * - Errors
**/

// Ssh options and command to be run
var command = "(service mysql status | grep Active:) || echo 'No service found'; " + // Your MySQL must run as systemd service for this command to work
    "(ls /var/run/mysqld/mysqld.pid && pmap `cat /var/run/mysqld/mysqld.pid` ) | tail -1 2>/dev/null || echo 'No pid found';" +  // This works in Debian and derivatives, other distributions moght use another path
    "(mysqladmin -u "+D.device.username()+" --password='"+D.device.password()+"' -h 127.0.0.1 version) || echo 'Cannot run mysqladmin'";

var sshConfig = {
    "command": command,
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 35000
};

// Check for SSH Errors in the communication with the windows device the driver is applied on
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (err.code == 255){
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        console.error(err);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

function executeCommand(command) {
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (output, error) {
        if (error) {
            checkSshError(error);
            d.reject(error);
        }
        else{
            d.resolve(output);
        }
    });
    return d.promise;
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    console.info("Verifying device can respond correctly to command ... ");
    executeCommand(command)
        .then(function(output) {
            if (!output || output.indexOf("is not recognized") !== -1) {
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            } else {
                D.success();
            }
        })
        .catch(function(error) {
            checkSshError(error);
        });
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used for retrieving device * variables data
 */
function get_status() {
    executeCommand(command)
        .then(parse)
        .then(reportData)
        .catch(checkSshError);
}

function reportData(data) {
    var variables = [];
    if (data.status) {
        variables.push(D.createVariable("status", "Status", data.status));
    }
    if (data.version) {
        variables.push(D.createVariable("version", "Version", data.version));
    }
    if (data.usedRam) {
        variables.push(D.createVariable("usedRam", "Used Ram", data.usedRam, "KB"));
    }
    if (data.uptime) {
        variables.push(D.createVariable("uptime", "Uptime", toHours(data.uptime), "hours"));
    }
    if (data.threads) {
        variables.push(D.createVariable("threads", "Threads", data.threads));
    }
    if (data.questions) {
        variables.push(D.createVariable("questions", "Questions", data.questions));
    }
    if (data.slowQueries) {
        variables.push(D.createVariable("slowQueries", "Slow Queries", data.slowQueries));
    }
    if (data.opens) {
        variables.push(D.createVariable("opens", "Opens", data.opens));
    }
    if (data.flushTables) {
        variables.push(D.createVariable("flushTables", "Flush Tables", data.flushTables));
    }
    if (data.openTables) {
        variables.push(D.createVariable("openTables", "Open Tables", data.openTables));
    }
    if (data.queriesS) {
        variables.push(D.createVariable("queriesS", "Average Queries", data.queriesS, "query/s"));
    }
    variables.push(D.createVariable("errors", "Errors", data.errors || " "));
    D.success(variables);
}

function isRunning(data) {
    return (data.version || data.usedRam || (data.status && data.status.indexOf("running") >= 0)) && true;
}

function parse(output) {
    var ret = {errors: ""};
    console.info("OUTPUT: " + output);
    var lines = output.split("\n");

    try {
        ret["status"] = _parseStatus(lines.shift());
    } catch (e) {
        ret["errors"] += "No service information (" + e.message + ")\n";
    }
    try {
        ret["usedRam"] = _parseUsedRam(lines.shift());
    } catch (e) {
        ret["errors"] += "No memory usage information (" + e.message + ")\n";
    }

    try {
        ret = _parseAdminData(lines, ret);
    } catch (e) {
        ret["errors"] += "No admin information (" + e.message + ")\n";
    }

    ret.errors = ret.errors.trim();
    return ret;
}

function _parseStatus(line) {
    line = (line || " ").trim();
    if (line.indexOf("Active: ") !== 0) {
        throw new Error(line);
    }
    line = line.split(" ");
    return line[1] + " " + line[2];

}

function _parseUsedRam(line) {
    line = (line || " ").trim();
    if (line.indexOf("total ") !== 0) {
        throw new Error(line);
    }
    line = line.substring(6).trim();
    return parseInt(line, 10);
}

function _parseAdminData(lines, data) {
    if (lines.length < 2) {
        throw new Error(lines.pop());
    }
    var versionRegexp = /^Server version[\s]+(.+)$/i;
    var uptimeRegexp = /^Uptime:?[\s]+(.+)$/i;
    var otherRegexp = /^Threads: ([0-9]+)\s+Questions: ([0-9]+)\s+Slow queries: ([0-9]+)\s+Opens: ([0-9]+)\s+Flush tables: ([0-9]+)\s+Open tables: ([0-9]+)\s+Queries per second avg: (.+)$/i;
    lines.forEach(function (line) {
        line = line.trim();
        var versionMatch = line.match(versionRegexp);
        if (versionMatch) {
            data.version = versionMatch[1];
        } else {
            var uptimeMatch = line.match(uptimeRegexp);
            if (uptimeMatch) {
                data.uptime = uptimeMatch[1];
            } else {
                var allMatch = line.match(otherRegexp);
                if (allMatch) {
                    data.threads = parseInt(allMatch[1], 10);
                    data.questions = parseInt(allMatch[2], 10);
                    data.slowQueries = parseInt(allMatch[3], 10);
                    data.opens = parseInt(allMatch[4], 10);
                    data.flushTables = parseInt(allMatch[5], 10);
                    data.openTables = parseInt(allMatch[6], 10);
                    data.queriesS = allMatch[7];
                }
            }
        }
    });
    if (!data.version) {
        throw new Error(lines.pop());
    }
    return data;
}

function toHours(data) {
    var timeRegexp = /((\d+)\s+days?\s+)?((\d+)\s+hours?\s+)?((\d+)\s+min\s+)?(\d+)\s+sec/i;
    var match = data.match(timeRegexp);
    var days = match[2] || 0;
    var hours = match[4] || 0;
    var minutes = match[6] || 0;
    var totalHours = parseInt(days, 10) * 24 + parseInt(hours, 10) + parseInt(minutes, 10)/60;
    return (Math.floor(totalHours * 100) / 100) + "";
}