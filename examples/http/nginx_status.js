/**
 * this driver is based on nginx module "ngx_http_stub_status_module"
 * You need to read this http://nginx.org/en/docs/http/ngx_http_stub_status_module.html 
 * before using this driver
 * this driver is tested under nginx version: nginx/1.14.0 (Ubuntu)
 */
// nginx status page config
var nginxStatusHttpConfig = {
    port: 8080,
    url: "/basic_status"
};

/**
* Utility function.
* Checks if the response object contains any errors.
* Triggers Failure Callback in case of authentication error or unacceptable status codes.
*/
function validateAuthentication(response) {
    if (response.statusCode === 401 || response.statusCode === 403) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (response.statusCode >= 400) {
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

// calling NGINX status page
function getNginxStatus(successCallback) {
    D.device.http.get(nginxStatusHttpConfig, function (error, response) {
        if (error) {
            console.error(error);
            return D.failure(D.errorType.GENERIC_ERROR);
        }
        if(!response){
            D.failure(D.errorType.GENERIC_ERROR);
        }
        validateAuthentication(response);
        successCallback(response);

    });
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    getNginxStatus(function () {
        D.success();
    });
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    getNginxStatus(function (response) {
        var data = response.body;
        var lines = data.split("\n");
        if(lines.length < 4) D.failure(D.errorType.PARSING_ERROR);

        var activeCnxGroup = lines[0].match(/^.+(\d+)\s*$/);
        var statsGroup = lines[2].match(/^\s+(\d+)\s+(\d+)\s+(\d+)\s*$/);
        var rwwGroup = lines[3].match(/^.+:\s+(\d+).+:\s+(\d+).+:\s+(\d+).*$/);
        if(!(activeCnxGroup && statsGroup && rwwGroup)) D.failure(D.errorType.PARSING_ERROR);
        
        var variables = [
            D.device.createVariable("server", "Server", response.headers.server),
            D.device.createVariable("active_cnx", "Active connections", activeCnxGroup[1]),
            D.device.createVariable("accepted_cnx", "Accepted connections", statsGroup[1]),
            D.device.createVariable("handled_cnx", "Handled connections", statsGroup[2]),
            D.device.createVariable("total_req", "Total requests", statsGroup[3]),
            D.device.createVariable("reading", "Reading", rwwGroup[1]),
            D.device.createVariable("writing", "Writing", rwwGroup[2]),
            D.device.createVariable("waiting", "Waiting", rwwGroup[3]),

        ];
        D.success(variables);
    });
}