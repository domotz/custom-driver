/**
 * The driver gets AWS EBS and uses the script item to make HTTP requests to the CloudWatch API.
 * Communication protocol is https
 */
var crypto = require("crypto");

//These functions are used to compute hash-based message authentication codes (HMAC) using a specified algorithm.
function sha256(message) {
    return crypto.createHash("sha256").update(message).digest("hex");
}
function hmac(algo, key, message) {
    return crypto.createHmac(algo, key).update(message).digest("hex");
}

var region = "Add region";
var secretKey = "Add secret access key";
var accessKey = "Add access key";
var volumeId = "Add RDS instance id";
var requestPeriod = 600;
var volumes;
var vars = [];
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

/** 
 * @returns CloudWatch metrics to be monitored for an AWS EBS.
 */
function createMetricsPayload(period, volumeId) {
    var metricsList = [
        "BurstBalance:Percent",
        "VolumeReadOps:Count",
        "VolumeWriteOps:Count",
        "VolumeTotalReadTime:Seconds",
        "VolumeQueueLength:Count",
        "VolumeWriteBytes:Bytes",
        "VolumeTotalWriteTime:Seconds",
        "VolumeReadBytes:Bytes",
        "VolumeIdleTime:Seconds"
    ];
    return metricsList.map(function (metric) {
        var parts = metric.split(":", 2);
        var name = parts[0].replace(/[^a-zA-Z0-9]/g, "");
        return {
            "Id": name.charAt(0).toLowerCase() + name.slice(1),
            "MetricStat": {
                "Metric": {
                    "MetricName": parts[0],
                    "Namespace": "AWS/EBS",
                    "Dimensions": [
                        {
                            "Name": "VolumeId",
                            "Value": volumeId
                        }
                    ]
                },
                "Period": period,
                "Stat": "Average",
                "Unit": parts[1]
            }
        };
    });
}

/**
 * Authorization based on: https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html 
 * @returns an HTTP POST request to an Amazon Web Services (AWS) endpoint.
 */
function httpPost(data) {
    var d = D.q.defer();
    var service = "monitoring";
    var body = JSON.stringify(data);
    var method = "POST";
    var amzdate = (new Date()).toISOString().replace(/\.\d+Z/, "Z").replace(/[-:]/g, ""),
        date = amzdate.replace(/T\d+Z/, ""),
        host = service + "." + region + ".amazonaws.com:443",
        canonicalUri = "/",
        canonicalHeaders = "content-encoding:amz-1.0\n" + "host:" + host + "\n" + "x-amz-date:" + amzdate + "\n",
        signedHeaders = "content-encoding;host;x-amz-date",
        canonicalRequest = method + "\n" + canonicalUri + "\n" + "\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + sha256(body),
        credentialScope = date + "/" + region + "/" + service + "/" + "aws4_request",
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
            "X-Amz-Target": "GraniteServiceVersion20100801.GetMetricData",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Content-Encoding": "amz-1.0",
            "Authorization": auth
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
                D.failure(D.errorType.GENERIC_ERROR);
            }
            d.resolve(JSON.parse(body));
        });
    return d.promise;
}

/**
 * @returns promise for http response containing EBS metrics 
 */
function getMetricsData() {
    var payload = {},
        endTime = Math.floor((new Date().getTime()) / 1000),
        startTime = endTime - requestPeriod;
    payload["Action"] = "GetMetricStatistics";
    payload["Version"] = "2010-08-01";
    payload["StartTime"] = startTime;
    payload["EndTime"] = endTime;
    payload["MetricDataQueries"] = createMetricsPayload(requestPeriod, volumeId);
    return httpPost(payload)
        .then(function (data) {
            volumes = data.MetricDataResults;
        });
}
/**
 * @param {string} label  The label to search for in the metric array.
 * @returns A function that takes no arguments and returns the first value associated with the given label, or null if no such label exists.
 */
function extractValue(label) {
    return function () {
        var filteredData = volumes.filter(function (item) { return item.Label === label; });
        if (filteredData.length === 0) {
            return null;
        }
        return filteredData[0].Values[0];
    };
}
// The list of custom driver variables to monitor
function fillConfig() {
    monitoringList = [
        {
            //Provides information about the percentage of I/O credits (for gp2) or throughput credits (for st1 and sc1) remaining in the burst bucket. 
            uid: "burst_balance",
            label: "Burst balance",
            execute: extractValue("BurstBalance"),
            unit: "%"
        },
        {
            //The total number of read operations in a specified period of time. Note: read operations are counted on completion.
            uid: "read_ops",
            label: "Read, ops",
            execute: extractValue("VolumeReadOps"),
            unit: "Ops"
        },
        {
            //The total number of write operations in a specified period of time.
            uid: "write_ops",
            label: "Write, ops",
            execute: extractValue("VolumeWriteOps"),
            unit: "Ops"
        },
        {
            //The total number of seconds spent by all read operations that completed in a specified period of time.uid: "total_read_time",
            uid: "total_read_time",
            label: "Read time, total",
            execute: extractValue("VolumeTotalReadTime"),
            unit: "s"
        },
        {
            //The number of read and write operation requests waiting to be completed in a specified period of time.
            uid: "queue_length",
            label: "Queue length",
            execute: extractValue("VolumeQueueLength")
        },
        {
            //Provides information on the write operations in a specified period of time.
            uid: "write_bytes",
            label: "Write, bytes",
            execute: extractValue("VolumeWriteBytes"),
            unit: "Bps"
        },
        {
            //The total number of seconds spent by all write operations that completed in a specified period of time.
            uid: "total_write_time",
            label: "Write time, total",
            execute: extractValue("VolumeTotalWriteTime"),
            unit: "s"
        },
        {
            //Provides information on the read operations in a specified period of time.
            uid: "read_bytes",
            label: "Read, bytes",
            execute: extractValue("VolumeReadBytes"),
            unit: "Bps"
        },
        {
            //The total number of seconds in a specified period of time when no read or write operations were submitted.
            uid: "idle_time",
            label: "Idle time",
            execute: extractValue("VolumeIdleTime"),
            unit: "s"
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
 * @documentation This procedure is used to validate if the driver AWS EBS is accessible.
 */
function validate() {
    getMetricsData()
        .then(function () {
            D.success();
        });
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to extract monitoring parameters from AWS EBS.
 */
function get_status() {
    getMetricsData()
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