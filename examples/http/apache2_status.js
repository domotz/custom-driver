/**
 * This driver show apache2 status
 * The communication protocol is http
 * This driver extract monitoring variables specified in @parametersConfig list
 * 
 * This driver create a table for apache2 processes with this columns:
 * %Srv: Child Server number - generation
 * %PID: OS process ID
 * %Acc:	Number of accesses this connection / this child / this slot
 * %M:	Mode of operation
 * %CPU:	CPU usage, number of seconds
 * %SS:	Seconds since beginning of most recent request
 * %Req:	Milliseconds required to process most recent request
 * %Dur:	Sum of milliseconds required to process all requests
 * %Conn:	Kilobytes transferred this connection
 * %Child:	Megabytes transferred this child
 * %Slot:	Total megabytes transferred this slot
 * %Client
 * %Protocol
 * %VHost
 * %Request
 * 
 * This driver is tested with Apache/2.4.41
 * This driver requires to open server-status path in the apache server (https://httpd.apache.org/docs/current/mod/mod_status.html)
 */
var apacheHttpParams = {
    // protocol: "https", // To use if the server under https
    // rejectUnauthorized: false, // to accept invalid https certificate
    port: 9011, // http port number
    url: "/server-status" // server status path, it depends from user's configuration
};

var scoreboardKey = {
    "_": "Waiting for Connection",
    "S": "Starting up",
    "R": "Reading Request",
    "W": "Sending Reply",
    "K": "Keepalive (read)",
    "D": "DNS Lookup",
    "C": "Closing connection",
    "L": "Logging",
    "G": "Gracefully finishing",
    "I": "Idle cleanup of worker",
    ".": "Open slot with no current process"
};

var table = D.createTable(
    "Apache processes",
    [
        { label: "Srv" },
        { label: "PID" },
        { label: "Acc" },
        { label: "M" },
        { label: "CPU" },
        { label: "SS" },
        { label: "Req" },
        { label: "Dur" },
        { label: "Conn" },
        { label: "Child" },
        { label: "Slot" },
        { label: "Client" },
        { label: "Protocol" },
        { label: "VHost" },
        { label: "Request" },
    ]
);

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
        d.resolve(body);
    });

    return d.promise;
}

var cpuUsageRegex = /CPU Usage: u(\d*\.?\d*) s(\d*\.?\d*) cu(\d*\.?\d*) cs(\d*\.?\d*) - (\d*\.?\d*)% CPU load</m;
var reqStatRegex = /(\d*\.?\d*) requests\/sec - (\d*\.?\d*) B\/second - (\d*\.?\d*) B\/request - (\d*\.?\d*) ms\/request/m;
var processedReqRegex = /(\d+) requests currently being processed, (\d+) idle workers/m;

/**
 * this variable contains all monitoring data to be shown
 */
