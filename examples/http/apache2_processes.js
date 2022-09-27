/**
 * This driver show apache2 status
 * The communication protocol is http
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
    // port: 9011, // http port number
    // auth: "basic",
    // username: D.device.username(),
    // password: D.device.password(),
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
        if(response.statusCode == 401){
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        if(response.statusCode == 404){
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        d.resolve(body);
    });

    return d.promise;
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
* @documentation This procedure is used to validate if the call to the apache status page is ok
*/
function validate() {
    getApache2Status()
        .then(function(){ D.success() ;})
        .catch(failure);
}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for monitoring apache2 related processes
*/
function get_status() {

    getApache2Status()
        .then(buildTable)
        .then(D.success)
        .catch(failure);
}