/**
 * This Driver Dynamically extracts sensor values from IQ4E trend controller.
 * Communication protocol is HTTP without authentication.
 * Creates a dynamic number of custom driver variables based on the number of sensor items (up to 1000).
 */

// The HTTP request options
var httpOptions = {
    url: '/S.htm?ovrideStart=0&count=1000'
}

/**
 * Utility function.
 * Checks if the http response object contains any errors.
 * Triggers Failure Callback in case of unaccepted status codes.
 */
 function validateHttpResponse(response) {
    if (response.statusCode === 401 || response.statusCode === 403) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (response.statusCode >= 400) {
        D.failure(D.errorType.GENERIC_ERROR);
    };
};

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate(){
    function callbackValidate(error, response, body) {
        // We first need to validate for any common errors on the http response
        validateHttpResponse(response)
        // Secondly we validate if the http resource we have called contains any table data for the sensors
        var $ = D.htmlParse(body);
        var dataPath = 'body > div[id=wrapper] > div[id=main] > div[id=mainData] > div[id=mainContent] > table > tbody > tr[class="data "]';
        if (dataPath === null || dataPath === undefined || dataPath.length < 1){
            // Calling failure callback in case of no dataPath content
            D.failure(D.errorType.PARSING_ERROR);
        } else {
            // Calling success callback in case the parsing for the table data has more than one item returned
            D.success();
        }
    }
    D.device.http.get(httpOptions, callbackValidate);
} 

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used for updating the status EdgeRouter Device Custom Driver Variables for the DHCP leases
 */
function get_status() {
    function callbackGetStatus(error, response, body) {
        // We first need to validate for any common errors on the http response
        validateHttpResponse(response)
        var variables = [];
        // We utilize the utility library for HTML parsing as defined in https://portal.domotz.com/custom-driver/D.html and storing the returned interface in a variable called '$'
        var $ = D.htmlParse(body);
        // The Data path variable shows the HTML dom tree path where our table rows reside (for more information see https://cheerio.js.org/interfaces/CheerioAPI.html )
        var dataPath = 'body > div[id=wrapper] > div[id=main] > div[id=mainData] > div[id=mainContent] > table > tbody > tr[class="data "]';
        // The table Data parser callback is used to create a domotz custom driver variable object for each table element returned in the DOM
        function tableDataParserCallback(index, element) {
            // We get the text for this html element
            var tableData = $(element).text();
            // Split it in lines to get all table data elements from the table row
            var dataLines = tableData.split('\n');
            // We define the unique identifier for each table row element (driver variable)
            var uid = dataLines[1].trim();
            // We define the label for the variable
            var label = dataLines[2].trim();
            // We define the value for the variable
            var value = dataLines[3].trim()
            // We define the unit for the variable
            var unit = dataLines[4].trim()
            var variable = D.device.createVariable(
                uid,
                label,
                value,
                unit
            );
            // Append the variable to the custom driver variables list
            variables.push(variable);
        };
        // For each of the returned DOM element in the list execute the callback function 'tableDataParserCallback'
        $(dataPath).each(tableDataParserCallback);
        // We call the success callback with the populated variables list object
        D.success(variables);
    };
    D.device.http.get(httpOptions, callbackGetStatus);
}