var parametersConfig = [
    {
        uid: "server_version",
        label: "Server Version",
        regex: />server version: (.+)</im,
        group: 1
    },
    {
        uid: "server_mpm",
        label: "Server MPM",
        regex: />Server MPM: (.+)</im,
        group: 1
    },
    {
        uid: "server_built",
        label: "Server Built",
        regex: /Server Built: (.*)/m,
        group: 1
    },
    {
        uid: "restart_time",
        label: "Restart Time",
        regex: /Restart Time: (.*)</m,
        group: 1
    },
    {
        uid: "parent_server_config_gen",
        label: "Parent Server Config. Generation",
        regex: /Parent Server Config\. Generation: (.*)</m,
        group: 1
    },
    {
        uid: "parent_server_mpm_gen",
        label: "Parent Server MPM Generation",
        regex: /Parent Server MPM Generation: (.*)</m,
        group: 1
    },
    {
        uid: "server_uptime",
        label: "Server uptime",
        regex: /Server uptime: (.*)</m,
        group: 1,
        unit: "sec",
        postProcess: function (data) {
            var match = data.trim().match(/^ ?((\d+) days?)?.?((\d+) hours?)?.?((\d+) minutes?)?.?((\d+) seconds?)?$/);
            return parseInt(match[2] || 0) * 24 * 3600 + parseInt(match[4] || 0) * 3600 + parseInt(match[6] || 0) * 60 + parseInt(match[8] || 0);
        }
    },
    {
        uid: "server_load_1m",
        label: "Server load 1 minute",
        regex: /Server load: (.*) .* .*</m,
        group: 1
    },
    {
        uid: "server_load_5m",
        label: "Server load 5 minutes",
        regex: /Server load: .* (.*) .*</m,
        group: 1
    },
    {
        uid: "server_load_15m",
        label: "Server load 15 minutes",
        regex: /Server load: .* .* (.*)</m,
        group: 1
    },
    {
        uid: "total_accesses",
        label: "Total accesses",
        regex: /Total accesses: (\d+) - Total Traffic: .+ - Total Duration: \d+</m,
        group: 1
    },
    {
        uid: "total_traffic",
        label: "Total Traffic",
        regex: /Total accesses: \d+ - Total Traffic: (.+) - Total Duration: \d+</m,
        group: 1,
        unit: "kB",
        postProcess: function (data) {
            var match = data.trim().match(/^(\d+) (.+)/);
            switch (match[2]) {
            case "mB": return match[1] * 1000;
            case "gB": return match[1] * 1000000;
            default: return parseInt(match[1]);
            }
        }
    },
    {
        uid: "total_duration",
        label: "Total Duration",
        regex: /Total accesses: \d+ - Total Traffic: .+ - Total Duration: (\d+)</m,
        group: 1
    },
    {
        uid: "cpu_usage_u",
        label: "CPU Usage : u",
        regex: cpuUsageRegex,
        group: 1,
        postProcess: parseFloat
    },
    {
        uid: "cpu_usage_s",
        label: "CPU Usage : s",
        regex: cpuUsageRegex,
        group: 2,
        postProcess: parseFloat
    },
    {
        uid: "cpu_usage_cu",
        label: "CPU Usage : cu",
        regex: cpuUsageRegex,
        group: 3,
        postProcess: parseFloat
    },
    {
        uid: "cpu_usage_cs",
        label: "CPU Usage : cs",
        regex: cpuUsageRegex,
        group: 4,
        postProcess: parseFloat
    },
    {
        uid: "cpu_load",
        label: "CPU load",
        regex: cpuUsageRegex,
        group: 5,
        unit: "%",
        postProcess: parseFloat
    },
    {
        uid: "req_per_second",
        label: "requests/sec",
        regex: reqStatRegex,
        group: 1,
        unit: "r/s",
        postProcess: parseFloat
    },
    {
        uid: "byte_per_second",
        label: "B/second",
        regex: reqStatRegex,
        group: 2,
        unit: "B/s",
        postProcess: parseFloat
    },
    {
        uid: "byte_per_request",
        label: "B/request",
        regex: reqStatRegex,
        group: 3,
        unit: "B/r",
        postProcess: parseFloat
    },
    {
        uid: "duration_per_request",
        label: "ms/request",
        regex: reqStatRegex,
        group: 4,
        unit: "ms/r",
        postProcess: parseFloat
    },
    {
        uid: "requests_currently_being_processed",
        label: "requests currently being processed",
        regex: processedReqRegex,
        group: 1,
        postProcess: parseInt
    },
    {
        uid: "idle_workers",
        label: "idle workers",
        regex: processedReqRegex,
        group: 2,
        postProcess: parseInt
    },

];

function processBody(body) {
    return [
        extractDataVariables(body),
        buildTable(body)
    ];

}

function extractDataVariables(body) {
    var variables = [];
    parametersConfig.forEach(function (param) {
        var match = body.match(param.regex);
        if (!match || match.length <= param.group) {
            console.warn("match not found for parameter " + param.label);
            return;
        }
        var data = match[param.group];
        if (param.postProcess && typeof (param.postProcess) == "function") {
            data = param.postProcess.apply(param, [data]);
        }
        variables.push(D.device.createVariable(param.uid, param.label, data, param.unit));
    });
    return variables;
}

function buildTable(body) {
    var $ = D.htmlParse(body);
    var processTable = $("table tbody")[0];
    processTable.children.filter(function (node, index) {
        return index > 0 && node.name == "tr";
    }).forEach(function (node, index) {
        var row = node.children.map(function (td, index) {
            var text = $(td).text().trim();
            if(index == 3){
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

    getApache2Status()
        .then(processBody)
        .spread(D.success)
        .catch(failure);
}