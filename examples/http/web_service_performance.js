/**
 * this driver monitor the performance of web services by measuring their response time.
 * 
 * Return a table with this columns:
 *  - Server: The URL of the server being checked.
 *  - Status: The status code of the HTTP response, or -1 if an error occurred.
 *  - Response Time: The response time for each urls.
 */

// Table to store the response times of the URLs
var table = D.createTable(
    "Server Response Time",
    [
        { label: "Server URL" },
        { label: "Response Status" },
        { label: "Response Time" , unit: "ms", type: D.valueType.NUMBER}
    ]
);

// List of servers to check the response time
var urls = [
    "https://www.facebook.com",
    "https://www.google.com",
];

/** 
 * @returns promise that resolves when all response times have been obtained
 */
function getResponseTimes() {
    return D.q.all(
        urls.map(responseTime)
    );
}

/**
 * @param {*} url server to check its response time
 * @returns Promise that wait for the HTTP call to the URL and parse the response data
 */
function responseTime(url) {
    var d = D.q.defer();
    var parts = url.split("/");
    var address = parts[2];
    var addressParts = address.split(":");
    address = addressParts[0];
    var port = addressParts[1] || "";
    var path = "/";
    var website = D.createExternalDevice(address);
    var start = new Date();
    website.http.get({
        url: path,
        port: port
    }, function (err, resp) {
        var data = {
            server: url,
            statusCode: resp ? resp.statusCode : -1,
            responseTime: -1
        };
        if (err) {
            console.error(err);
            return d.resolve(data);
        }
        data.responseTime = new Date() - start;
        d.resolve(data);
    });
    return d.promise;
}

/**
 * @param {Array} result  Array of objects containing server response time data
 */
function fillTable(result) {
    result.filter(function (data) {
        return data;
    }).forEach(function (data) {
        // the id should be generated as base 64 string which is applied the the requested url
        // because the url could have some special chars and it's length could exceed 50
        var recordId = D._unsafe.buffer.from(data.server).toString('base64').substring(0, 50);
        table.insertRecord(
            recordId, [data.server, data.statusCode, data.responseTime]
        );
    });
    D.success(table);
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
    getResponseTimes()
        .then(function () {
            D.success();
        })
        .catch(failure);
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used for testing the response time of web servecices.
 */
function get_status() {
    getResponseTimes()
        .then(fillTable)
        .catch(failure);
}