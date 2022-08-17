/**
 * This driver show apache2 status
 * The communication protocol is http
 * This driver extract monitoring variables specified in {@link parametersConfig} list
 * This driver is tested with Apache/2.4.41
 * This driver requires to open server-status path in the apache server (https://httpd.apache.org/docs/current/mod/mod_status.html)
 */

var apacheHttpParams = {
    // protocol: "https", // To use if the server under https
    // rejectUnauthorized: false, // to accept invalid https certificate
    // auth: "basic",
    // username: D.device.username(),
    // password: D.device.password(),
    // port: 9011, // http port number
    url: "/server-status?auto" // server status path, it depends from user's configuration
};

function multiplier(n) {
    return function () {
        this.value = this.value * n;
    };
}

function toFloat() {
    this.value = parseFloat(this.value);
}

var parametersConfig = [
    {
        // Service version
        uid: "version",
        label: "Version",
        path: "json.ServerVersion",
    },
    {
        // Service Multi-Processing Module
        uid: "server_mpm",
        label: "ServerMPM",
        path: "json.ServerMPM",
    },
    {
        // Server Built
        uid: "server_built",
        label: "Server Built",
        path: "json['Server Built']",
    },
    {
        // Service Restart Time
        uid: "restart_time",
        label: "Restart Time",
        path: "json.RestartTime",
    },
    {
        // CPU Load 1 minute
        uid: "load1",
        label: "CPU Load 1 minute",
        path: "json.Load1",
        postProcess: toFloat
    },
    {
        // CPU Load 5 minutes
        uid: "load5",
        label: "CPU Load 5 minutes",
        path: "json.Load5",
        postProcess: toFloat
    },
    {
        // CPU Load 15 minutes
        uid: "load15",
        label: "CPU Load 15 minutes",
        path: "json.Load15",
        postProcess: toFloat
    },
    {
        // CPU System
        uid: "cpu_system",
        label: "CPU System",
        path: "json.CPUSystem",
        postProcess: toFloat
    },
    {
        // CPU User
        uid: "cpu_user",
        label: "CPU User",
        path: "json.CPUUser",
        postProcess: toFloat
    },
    {
        // CPU Children System
        uid: "cpu_children_System",
        label: "CPU Children System",
        path: "json.CPUChildrenSystem",
        postProcess: toFloat
    },
    {
        // CPU Children User
        uid: "cpu_children_user",
        label: "CPU Children User",
        path: "json.CPUChildrenUser",
        postProcess: toFloat
    },
    {
        // CPU Load
        uid: "cpu_load",
        label: "CPU Load",
        path: "json.CPULoad",
        unit: "%",
        postProcess: toFloat
    },
    {
        // Calculated as change rate for 'Total bytes' stat.
        // BytesPerSec is not used, as it counts average since last Apache server start.
        uid: "bytes_per_second",
        label: "Bytes per second",
        rate: true,
        path: "json['Total kBytes']",
        unit: "Bps",
        postProcess: multiplier(1024)
    },
    {
        // Calculated as change rate for 'Total requests' stat.
        // ReqPerSec is not used, as it counts average since last Apache server start.
        uid: "requests_per_second",
        label: "Requests per second",
        rate: true,
        path: "json['Total Accesses']",
        postProcess: toFloat
    },
    {
        // Total bytes served
        uid: "total_bytes",
        label: "Total bytes",
        path: "json['Total kBytes']",
        unit: "B",
        postProcess: multiplier(1024)
    },
    {
        // A total number of accesses
        uid: "total_requests",
        label: "Total requests",
        path: "json['Total Accesses']",
        postProcess: toFloat
    },
    {
        // Total Duration
        uid: "total_duration",
        label: "Total Duration",
        path: "json['Total Duration']",
        postProcess: toFloat
    },
    {
        // Total number of busy worker threads/processes
        uid: "total_workers_busy",
        label: "Total workers busy",
        path: "json.BusyWorkers",
        postProcess: toFloat
    },
    {
        // Service uptime in seconds
        uid: "uptime",
        label: "Uptime",
        path: "json.ServerUptimeSeconds",
        unit: "uptime",
        postProcess: toFloat
    },
    {
        // Service version
        uid: "version",
        label: "Version",
        path: "json.ServerVersion",
    },
    {
        // Number of workers in closing state
        uid: "workers_closing_connection",
        label: "Workers closing connection",
        path: "json.Workers.closing",
        postProcess: toFloat
    },
    {
        // Number of workers in dnslookup state
        uid: "workers_dns_lookup",
        label: "Workers DNS lookup",
        path: "json.Workers.dnslookup",
        postProcess: toFloat
    },
    {
        // Number of workers in cleanup state
        uid: "workers_idle_cleanup",
        label: "Workers idle cleanup",
        path: "json.Workers.cleanup",
        postProcess: toFloat
    },
    {
        // Number of workers in keepalive state
        uid: "workers_keepalive_read",
        label: "Workers keepalive (read)",
        path: "json.Workers.keepalive",
        postProcess: toFloat
    },
    {
        // Number of workers in logging state
        uid: "workers_logging",
        label: "Workers logging",
        path: "json.Workers.logging",
        postProcess: toFloat
    },
    {
        // Number of workers in reading state
        uid: "workers_reading_request",
        label: "Workers reading request",
        path: "json.Workers.reading",
        postProcess: toFloat
    },
    {
        // Number of workers in sending state
        uid: "workers_sending_reply",
        label: "Workers sending reply",
        path: "json.Workers.sending",
        postProcess: toFloat
    },
    {
        // Number of slots with no current process
        uid: "workers_slot_with_no_current_process",
        label: "Workers slot with no current process",
        path: "json.Workers.slot",
        postProcess: toFloat
    },
    {
        // Number of workers in starting state
        uid: "workers_starting_up",
        label: "Workers starting up",
        path: "json.Workers.starting",
        postProcess: toFloat
    },
    {
        // Number of workers in waiting state
        uid: "workers_waiting_for_connection",
        label: "Workers waiting for connection",
        path: "json.Workers.waiting",
        postProcess: toFloat
    },


];


