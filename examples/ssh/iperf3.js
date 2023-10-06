/**
 * Domotz Custom Driver
 * Name: IPerf3 Speed Test
 * Description: This script is designed to retrieve network speed data using iPerf3.
 * 
 * Communication protocol is SSH.
 * 
 * 
 * This driver create a dynamic monitoring variables 
 *      Download speed: test for download speed.
 *      Upload speed: test for upload speed.
 *      Download speed UDP: test for UDP download speed.
 *      Upload speed UDP: test for UDP upload speed. 
 * 
 * Tested on:
 * - Ubuntu 22.04.1 LTS
 * - with iperf3 version: v3.7
 *
 * 
 * The driver is currently using a public iPerf3 server which might stop working in the future.
 * If that is the case, you might try with another server which you might find at this URL: https://iperf.fr/iperf-servers.php 
 * or instead, you might setup you own iPerf3 server. 
 * 
 * You can edit the targetServer object to configure the iPerf3 server to be used. 
 * 
 */

// Define SSH configuration
var sshConfig = {
    timeout: 20000
};

// List of iperf3 servers that the host will test with (ip_or_dns:port)
// if the port is not specified the default one will be used "5201"
var targetServerUrl = D.getParameter('targetServer');
var defaultIperfPort = 5201;


// Define the commands to be executed via SSH to retrieve speed data and variable configuration
var execConfig = [
    {
        id: "download_speed",
        label: "Download speed",
        command: "iperf3 -t 5 -f m -c {url} -p {port} -R",
        extractor: tcpExtractor
    },
    {
        id: "upload_speed",
        label: "Upload speed",
        command: "iperf3 -t 5  -f m -c {url} -p {port}",
        extractor: tcpExtractor
    },
    {
        id: "download_speed_udp",
        label: "Download speed UDP",
        command: "iperf3 -t 5  -f m -c {url} -p {port} -u -R",
        extractor: udpExtractor
    },
    {
        id: "upload_speed_udp",
        label: "Upload speed UDP",
        command: "iperf3 -t 5  -f m -c {url} -p {port} -u",
        extractor: udpExtractor
    }
];

function tcpExtractor(data) {
    var result = data.split("\n")
        .filter(function (line) { return line.indexOf("sender") >= 0; });
    return result.length > 0 ? result[0].split(/\s+/)[6] : null;
}

function udpExtractor(data) {
    var result = data.split("\n");
    var dataLength = result.length;
    result = result.filter(function (line, i) {
        return i == dataLength - 4;
    });
    return result.length > 0 ? result[0].split(/\s+/)[6] : null;
}

//Checking SSH errors and handling them
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    D.failure(D.errorType.GENERIC_ERROR);
}

// Function for executing SSH command 
// this function test the iperf command, if the current server fails to respond the next will be called
function executeCommand(commandTemplate, serverIndex, extractorFn) {
    return function (result) {
        var d = D.q.defer();
        var command = commandTemplate;

        if (serverIndex !== null) {
            if (serverIndex < targetServerUrl.length) {
                var server = targetServerUrl[serverIndex];
                var hostPort = server.split(":");

                command = command.replace("{url}", hostPort[0]).replace("{port}", hostPort.length == 2 ? hostPort[1] : defaultIperfPort);
                sshConfig.command = command;
                D.device.sendSSHCommand(sshConfig, function (out, err) {
                    if (err) {
                        return d.reject(err);
                    }
                    if (extractorFn)
                        result.push(extractorFn(out));
                    d.resolve(result);
                });
            } else {
                console.error("no more server to test with");
                result.push(null);
                d.resolve(result);
            }
        }

        return d.promise.catch(function (err) {
            console.error(err.message);
            return executeCommand(commandTemplate, serverIndex + 1, extractorFn)(result);
        });
    };
}

//This function execute the SSH commands to retrieve network speed data using the iperf3 tool.
function execute() {
    var commands = [
        executeCommand(execConfig[0].command, 0, tcpExtractor),
        executeCommand(execConfig[1].command, 0, tcpExtractor),
        executeCommand(execConfig[2].command, 0, udpExtractor),
        executeCommand(execConfig[3].command, 0, udpExtractor)
    ];

    return commands.reduce(D.q.when, D.q([]))
        .then(function (result) {
            return result.map(function (res, index) {
                if (res == null){
                    res = -1;
                }
                return D.device.createVariable(execConfig[index].id, execConfig[index].label, res, "Mb/s");
            });
        }).then(function (vars) {
            if (!vars.length)
                failure("All target servers are not available");
            return vars;
        });
}

//This function is a failure handler for SSH command execution. 
function failure(error) {
    console.error("Received Error: " + JSON.stringify(error));
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This function is used to check if the iperf3 command is available.
*/
function validate() {
    // Check if the iperf3 command is available
    sshConfig.command = "which iperf3";
    D.device.sendSSHCommand(sshConfig, function (output, error) {
        if (error) {
            failure(error);
        } else {
            D.success();
        }
    });
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving iperf3 results
*/
function get_status() {
    execute()
        .then(D.success)
        .catch(failure);
}
