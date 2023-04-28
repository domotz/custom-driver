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
    "Response Times",
    [
        { label: "Server" },
        { label: "Status" },
        { label: "Response Time (ms)" }
    ]
);

// List of servers to check the response time
var urls = ["www.facebook.com", "www.google.com", "www.github.com", "www.domotz.com", "www.twitter.com"];

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
 * @returns Promise that wait for the HTTPS call to the URL and parse the response data
 */
function responseTime(url) {
    var d = D.q.defer();
    var website = D.createExternalDevice(url);
    var start = new Date();
    website.http.get({
        url: "/",
        protocol: "https"
    }, function (err, resp) {
        if (err) {
            console.error(err);
            return d.resolve(-1);
        }
        var end = new Date();
        var responseTime = end - start;
        var data = {
            server: url,
            statusCode: resp ? resp.statusCode : -1,
            responseTime: responseTime
        };
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
        table.insertRecord(
            data.server, [data.server, data.statusCode, data.responseTime]
        );
    });
    D.success(table);
}

function failure(err) {
    console.error(err);
    D.failure();
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