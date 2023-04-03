/**
 * The driver retrieves billing metrics from Amazon Web Services (AWS) CloudWatch API.
 * Communication protocol is https.
 */

var crypto = require("crypto");
//These functions are used to compute hash-based message authentication codes (HMAC) using a specified algorithm.
function sha256(message) {
    return crypto.createHash("sha256").update(message).digest("hex");
}
function hmac(algo, key, message) {
    return crypto.createHmac(algo, key).update(message).digest("hex");
}

var region = "ADD_REGION";
var secretKey = "ADD_SECRET_ACCESS_KEY";
var accessKey = "ADD_ACCESS_KEY";
var billing;

function sign(key, message) {
    var hex = hmac("sha256", key, message);
    if ((hex.length % 2) === 1) {
        throw "Invalid length of a hex string!";
    }
    var result = new Int8Array(hex.length / 2);
    for (var i = 0, b = 0; i < hex.length; i += 2, b++) {
        result[b] = parseInt(hex.substring(i, i + 2), 16);
    }
    return result;
}

//This function formats a given date object into a string of the form "YYYY-MM-DD".
function formatDate(date) {
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    return year + "-" + month.toString().padStart(2, "0") + "-" + day.toString().padStart(2, "0");
}
var end = new Date();
var start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

/**
 * CloudWatch metrics to be monitored for an AWS billing.
 */
var body = JSON.stringify({
    "Filter": {
        "Not": {
            "Or": [
                {
                    Dimensions: {
                        Key: "RECORD_TYPE",
                        Values: [
                            "Refund"
                        ]
                    }
                },
                {
                    Dimensions: {
                        Key: "RECORD_TYPE",
                        Values: [
                            "Credit"
                        ]
                    }
                }
            ],
        }
    },

    "Granularity": "DAILY",
    "Metrics": [
        "AmortizedCost",
        "BlendedCost",
        "NetAmortizedCost",
        "NetUnblendedCost",
        "NormalizedUsageAmount",
        "UnblendedCost",
        "UsageQuantity"
    ],
    "TimePeriod": {
        "End": formatDate(end),
        "Start": formatDate(start)
    }
});

/**
 * @returns an HTTP POST request to an Amazon Web Services (AWS) endpoint.
 */
function httpPost() {
    var d = D.q.defer();
    var service = "ce";
    var method = "POST";
    var amzdate = (new Date()).toISOString().replace(/\.\d+Z/, "Z").replace(/[-:]/g, ""),
        date = amzdate.replace(/T\d+Z/, ""),
        host = service + "." + region + ".amazonaws.com",
        canonicalUri = "/",
        canonicalHeaders = "host:" + host + "\n" + "x-amz-date:" + amzdate + "\n",
        signedHeaders = "host;x-amz-date",
        canonicalRequest = method + "\n" + canonicalUri + "\n" + "\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + sha256(body),
        credentialScope = date + "/" + region + "/" + service + "/aws4_request",
        requestString = "AWS4-HMAC-SHA256" + "\n" + amzdate + "\n" + credentialScope + "\n" + sha256(canonicalRequest),
        key = sign("AWS4" + secretKey, date);
    key = sign(key, region);
    key = sign(key, service);
    key = sign(key, "aws4_request");
    var auth = "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + credentialScope + ", " + "SignedHeaders=" + signedHeaders + ", " + "Signature=" + hmac("sha256", key, requestString);
    D.device.http.post({
        url: canonicalUri,
        protocol: "https",
        headers: {
            "x-amz-date": amzdate,
            "X-Amz-Target": "AWSInsightsIndexService.GetCostAndUsage",
            "Content-Type": "application/x-amz-json-1.0",
            "Authorization": auth,
            "Host": host,
        },
        body: body
    },
        function (err, response, body) {
            if (err) {
                D.failure(D.errorType.GENERIC_ERROR);
            }
            if (response.statusCode == 404) {
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            }
            if (response.statusCode == 401) {
                D.failure(D.errorType.AUTHENTICATION_ERROR);
            }
            if (response.statusCode != 200) {
                console.error(body);
                D.failure(D.errorType.GENERIC_ERROR);
            }
            d.resolve(JSON.parse(body));
        });
    return d.promise;
}

/**
 * @returns promise for http response containing billing metrics 
 */
function getBillingMetrics() {
    var payload = {};
    return httpPost(payload)
        .then(function (data) {
            billing = data.ResultsByTime[0].Total;
        });
}

/**
 * @param {string} propertyName  The label to search for in the metric array.
 * @returns Return the Amount property value of the billing object using the propertyName as the key.
 */
function getBilling(propertyName) {
    return function () {
        return billing[propertyName].Amount;
    };
}

// The list of custom driver variables to monitor
function fillConfig() {
    monitoringList = [
        {
            //The total amortized cost of your usage, including any upfront or recurring fees associated with using a reserved instance or savings plan.
            uid: "AmortizedCost",
            label: "AmortizedCost",
            execute: getBilling("AmortizedCost"),
            unit: "USD"
        },
        {
            //The total cost of your usage, including any discounts or credits that have been applied. 
            uid: "BlendedCost",
            label: "BlendedCost",
            execute: getBilling("BlendedCost"),
            unit: "USD"
        },
        {
            //The total amortized cost of your usage, minus any applicable discounts or credits.
            uid: "NetAmortizedCost",
            label: "NetAmortizedCost",
            execute: getBilling("NetAmortizedCost"),
            unit: "USD"
        },
        {
            //The total cost of your usage, minus any applicable discounts or credits, without blending across usage types or operations.
            uid: "NetUnblendedCost",
            label: "NetUnblendedCost",
            execute: getBilling("NetUnblendedCost"),
            unit: "USD"
        },
        {
            //The normalized usage amount for a specific resource, factoring in any differences in resource usage across different instance sizes, regions, or other dimensions. 
            uid: "NormalizedUsageAmount",
            label: "NormalizedUsageAmount",
            execute: getBilling("NormalizedUsageAmount"),
            unit: "N/A"
        },
        {
            //The total cost of your usage, without blending across usage types or operations. 
            uid: "UnblendedCost",
            label: "UnblendedCost",
            execute: getBilling("UnblendedCost"),
            unit: "USD"
        },
        {
            //The quantity of a specific resource that was used during a given time period.
            uid: "UsageQuantity",
            label: "UsageQuantity",
            execute: getBilling("UsageQuantity"),
            unit: "N/A"
        },
    ];
}

/**
* @param {[object]} data array of objects 
* @returns list of domotz variables
*/
function extract(data) {
    vars = monitoringList.map(function (c) {
        var result;
        if (Array.isArray(c.execute)) {
            result = c.execute.reduce(function (a, b) { return b(a); }, data);
        } else if (typeof (c.execute) == "function") {
            result = c.execute(data);
        }
        if (result != null) {
            return D.device.createVariable(c.uid, c.label, result, c.unit, c.type);
        } else {
            return null;
        }
    }).filter(function (v) {
        return v != null;
    });
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver AWS billing instance is accessible.
 */
function validate() {
    getBillingMetrics()
        .then(function () {
            D.success();
        });
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to extract monitoring parameters from AWS billing.
 */
function get_status() {
    getBillingMetrics()
        .then(function () {
            fillConfig();
        })
        .then(extract)
        .then(function () {
            D.success(vars);
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}