/**
 * 
 * @returns Promise wait for server-status page to be loaded
 */
function getApache2Status() {
    var d = D.q.defer();
    D.device.http.get(apacheHttpParams, function (error, response, body) {
        if (error) {
            failure(error);
        }
        if (response.statusCode == 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        d.resolve(body);
    });

    return d.promise;
}


function convertToJson(value) {
    // Convert Apache status to JSON
    var lines = value.split("\n");
    var output = {},
        workers = {
            "_": 0, "S": 0, "R": 0, "W": 0,
            "K": 0, "D": 0, "C": 0, "L": 0,
            "G": 0, "I": 0, ".": 0
        };

    // Get all "Key: Value" pairs as an object
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].match(/([A-z0-9 ]+): (.*)/);

        if (line !== null) {
            output[line[1]] = isNaN(line[2]) ? line[2] : Number(line[2]);
        }
    }

    // Multiversion metrics
    output.ServerUptimeSeconds = output.ServerUptimeSeconds || output.Uptime;
    output.ServerVersion = output.Server || output.ServerVersion;

    // Parse "Scoreboard" to get worker count.
    if (typeof output.Scoreboard === "string") {
        for (i = 0; i < output.Scoreboard.length; i++) {
            var char = output.Scoreboard[i];

            workers[char]++;
        }
    }

    // Add worker data to the output
    output.Workers = {
        waiting: workers["_"], starting: workers["S"], reading: workers["R"],
        sending: workers["W"], keepalive: workers["K"], dnslookup: workers["D"],
        closing: workers["C"], logging: workers["L"], finishing: workers["G"],
        cleanup: workers["I"], slot: workers["."]
    };

    // Return JSON string
    return output;

}

function extractDataVariables(json) {
    return parametersConfig.map(function (param) {
        param.value = eval(param.path);
        if (param.postProcess) {
            if (Array.isArray(param.postProcess)) {
                param.postProcess.forEach(function (fn) {
                    fn.apply(param);
                });
            } else {
                param.postProcess();
            }
        }
        return D.device.createVariable(param.uid, param.label, param.value, param.unit);
    });
}

function buildTable(body) {
    var $ = D.htmlParse(body);
    var processTable = $("table tbody")[0];
    processTable.children.filter(function (node, index) {
        return index > 0 && node.name == "tr";
    }).forEach(function (node, index) {
        var row = node.children.map(function (td, index) {
            var text = $(td).text().trim();
            if (index == 3) {
                return scoreboardKey[text];
            }
            return text;
        });
        table.insertRecord("" + index, row);
    });
    return table;
}

function failure(err) {

    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the call to the apache status page is ok
*/
function validate() {
    getApache2Status()
        .then(function () { D.success(); })
        .catch(failure);
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used to make a call to apache status page, convert the result to JSON then extract the parameters specified in {@link parametersConfig}
*/
function get_status() {

    getApache2Status()
        .then(convertToJson)
        .then(extractDataVariables)
        .then(D.success)
        .catch(failure);
}