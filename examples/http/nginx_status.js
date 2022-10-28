/**
 * this driver is based on nginx module "ngx_http_stub_status_module"
 * You need to read this http://nginx.org/en/docs/http/ngx_http_stub_status_module.html 
 * before using this driver
 * this driver is tested under nginx version: nginx/1.14.0 (Ubuntu)
 */
// nginx status page config
var nginxStatusHttpConfig = {
    port: 8080,
    url: "/nginx_status"
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
        console.log(JSON.stringify(response));
        if (error) {
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
        var active_cnx_group = lines[0].match(/^.+(\d+)\s*$/);
        var stats_group = lines[2].match(/^\s+(\d+)\s+(\d+)\s+(\d+)\s*$/);
        var rww_group = lines[3].match(/^.+:\s+(\d+).+:\s+(\d+).+:\s+(\d+).*$/);
        var variables = [
            D.device.createVariable("server", "Server", response.headers.server),
            D.device.createVariable("active_cnx", "Active connections", active_cnx_group[1]),
            D.device.createVariable("accepted_cnx", "Accepted connections", stats_group[1]),
            D.device.createVariable("handled_cnx", "Handled connections", stats_group[2]),
            D.device.createVariable("total_req", "Total requests", stats_group[3]),
            D.device.createVariable("reading", "Reading", rww_group[1]),
            D.device.createVariable("writing", "Writing", rww_group[2]),
            D.device.createVariable("waiting", "Waiting", rww_group[3]),

        ];
        D.success(variables);
    });
}