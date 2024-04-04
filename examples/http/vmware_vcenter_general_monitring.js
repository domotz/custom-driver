/**
 * Domotz Custom Driver 
 * Name: VMWare vCenter Monitoring General Info
 * Description: Monitors the general information for VMWare vCenter systems
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on VMWare vCenter version 8.0.2
 *
 * Creates Custom Driver variables:
 *      - Product Name: The name of the VMWare 
 *      - Product Type: The type of VMWare 
 *      - Version: The version of the VMWare 
 *      - Build Number: The build number of the VMWare 
 *      - Release Date: The release date of the VMWare 
 *      - Install Time: The installation time of the VMWare 
 *
 **/

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

// This function retrieves VMware vCenter information
function getVmwareVcenterInfo(sessionId) {
    var d = D.q.defer();
    var config = {
        url: "/api/appliance/system/version",
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

// Extracts relevant data from the API response
function extractData(data) {
    if (!data) {
        console.error("No data available");        
        D.failure(D.errorType.GENERIC_ERROR);
    }
    if (data.product || data.type || data.version || data.build || data.releasedate || data.install_time) {
        var productName = data.product;
        var type = data.type;
        var version = data.version;
        var build = data.build;
        var releaseDate = data.releasedate;
        var installTime = data.install_time;
        var date = new Date(installTime);

        var formattedInstallTime =
            (date.getUTCDate() < 10 ? "0" : "") + date.getUTCDate() + ":" +
            (date.getUTCMonth() + 1 < 10 ? "0" : "") + (date.getUTCMonth() + 1) + ":" +
            date.getUTCFullYear() + " " +
            (date.getUTCHours() < 10 ? "0" : "") + date.getUTCHours() + ":" +
            (date.getUTCMinutes() < 10 ? "0" : "") + date.getUTCMinutes() + ":" +
            (date.getUTCSeconds() < 10 ? "0" : "") + date.getUTCSeconds() + " UTC";
      
        var variables = [
            D.createVariable("product-name", "Product Name", productName, null, D.valueType.STRING),
            D.createVariable("type", "Product Type", type, null, D.valueType.STRING),
            D.createVariable("version", "Version", version, null, D.valueType.STRING),
            D.createVariable("build-number", "Build Number", build, null, D.valueType.STRING),
            D.createVariable("release-date", "Release Date", releaseDate, null, D.valueType.STRING),
            D.createVariable("install-time", "Install Time", formattedInstallTime, null, D.valueType.STRING)
        ];
        D.success(variables);

    } else {
        console.error("Missing required properties in the data");
        D.failure(D.errorType.PARSING_ERROR);
    }
}

/**
 * @remote_procedure
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the VMWare device
 */
function validate(){
    login()
        .then(getVmwareVcenterInfo)
        .then(function (response) {
            if (response) {
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
 * @label Get VMware vCenter information
 * @documentation This procedure is used to retrieve general information of a VMWare vCenter system
 */
function get_status() {
    login()
        .then(getVmwareVcenterInfo)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}