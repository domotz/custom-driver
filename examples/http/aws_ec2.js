/**
 * This driver Gets AWS EC2 and attached AWS EBS volumes metrics and uses the script item to make HTTP requests to the CloudWatch API.
 * Collects metrics for an AWS EC2 instance, including CPU utilization, network activity, disk I/O, and EBS performance. 
 * The collected metrics are used to monitor and analyze the performance and health of the EC2 instance.
 * 
 * Communication protocol is https
 */

//These functions are used to compute hash-based message authentication codes (HMAC) using a specified algorithm.
function sha256(message) {
    return D.crypto.hash(message, "sha256", null, "hex");
}
function hmac(algo, key, message) {
    key = D._unsafe.buffer.from(key);
    return D.crypto.hmac(message, key, algo, "hex");
}

var accessKey = D.device.username(); //accessKey == username
var secretKey = D.device.password(); //secretKey == password
var region = "ADD_REGION";
var instanceId = "ADD_INSTANCE_ID";
var requestPeriod = 600;
var monitoringList, metrics;
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

function prepareRecursive(prefix, param) {
    var result = {};
    if (typeof param === "object") {
        if (Array.isArray(param)) {
            param.forEach(function (value, index) {
                var nested = prepareRecursive(prefix + ".member." + (index + 1), value);
                Object.keys(nested).forEach(function (key) {
                    result[key] = nested[key];
                });
            });
        } else {
            Object.keys(param).forEach(function (k) {
                var nested = prepareRecursive(prefix + "." + k, param[k]);
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
 * @returns CloudWatch metrics to be monitored for an AWS EC2.
 */
function createMetricsPayload(period, instanceId) {
    var metricsList = [
        "StatusCheckFailed:Count",
        "StatusCheckFailed_Instance:Count",
        "StatusCheckFailed_System:Count",
        "CPUUtilization:Percent",
        "NetworkIn:Bytes",
        "NetworkOut:Bytes",
        "NetworkPacketsIn:Count",
        "NetworkPacketsOut:Count",
        "DiskReadOps:Count",
        "DiskWriteOps:Count",
        "DiskReadBytes:Bytes",
        "DiskWriteBytes:Bytes",
        "MetadataNoToken:Count",
        "CPUCreditUsage:Count",
        "CPUCreditBalance:Count",
        "CPUSurplusCreditBalance:Count",
        "CPUSurplusCreditsCharged:Count",
        "EBSReadOps:Count",
        "EBSWriteOps:Count",
        "EBSReadBytes:Bytes",
        "EBSWriteBytes:Bytes",
        "EBSIOBalance %:Percent",
        "EBSByteBalance %:Percent"
    ];
    return metricsList.map(function (metric) {
        var parts = metric.split(":", 2);
        var name = parts[0].replace(/[^a-zA-Z0-9]/g, "");
        return {
            "Id": name.charAt(0).toLowerCase() + name.slice(1),
            "MetricStat": {
                "Metric": {
                    "MetricName": parts[0],
                    "Namespace": "AWS/EC2",
                    "Dimensions": [
                        {
                            "Name": "InstanceId",
                            "Value": instanceId
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
 * @returns HTTP GET request to an AWS EC2 API to retrieve information about DB instances. 
 */
function httpGet(params) {
    var d = D.q.defer();
    var service = "monitoring";
    var data = "";
    var method = "GET";
    var amzdate = (new Date()).toISOString().replace(/\.\d+Z/, "Z").replace(/[-:]/g, ""),
        date = amzdate.replace(/T\d+Z/, ""),
        host = service + "." + region + ".amazonaws.com:443",
        device = D.createExternalDevice(service + "." + region + ".amazonaws.com"),
        canonicalUri = "/",
        canonicalHeaders = "content-encoding:amz-1.0\n" + "host:" + host + "\n" + "x-amz-date:" + amzdate + "\n",
        signedHeaders = "content-encoding;host;x-amz-date",
        canonicalRequest = method + "\n" + canonicalUri + "\n" + params + "\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + sha256(data),
        credentialScope = date + "/" + region + "/" + service + "/" + "aws4_request",
        requestString = "AWS4-HMAC-SHA256" + "\n" + amzdate + "\n" + credentialScope + "\n" + sha256(canonicalRequest),
        key = sign("AWS4" + secretKey, date);
    key = sign(key, region);
    key = sign(key, service);
    key = sign(key, "aws4_request");
    var auth = "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + credentialScope + ", " + "SignedHeaders=" + signedHeaders + ", " + "Signature=" + hmac("sha256", key, requestString);
    device.http.get({
        url: canonicalUri + "?" + params,
        protocol: "https",
        headers: {
            "x-amz-date": amzdate,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Content-Encoding": "amz-1.0",
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
 * @returns promise for http response containing EC2 metrics 
 */
function getMetricsData() {
    var timestamp = new Date().getTime(),
        endTime = new Date(timestamp).toISOString().replace(/\.\d+Z/, "Z"),
        startTime = new Date(timestamp - requestPeriod * 1000).toISOString().replace(/\.\d+Z/, "Z"),
        payload = prepareRecursive("MetricDataQueries", createMetricsPayload(requestPeriod, instanceId));
    payload["Action"] = "GetMetricData";
    payload["Version"] = "2010-08-01";
    payload["StartTime"] = startTime;
    payload["EndTime"] = endTime;
    payload["ScanBy"] = "TimestampDescending";
    return httpGet(prepareParams(payload))
        .then(function (data) {
            metrics = data.GetMetricDataResponse.GetMetricDataResult.MetricDataResults;
        });
}

/**
 * @param {string} label  The label to search for in the metric array.
 * @returns A function that takes no arguments and returns the first value associated with the given label, or null if no such label exists.
 */
function extractValue(label) {
    return function () {
        var filteredData = metrics.filter(function (item) { return item.Label === label; });
        if (filteredData.length === 0 || filteredData[0].Values.length === 0) {
            return null;
        }
        var value = filteredData[0].Values[0];
        if (typeof value !== "number") {
            return null;
        }
        return value.toFixed(3);
    };
}
/**
 * @param {number} number diviser
 * @returns the value divide by the number
 */
function diviser(number) {
    return function (value) {
        if (value == null) {
            return null;
        }
        return value / number;
    };
}

// The list of custom driver variables to monitor
function fillConfig() {
    monitoringList = [
        {
            //The percentage of allocated EC2 compute units that are currently in use on the instance.
            uid: "cpu_utilization",
            label: "CPU: Utilization",
            execute: extractValue("CPUUtilization"),
            unit: "%"
        },
        {
            //The number of earned CPU credits that an instance has accrued since it was launched or started. 
            uid: "credit_balance",
            label: "Credit CPU: Balance",
            execute: extractValue("CPUCreditBalance")
        },
        {
            //The number of surplus credits that have been spent by an unlimited instance when its CPUCreditBalance value is zero.
            uid: "surplus_credit_balance",
            label: "Credit CPU: Surplus balance",
            execute: extractValue("CPUSurplusCreditBalance")
        },
        {
            //The number of spent surplus credits that are not paid down by earned CPU credits, and which thus incur an additional charge.
            uid: "surplus_credit_charged",
            label: "Credit CPU: Surplus charged",
            execute: extractValue("CPUSurplusCreditsCharged")
        },
        {
            //The number of CPU credits spent by the instance for CPU utilization.
            uid: "credit_usage",
            label: "Credit CPU: Usage",
            execute: extractValue("CPUCreditUsage")
        },
        {
            //Completed read operations from all instance store volumes available to the instance in a specified period of time.
            uid: "read_ops_disk",
            label: "Disk: Read",
            execute: [extractValue("DiskReadOps"), diviser(300)],
            unit: "Ops",
            type: D.valueType.RATE
        },
        {
            //Bytes read from all instance store volumes available to the instance.
            uid: "read_bytes_disk",
            label: "Disk: Read bytes",
            execute: [extractValue("DiskReadBytes"), diviser(300)],
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //Bytes written to all instance store volumes available to the instance.
            uid: "disk_write_bytes",
            label: "Disk: Write bytes",
            execute: [extractValue("DiskWriteBytes"), diviser(300)],
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //Completed write operations to all instance store volumes available to the instance in a specified period of time.
            uid: "disk_write_ops",
            label: "Disk: Write ops",
            execute: [extractValue("DiskWriteOps"), diviser(300)],
            unit: "Ops",
            type: D.valueType.RATE
        },
        {
            //Percentage of throughput credits remaining in the burst bucket for Nitro-based instances.
            uid: "byte_balance",
            label: "EBS: Byte balance",
            execute: extractValue("EBSByteBalance%"),
            unit: "%"
        },
        {
            //Percentage of I/O credits remaining in the burst bucket for Nitro-based instances.
            uid: "io_balance",
            label: "EBS: IO balance",
            execute: extractValue("EBSIOBalance%"),
            unit: "%"
        },
        {
            //Completed read operations from all Amazon EBS volumes attached to the instance for Nitro-based instances.
            uid: "read_ops",
            label: "EBS: Read",
            execute: [extractValue("EBSReadOps"), diviser(300)],
            unit: "Ops",
            type: D.valueType.RATE
        },
        {
            //Bytes read from all EBS volumes attached to the instance for Nitro-based instances.
            uid: "read_bytes",
            label: "EBS: Read bytes",
            execute: [extractValue("EBSReadBytes"), diviser(300)],
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //Completed write operations to all EBS volumes attached to the instance in a specified period of time.
            uid: "write_ops",
            label: "EBS: Write",
            execute: [extractValue("EBSWriteOps"), diviser(300)],
            type: D.valueType.RATE
        },
        {
            //Bytes read from all EBS volumes attached to the instance for Nitro-based instances.
            uid: "write_bytes",
            label: "EBS: Write bytes",
            execute: [extractValue("EBSWriteBytes"), diviser(300)],
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //The number of times the instance metadata service was successfully accessed using a method that does not use a token.
            uid: "no_token",
            label: "Metadata: No token",
            execute: extractValue("MetadataNoToken"),
        },
        {
            //The number of bytes received on all network interfaces by the instance.
            uid: "network_in",
            label: "Network: Bytes in",
            execute: [extractValue("NetworkIn"), diviser(300)],
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //The number of bytes sent out on all network interfaces by the instance. 
            uid: "network_out",
            label: "Network: Bytes out",
            execute: [extractValue("NetworkOut"), diviser(300)],
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //The number of packets received on all network interfaces by the instance.
            uid: "packets_in",
            label: "Network: Packets in",
            execute: [extractValue("NetworkPacketsIn"), diviser(300)],
            type: D.valueType.RATE
        },
        {
            //The number of packets sent out on all network interfaces by the instance.
            uid: "packets_out",
            label: "Network: Packets out",
            execute: [extractValue("NetworkPacketsOut"), diviser(300)],
            type: D.valueType.RATE
        },
        {
            //Reports whether the instance has passed both the instance status check and the system status check in the last minute.
            uid: "status_check_failed",
            label: "Status: Check failed",
            execute: extractValue("StatusCheckFailed")
        },
        {
            //Reports whether the instance has passed the instance status check in the last minute.
            uid: "status_check_failed_instance",
            label: "Status: Check failed, instance",
            execute: extractValue("StatusCheckFailed_Instance")
        },
        {
            //Reports whether the instance has passed the system status check in the last minute.
            uid: "status_check_failed_system",
            label: "Status: Check failed, system",
            execute: extractValue("StatusCheckFailed_System")
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
 * @documentation This procedure is used to validate if the driver AWS EC2 is accessible.
 */
function validate() {
    getMetricsData()
        .then(function () {
            D.success();
        }).catch(failure);
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to extract monitoring parameters from AWS EC2.
 */
function get_status() {
    getMetricsData()
        .then(fillConfig)
        .then(extract)
        .then(function () {
            D.success(vars);
        }).catch(failure);
}