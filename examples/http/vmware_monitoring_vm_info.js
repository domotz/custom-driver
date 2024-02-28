/**
 * Domotz Custom Driver 
 * Name: VMWare Monitoring VM Info
 * Description:  Monitors Virtual Machines running on VMware server 
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on VMWare vCenter version 7.0.3
 *
 * Creates a Custom Driver variables:
 *      - Name: Name of the Virtual machine
 *      - Instance UUID: Unique identifier for the Virtual Machine
 *      - Operating System: Operating system of the Virtual Machine 
 *      - Memory: Memory size in Gigabytes
 *      - Processors: The number of CPU cores
 *      - Cores per socket: The number of CPU cores per socket
 *      - Version: The valid virtual hardware versions for a virtual machine
 *      - Power state: The valid power states for a virtual machine
 * 
 **/

// The ID of the virtual machine
var vmId = D.getParameter("vmId");

// Logs in to the VMWare device using basic authentication.
function login() {
    var d = D.q.defer();
    var config = {
        url: "/api/session",
        username: D.device.username(),
        password: D.device.password(),
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    };
    D.device.http.post(config, function(error, response, body){
        if (error) {          
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode == 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 201) {
            D.failure(D.errorType.GENERIC_ERROR);
        } 
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

// This function retrieves information about a specific virtual machine
function getVMInfo(sessionId) {
    var d = D.q.defer();
    var config = {
        url: "/api/vcenter/vm/" + vmId,
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
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        } 
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

// This function extracts relevant data from the Virtual Machine information response
function extractData(data){
    if (!data) {
        console.error("No data available");        
        D.failure(D.errorType.GENERIC_ERROR);
    }
    var name = data.name;
    var instanceUuid = data.identity.instance_uuid;
    var operatingSystem = data.guest_OS;
    var memorySize = data.memory.size_MiB / 1024;
    var processors = data.cpu.count;
    var cores = data.cpu.cores_per_socket;
    var version = data.hardware.version;
    var powerState = data.power_state;
    var variables = [
        D.createVariable("name", "Name", name, null, D.valueType.STRING),
        D.createVariable("instance-uuid", "Instance UUID", instanceUuid, null, D.valueType.STRING),
        D.createVariable("os", "Operating System", operatingSystem, null, D.valueType.STRING),
        D.createVariable("memory", "Memory", memorySize, "GB", D.valueType.NUMBER),
        D.createVariable("processors", "Processors", processors, null, D.valueType.NUMBER),
        D.createVariable("cores", "Cores per socket", cores, null, D.valueType.NUMBER),
        D.createVariable("version", "Version", version, null, D.valueType.STRING),
        D.createVariable("Power-state", "Power state", powerState, null, D.valueType.STRING)
    ];
    D.success(variables);
}
  
/**
 * @remote_procedure
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the VMWare device
 */
function validate(){
    login()
        .then(getVMInfo)
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
 * @label Get Virtual Machine Info 
 * @documentation This procedure is used to retrieve information about a specific virtual machine running on a VMware server
 */
function get_status() {
    login()
        .then(getVMInfo)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
