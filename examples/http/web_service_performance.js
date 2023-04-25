/**
 * this driver monitor the performance of web services by measuring their response time.
 * Creates a Custom Variables for each URL with its response time value:
 *  - Label: Taken from the list of urls
 *  - Value: The response time for each urls
 */

function sha256(message) {
    return D.crypto.hash(message, "sha256", null, "hex");
}

// This is an array of URLs to be tested for response time.
var urls = ["www.facebook.com", "www.google.com", "www.github.com", "www.domotz.com", "www.twitter.com"];

/**
 * This function measures the response time of a given URL by making an HTTP GET request.
 * @param {string} url  The URL to be tested.
 */
function responseTime(url) {
    var d = D.q.defer();
    var start = new Date();
    D.device.http.get(url, function (response, error) {
        var end = new Date();
        var responseTime = end - start;
        if (error) {
            d.resolve(-1);
        } else if (response.statusCode >= 200 && response.statusCode < 300) {
            d.resolve(responseTime);
        } else {
            d.failure(-1);
        }
    });
    return d.promise;
}

/**
 * This function tests the response time of each URL in the urls array by calling the responseTime function for each URL
 */
function testUrls() {
    var variables = [];
    urls.forEach(function (url) {
        responseTime(url)
            .then(function (responseTime) {
                var uid = sha256(url).substring(0, 50);
                var unit = "ms";
                var value = responseTime;
                variables.push(
                    D.createVariable(uid, url, value, unit)
                );
                if (variables.length === urls.length) {
                    D.success(variables);
                }
            }).catch(function (error) {
                console.error(error);
            });
    });
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device.
 */
function validate() {
    testUrls();
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used for testing  the response time of web servecices.
 */
function get_status() {
    testUrls();
}