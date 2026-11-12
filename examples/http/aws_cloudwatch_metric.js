/**
 * The driver is designed to retrieve CloudWatch metrics for various AWS services, including EC2, RDS, ELB, and Lambda. 
 * The metrics that can be monitored include CPUUtilization, NetworkIn, NetworkOut, DiskReadOps, DiskWriteOps, DatabaseConnections, and many more.
 * 
 * For a full list of metrics supported by AWS CloudWatch, please refer to the AWS CloudWatch Metrics documentation.
 * https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/aws-services-cloudwatch-metrics.html
 * 
 * The driver uses the script item to make HTTP requests to the CloudWatch API.
 * Communication protocol is https
 */

var accessKey = D.device.username(); //accessKey == username
var secretKey = D.device.password(); //secretKey == password
var region = "us-east-2"; // change this by you aws region
var requestPeriod = 600;
var metrics;

// This is the metrics list, should be changed to the user need. (follow the structure in the following variable)
var cloudWatchMetric = [
    {
        Id: "server1NetworkIn",
        MetricStat: {
            Metric: {
                Namespace: "AWS/EC2",
                MetricName: "NetworkIn",
                Dimensions: [
                    {
                        Name: "InstanceId",
                        Value: "i-12345678"
                    }
                ]
            },
            Period: 300,
            Stat: "Average",
            Unit: "Bytes"
        }
    },
    {
        Id: "myDatabaseFreeStorage",
        MetricStat: {
            Metric: {
                Namespace: "AWS/RDS",
                MetricName: "FreeStorageSpace",
                Dimensions: [
                    {
                        Name: "DBInstanceIdentifier",
                        Value: "db-name"
                    }
                ]
            },
            Period: 300,
            Stat: "Average",
            Unit: "Bytes"
        }
    },
    {
        Id: "myDatabaseCPUUsage",
        MetricStat: {
            Metric: {
                Namespace: "AWS/RDS",
                MetricName: "CPUUtilization",
                Dimensions: [
                    {
                        Name: "DBInstanceIdentifier",
                        Value: "db-name"
                    }
                ]
            },
            Period: 300,
            Stat: "Average",
            Unit: "Percent"
        }
    },
    {
        Id: "volume1BurstBalance",
        MetricStat: {
            Metric: {
                Namespace: "AWS/EBS",
                MetricName: "BurstBalance",
                Dimensions: [
                    {
                        Name: "VolumeId",
                        Value: "vol-12345678"
                    }
                ]
            },
            Period: 300,
            Stat: "Average",
            Unit: "Percent"
        }
    }
];

var table = D.createTable(
    "Cloud Watch", [
        { label: "Namespace" },
        { label: "Dimension" },
        { label: "Dimension Value" },
        { label: "Metric Name" },
        { label: "Period" },
        { label: "Statistic" },
        { label: "Value" }
    ]
);

//These functions are used to compute hash-based message authentication codes (HMAC) using a specified algorithm.
function sha256(message) {
    return D.crypto.hash(message, "sha256", null, "hex");
}
function hmac(algo, key, message) {
    key = D._unsafe.buffer.from(key);
    return D.crypto.hmac(message, key, algo, "hex");
}

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

// this function convert json object to aws application/x-www-form-urlencoded content-type
function prepareObject(prefix, param) {
    var result = {};
    if (typeof param === "object") {
        if (Array.isArray(param)) {
            param.forEach(function (value, index) {
                var nested = prepareObject(prefix + ".member." + (index + 1), value);
                Object.keys(nested).forEach(function (key) {
                    result[key] = nested[key];
                });
            });
        } else {
            Object.keys(param).forEach(function (k) {
                var nested = prepareObject(prefix + "." + k, param[k]);
                Object.keys(nested).forEach(function (key) {
                    result[key] = nested[key];
                });
            });
        }
    } else {
        result[prefix] = param;
    }
    return result;
}

/**
 * @returns CloudWatch metrics to be monitored for an AWS CloudWatch.
 */
