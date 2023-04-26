/**
 * The driver uses the AWS CloudWatch API to monitor the CloudWatch metrics for an AWS billing.
 * Is retrieving billing metrics from AWS to monitor AWS cost and usage to ensure that the cost of AWS usage does not exceed the allocated budget.
 * 
 * Communication protocol is https.
 */

//These functions are used to compute hash-based message authentication codes (HMAC) using a specified algorithm.
function sha256(message) {
    return D.crypto.hash(message, "sha256", null, "hex");
}
function hmac(algo, key, message) {
    key = D._unsafe.buffer.from(key);
    return D.crypto.hmac(message, key, algo, "hex");
}

var region = "ADD_REGION";
var accessKey = D.device.username(); //accessKey == username
var secretKey = D.device.password(); //secretKey == password
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

var requestPeriod = 24 * 60 * 60;
var timestamp = new Date().getTime();
var endTime = (new Date(timestamp).toISOString()).split("T")[0];
var startTime = (new Date(timestamp - requestPeriod * 1000).toISOString()).split("T")[0];

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
        "End": endTime,
        "Start": startTime
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
        device = D.createExternalDevice(service + "." + region + ".amazonaws.com"),
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
    device.http.post({
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
            if (response.statusCode === 401 || response.statusCode === 403) {
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
        return parseFloat(billing[propertyName].Amount).toFixed(3);
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

// This function handles errors
function failure(err) {
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
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
        }).catch(failure);
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to extract monitoring parameters from AWS billing.
 */
function get_status() {
    getBillingMetrics()
        .then(fillConfig)
        .then(extract)
        .then(function () {
            D.success(vars);
        }).catch(failure);
}