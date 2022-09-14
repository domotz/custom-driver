var _var = D.device.createVariable;
var command = "(service mysql status | grep Active:) || echo 'No service found'; " + // Your MySQL must run as systemd service for this command to work
    "(ls /var/run/mysqld/mysqld.pid && pmap `cat /var/run/mysqld/mysqld.pid` ) | tail -1 2>/dev/null || echo 'No pid found';" +
    // This works in Debian and derivatives, other distributions moght use another path
    "(mysqladmin version) || echo 'Cannot run mysqladmin'";
    // In this simplicistic version, mysql root user accepts password-less connections from localhost

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    D.device.sendSSHCommand(
        {
            command: command,
            username: D.device.username(),
            password: D.device.password(),
            timeout: 20000
        },
        function (output, error) {
            if (error) {
                console.error(error);
                D.failure();
            } else {
                console.info(output);
                var data = parse(output);
                reportData(data);
            }
        }
    );
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used for retrieving device * variables data
 */
function get_status() {
    D.device.sendSSHCommand(
        {
            command: command,
            username: D.device.username(),
            password: D.device.password(),
            timeout: 20000
        },
        function (output, error) {
            if (error) {
                console.error(error);
                D.failure();
            } else {
                var data = parse(output);
                reportData(data);
                if (!isRunning(data)) {
                    tryStart();
                }
            }
        }
    );
}

function tryStart() {
    D.device.sendSSHCommand(
        {
            command: "service mysql start",
            username: D.device.username(),
            password: D.device.password(),
            timeout: 10000
        }, function () {
            if (error) {
                console.error(error);
            }
        });
}

function reportData(data) {
    var variables = [];
    console.log(data);
    if (data.status) {
        variables.push(_var("status", "Status", data.status));
    }
    if (data.version) {
        variables.push(_var("version", "Version", data.version));
    }
    if (data.usedRam) {
        variables.push(_var("usedRam", "Used Ram", data.usedRam, "KB"));
    }
    if (data.uptime) {
        variables.push(_var("uptime", "Uptime", toHours(data.uptime), "hours"));
    }
    if (data.threads) {
        variables.push(_var("threads", "Threads", data.threads));
    }
    if (data.questions) {
        variables.push(_var("questions", "Questions", data.questions));
    }
    if (data.slowQueries) {
        variables.push(_var("slowQueries", "Slow Queries", data.slowQueries));
    }
    if (data.opens) {
        variables.push(_var("opens", "Opens", data.opens));
    }
    if (data.flushTables) {
        variables.push(_var("flushTables", "Flush Tables", data.flushTables));
    }
    if (data.openTables) {
        variables.push(_var("openTables", "Open Tables", data.openTables));
    }
    if (data.queriesS) {
        variables.push(_var("queriesS", "Average Queries/s", data.queriesS, "query/s"));
    }

    variables.push(_var("errors", "Errors", data.errors || " "));
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

try {
    module.exports.parse = parse;
    module.exports.isRunning = isRunning;
    module.exports.toHours = toHours;
    module.exports.report = report;
} catch (e)
{
    // ignore
}