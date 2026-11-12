/**
 * This Driver collects status information for zoom.us services via an externalHostname.
 * Communication protocol is HTTPS.
 * Creates a dynamic number of custom driver variables based on the number of Reported Services.
 */
var zoomStatusURL = "status.zoom.us";
var httpOptions = {
    protocol: "https",
    rejectUnauthorized: false,
    url: "/"
};

var zoomStatus = D.createExternalDevice(zoomStatusURL);

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device and we can access the zoom status http resource
*/
function validate(){
    function verifyCanAccessResource(error, response, body) {
        if (response.statusCode === 401 || response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode >= 400) {
            D.failure(D.errorType.GENERIC_ERROR);
        } else {
            D.success();
        }
    }
    zoomStatus.http.get(httpOptions, verifyCanAccessResource);
} 

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for updating Zoom Services Status custom driver variables
*/
function get_status(){
    var variables = [];
    // The callback method used for parsing the result from the HTTP call
    function callbackParser(error, response, body) {
        var $ = D.htmlParse(body);
        var dataPath = "body > div[class=\"layout-content status status-index premium\"] > div[class=\"container\"] > div[class=\"components-section font-regular\"]> div[class=\"components-container one-column\"] > div[class=\"component-container border-color\"]";
        // Zoom service section parser
        function serviceParserCb(index, element) {
            var serviceData = $(element).text();
            var dataLines = serviceData.split("\n");
            // Filter the service section data from empty or "?" lines
            dataLines = dataLines.filter(function (e) {return e.trim().length > 0 && e.trim() !== "?";});
            var uid = index.toString();
            var label = dataLines[0].trim();
            var value = dataLines[1].trim();
            // Create a zoom service monitoring driver variable
            var variable = D.device.createVariable(
                uid,
                label,
                value,
                null
            );
            variables.push(variable);
        }
        var serivceRows = $(dataPath);
        serivceRows.each(serviceParserCb);
        D.success(variables);
    }    
    zoomStatus.http.get(httpOptions, callbackParser);
}


