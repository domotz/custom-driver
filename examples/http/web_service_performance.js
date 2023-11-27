/**
 * Name: Web Services Performance
 * Description: monitor the performance of web services by measuring their response time
 * 
 * Return a table with this columns:
 *  - Response Status: The status code of the HTTP response, or -1 if an error occurred
 *  - Response Time: The response time for each urls
 */

// Table to store the response times of the URLs
var table = D.createTable(
    "Server Response Time",
    [
        { label: "Response Status" },
        { label: "Response Time" , unit: "ms", type: D.valueType.NUMBER}
    ]
);

// List of servers to check the response time
var urls = D.getParameter("urls");

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
    var address, port, path;

    var hasProtocol = /^https?:\/\//i.test(url);

    if (!hasProtocol) {
        url = "http://" + url;
    }
    var urlParts = /^https?:\/\/([^:/]+)(?::(\d+))?([^#]*)/.exec(url);

    if (urlParts) {
        address = urlParts[1];
        port = urlParts[2] || "";
        path = urlParts[3] || "/";
    } else {
        console.error("Invalid URL format");
        return d.resolve({
            server: url,
            statusCode: -1,
            responseTime: -1
        });
    }
    
    var website = D.createExternalDevice(address);
    var start = new Date();
    website.http.get({
        url: path,
        timeout: 5000,
        time: true,
        port: port
    }, function (err, resp) {
        var data = {
            server: hasProtocol ? url : url.replace(/^https?:\/\//i, ''),
            statusCode: resp ? resp.statusCode : -1,
            responseTime: -1
        };
        if (err) {
            console.error(err);
            return d.resolve(data);
        }
        if (resp && resp.elapsedTime) {
            data.responseTime = resp.elapsedTime;
        } else {
            data.responseTime = new Date() - start;
        }
        d.resolve(data);
    });

    return d.promise;
}

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

/**
 * @param {Array} result  Array of objects containing server response time data
 */
function fillTable(result) {
    result.filter(function (data) {
        return data;
    }).forEach(function (data) {
        var recordId = sanitize(data.server);
        table.insertRecord(
            recordId, [data.statusCode, data.responseTime]
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
 * @label Get Response Times 
 * @documentation This procedure is used for testing the response time of web servecices.
 */
function get_status() {
    getResponseTimes()
        .then(fillTable)
        .catch(failure);
}