function prepareParams(params) {
    var result = [];
    Object.keys(params).sort().forEach(function (key) {
        if (typeof params[key] !== "object") {
            result.push(key + "=" + encodeURIComponent(params[key]));
        }
        else {
            result.push(prepareObject(key, params[key]));
        }
    });
    return result.join("&");
}

/**
 * Authorization based on: https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html 
 * @returns an HTTP POST request to an Amazon Web Services (AWS) endpoint.
 */
function httpPost(params) {
    var d = D.q.defer();
    var service = "monitoring";
    var data = "";
    var method = "POST";
    var amzdate = (new Date()).toISOString().replace(/\.\d+Z/, "Z").replace(/[-:]/g, ""),
        date = amzdate.replace(/T\d+Z/, ""),
        host = service + "." + region + ".amazonaws.com:443",
        device = D.createExternalDevice(service + "." + region + ".amazonaws.com"),
        canonicalUri = "/",
        canonicalHeaders = "host:" + host + "\n" + "x-amz-date:" + amzdate + "\n",
        signedHeaders = "host;x-amz-date",
        canonicalRequest = method + "\n" + canonicalUri + "\n" + params + "\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + sha256(data),
        credentialScope = date + "/" + region + "/" + service + "/" + "aws4_request",
        requestString = "AWS4-HMAC-SHA256" + "\n" + amzdate + "\n" + credentialScope + "\n" + sha256(canonicalRequest),
        key = sign("AWS4" + secretKey, date);
    key = sign(key, region);
    key = sign(key, service);
    key = sign(key, "aws4_request");
    var auth = "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + credentialScope + ", " + "SignedHeaders=" + signedHeaders + ", " + "Signature=" + hmac("sha256", key, requestString);
    device.http.post({
        url: canonicalUri + "?" + params,
        protocol: "https",
        headers: {
            "x-amz-date": amzdate,
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
            "Authorization": auth
        }
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
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

/**
 * @returns promise for http response containing CloudWatch metrics 
 */
function getMetricsData() {
    var timestamp = new Date().getTime(),
        endTime = new Date(timestamp).toISOString().replace(/\.\d+Z/, "Z"),
        startTime = new Date(timestamp - requestPeriod * 1000).toISOString().replace(/\.\d+Z/, "Z"),
        payload = prepareObject("MetricDataQueries", cloudWatchMetric);
    payload["Action"] = "GetMetricData";
    payload["Version"] = "2010-08-01";
    payload["StartTime"] = startTime;
    payload["EndTime"] = endTime;
    return httpPost(prepareParams(payload));
}

// parse aws response for cloudwatch metrics
function parseData(data){
    metrics = data.GetMetricDataResponse.GetMetricDataResult.MetricDataResults;
    for (var i = 0; i < cloudWatchMetric.length; i++) {
        var id = cloudWatchMetric[i].Id;
        var dimensionValue = cloudWatchMetric[i].MetricStat.Metric.Dimensions[0].Value;
        var namespace = cloudWatchMetric[i].MetricStat.Metric.Namespace;
        var period = cloudWatchMetric[i].MetricStat.Period;
        var stat = cloudWatchMetric[i].MetricStat.Stat || "";
        var dimension = cloudWatchMetric[i].MetricStat.Metric.Dimensions[0].Name;
        var metric = cloudWatchMetric[i].MetricStat.Metric.MetricName;
        var value = metrics[i].Values[0] || "";
        table.insertRecord(id.substring(0, 50), [
            namespace,
            dimension,
            dimensionValue,
            metric,
            period,
            stat,
            value
        ]);
    }
    return table;
}

// This function handles errors
function failure(err) {
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver AWS cloudWatch is accessible.
 */
function validate() {
    getMetricsData()
        .then(D.success)
        .catch(failure);
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to extract monitoring parameters from cloudWAtch.
 */
function get_status() {
    getMetricsData()
        .then(parseData)
        .then(D.success)
        .catch(failure);
}           