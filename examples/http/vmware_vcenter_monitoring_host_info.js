/**
 * Domotz Custom Driver 
 * Name: VMWare vCenter Monitoring Host info
 * Description: This script retrieves detailed information about VMware vCenter hosts.
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on VMWare vCenter version 8.0.2
 *
 * Creates a Custom Driver variables:
 *      - Name: The name of the host
 *      - Model: The hardware vendor and system model identification
 *      - Operating System: The operating system installed on the host
 *      - CPU: The CPU model
 *      - Processors: Number of physical CPU packages on the host
 *      - Cores: Number of physical CPU cores on the host
 *      - Memory: The physical memory size in GiB
 *      - Memory Usage: The percentage of used memory
 *      - CPU Usage: The percentage of CPU usage
 *      - Power State: The host power state
 *      - Connection State: The hostconnection state
 *      - Status: The overall health status of the host
 *      - Uptime: The system uptime of the host in hours
 * 
 **/

// The host ID
var hostId = D.getParameter("hostId");

// Function to handle the login procedure
function login() {
    var d = D.q.defer();
    var config = {
        url: "/sdk/vim25/8.0.1.0/SessionManager/SessionManager/Login",
        protocol: "https",
        jar: true,
        rejectUnauthorized: false,
        body: JSON.stringify({
            "userName": D.device.username(),
            "password": D.device.password() 
        })
    };
    D.device.http.post(config, function(error, response){
        if (error) {  
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);                     
        } else {
            if (response.body && response.body.indexOf("Cannot complete login") !== -1) {
                console.error("Cannot complete login due to an incorrect username or password");
                D.failure(D.errorType.AUTHENTICATION_ERROR);
            }
            if (response.body && response.body.indexOf("Invalid URI") !== -1) {
                console.error("Invalid URI");
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            }
            var sessionId = response.headers["vmware-api-session-id"];
            d.resolve(sessionId);
        }         
    });
    return d.promise;
}

// This function retrieves host information
function getHostInfo(sessionId) {
    var d = D.q.defer();
    var config = {
        url: "/sdk/vim25/8.0.1.0/HostSystem/" + hostId + "/summary",
        protocol: "https",
        jar: true,
        rejectUnauthorized: false,
        headers: {
            "vmware-api-session-id": sessionId 
        }
    };
    D.device.http.get(config, function(error, response, body){
        if (error) {          
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } else  {
            if (response.body && response.body.indexOf("Invalid URI") !== -1) {
                console.error("Invalid URI");
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            }
            if (response.body && response.body.indexOf("already been deleted or has not been completely created") !== -1) {
                console.error("The " + hostId + " has already been deleted or has not been completely created");
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            }
            d.resolve(JSON.parse(body));
        } 
    });
    return d.promise;
}

// This function extracts data from the response body  
function extractData(data) {
    if (data) {
        var name = data.config.name || "N/A"; 
        var hardwareVendor = data.hardware.vendor || "N/A"; // The hardware vendor identification
        var systemModel = data.hardware.model || "N/A"; // The system model identification
        var model = hardwareVendor + " " + systemModel;
        var productName = data.config.product.fullName || "N/A"; // The complete product name, including the version information
        var osType = data.config.product.osType || "N/A"; // Operating system type and architecture
        var os =  productName + " (" + osType + ")";
        var cpu = data.hardware.cpuModel || "N/A";
        var processors = data.hardware.numCpuPkgs || 0;
        var cores = data.hardware.numCpuCores || 0;
        var memoryInBytes = data.hardware.memorySize || 0; // The physical memory size in bytes
        
        var memoryInGiB = (memoryInBytes / Math.pow(1024, 3)).toFixed(2);
        var memoryInMiB = (memoryInBytes / Math.pow(1024, 2)).toFixed(2);
        var usedMemory = data.quickStats.overallMemoryUsage || 0; // Physical memory usage on the host in MB
        var memoryUsage = ((usedMemory / memoryInMiB) * 100).toFixed(2);
        var cpuMhz = data.hardware.cpuMhz || 0; // The speed of the CPU cores
        var numCpuCores = data.hardware.numCpuCores || 0; // Number of physical CPU cores on the host
        var totalCpuCapacity = cpuMhz * numCpuCores ;
        var usedCPU = data.quickStats.overallCpuUsage || 0; // Aggregated CPU usage across all cores on the host in MHz
        var cpuUsage = ((usedCPU / totalCpuCapacity) * 100).toFixed(2); 
        var powerState = data.runtime.powerState || "N/A";
        var connectionState = data.runtime.connectionState || "N/A";

        var colorToStatus = {
            "gray": "N/A",
            "green": "OK",
            "yellow": "WARNING",
            "red": "NOT OK"
        }

        var health = data.overallStatus || "N/A";
        var status = colorToStatus[health] || "N/A"
        var uptime = Math.floor(data.quickStats.uptime / 3600);
       
        var variables = [
            D.createVariable("name", "Name", name, null, D.valueType.STRING),
            D.createVariable("model", "Model", model, null, D.valueType.STRING),
            D.createVariable("os", "Operating System", os, null, D.valueType.STRING),
            D.createVariable("cpu", "CPU Model", cpu, null, D.valueType.STRING),
            D.createVariable("processors", "Processors", processors, null, D.valueType.NUMBER),
            D.createVariable("cores", "Cores", cores, null, D.valueType.NUMBER),
            D.createVariable("memory", "Memory", memoryInGiB, "GiB", D.valueType.NUMBER),
            D.createVariable("memory-usage", "Memory Usage", memoryUsage, "%", D.valueType.NUMBER),
            D.createVariable("cpu-usage", "CPU Usage", cpuUsage, "%", D.valueType.NUMBER),
            D.createVariable("power-state", "Power State", powerState, null, D.valueType.STRING),
            D.createVariable("connection-state", "Connection State", connectionState, null, D.valueType.STRING),
            D.createVariable("status", "Status", status, null, D.valueType.STRING),
            D.createVariable("uptime", "Uptime", uptime, "hours", D.valueType.NUMBER)
        ];
        D.success(variables);
    } else {
        console.log("No data available");
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * @remote_procedure
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the VMWare device
 */
function validate(){
    login()
        .then(getHostInfo)
        .then(function (response) {
            if (response && Object.keys(response).length > 0) {
                console.info("Data available");
                D.success();
            } else {
                console.error("No data available");
                D.failure(D.errorType.GENERIC_ERROR);
            }
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get VMware vCenter Host info
 * @documentation This procedure retrieves detailed information about a specific VMware vCenter hosts
 */
function get_status() {
    login()
        .then(getHostInfo)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
