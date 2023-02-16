/**
 * The template gets AWS RDS instance metrics and uses the script item to make HTTP requests to the CloudWatch API.
 * Communication protocol is https
 *
 */
var crypto = require("crypto");

//These functions are used to compute hash-based message authentication codes (HMAC) using a specified algorithm.
function sha256(message) {
    return crypto.createHash("sha256").update(message).digest("hex");
}
function hmac(algo, key, message) {
    return crypto.createHmac(algo, key).update(message).digest("hex");
}

var region = "Add region"; //Amazon RDS Region code.
var secretKey = "Add secretKey"; //Secret access key.
var accessKey = "Add accessKey"; //Access key ID.
var dbInstanceId = "dbInstanceId"; //RDS DB Instance identifier.
var requestPeriod = 600;
var monitoringList, metrics, instanceInfo;
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

function prepareParams(params) {
    var result = [];
    Object.keys(params).sort().forEach(function (key) {
        if (typeof params[key] !== "object") {
            result.push(key + "=" + encodeURIComponent(params[key]));
        } else {
            result.push(prepareObject(key, params[key]));
        }
    });
    return result.join("&");
}

/**
 *   
 * @returns CloudWatch metrics to be monitored for an AWS RDS instance.
 */
function createMetricsPayload(period, dbInstanceId) {
    var metricsList = [
        "AbortedClients:Count",
        "ActiveTransactions:Count/Second",
        "AuroraBinlogReplicaLag:Seconds",
        "AuroraReplicaLag:Milliseconds",
        "AuroraReplicaLagMaximum:Milliseconds",
        "AuroraReplicaLagMinimum:Milliseconds",
        "BacktrackWindowActual:Count",
        "BacktrackWindowAlert:Count",
        "BinLogDiskUsage:Bytes",
        "BlockedTransactions:Count/Second",
        "BufferCacheHitRatio:Percent",
        "CheckpointLag:Seconds",
        "CommitLatency:Milliseconds",
        "CommitThroughput:Count/Second",
        "CPUCreditBalance:Count",
        "CPUCreditUsage:Count",
        "CPUUtilization:Percent",
        "DatabaseConnections:Count",
        "DDLLatency:Milliseconds",
        "DDLThroughput:Count/Second",
        "Deadlocks:Count/Second",
        "DeleteLatency:Milliseconds",
        "DeleteThroughput:Count/Second",
        "DiskQueueDepth:Count",
        "DMLLatency:Milliseconds",
        "DMLThroughput:Count/Second",
        "EBSByteBalance%:Percent",
        "EBSIOBalance%:Percent",
        "EngineUptime:Seconds",
        "FailedSQLServerAgentJobsCount:Count/Second",
        "FreeableMemory:Bytes",
        "FreeLocalStorage:Bytes",
        "InsertLatency:Milliseconds",
        "InsertThroughput:Count/Second",
        "LoginFailures:Count/Second",
        "MaximumUsedTransactionIDs:Count",
        "NetworkReceiveThroughput:Bytes/Second",
        "NetworkThroughput:Bytes/Second",
        "NetworkTransmitThroughput:Bytes/Second",
        "NumBinaryLogFiles:Count",
        "Queries:Count/Second",
        "RDSToAuroraPostgreSQLReplicaLag:Seconds",
        "ReadIOPS:Count/Second",
        "ReadLatency:Seconds",
        "ReadLatencyLocalStorage:Seconds",
        "ReadThroughput:Bytes/Second",
        "ReadThroughputLocalStorage:Bytes/Second",
        "ReplicationSlotDiskUsage:Bytes",
        "ResultSetCacheHitRatio:Percent",
        "RollbackSegmentHistoryListLength:Count",
        "RowLockTime:Milliseconds",
        "SelectLatency:Milliseconds",
        "SelectThroughput:Count/Second",
        "StorageNetworkReceiveThroughput:Bytes/Second",
        "StorageNetworkThroughput:Bytes/Second",
        "StorageNetworkTransmitThroughput:Bytes/Second",
        "SumBinaryLogSize:Bytes",
        "SwapUsage:Bytes",
        "TransactionLogsDiskUsage:Bytes",
        "UpdateLatency:Milliseconds",
        "UpdateThroughput:Count/Second",
        "WriteIOPS:Count/Second",
        "WriteLatency:Seconds",
        "WriteThroughput:Bytes/Second",
        "BurstBalance:Percent",
        "FreeStorageSpace:Percent",
        "OldestReplicationSlotLag:Bytes",
        "ReplicaLag:Seconds",
        "TransactionLogsGeneration:Bytes/Second"
    ];
    return metricsList.map(function (metric) {
        var parts = metric.split(":", 2);
        var name = parts[0].replace(/[^a-zA-Z0-9]/g, "");
        return {
            "Id": name.charAt(0).toLowerCase() + name.slice(1),
            "MetricStat": {
                "Metric": {
                    "MetricName": parts[0],
                    "Namespace": "AWS/RDS",
                    "Dimensions": [
                        {
                            "Name": "DBInstanceIdentifier",
                            "Value": dbInstanceId
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
    var device = D.createExternalDevice(service + "." + region + ".amazonaws.com");
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

    device.http.post({
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
            d.resolve(JSON.parse(body).MetricDataResults);
        });
    return d.promise;
}
/**
 * 
 * @returns  HTTP GET request to an AWS RDS API to retrieve information about DB instances. 
 */
function httpGet(params) {
    var d = D.q.defer();
    var service = "rds";
    var method = "GET";
    var data = "";
    var device = D.createExternalDevice(service + "." + region + ".amazonaws.com");
    var amzdate = (new Date()).toISOString().replace(/\.\d+Z/, "Z").replace(/[-:]/g, ""),
        date = amzdate.replace(/T\d+Z/, ""),
        host = service + "." + region + ".amazonaws.com:443",
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
        },
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
            d.resolve(JSON.parse(body).DescribeDBInstancesResponse.DescribeDBInstancesResult.DBInstances);
        });
    return d.promise;
}

/**
 * @returns promise for http response containing instance metrics 
*/
function getMetricsData() {
    var payload = {},
        endTime = Math.floor((new Date().getTime()) / 1000),
        startTime = endTime - requestPeriod;
    payload["StartTime"] = startTime;
    payload["EndTime"] = endTime;
    payload["ScanBy"] = "TimestampDescending";
    payload["MetricDataQueries"] = createMetricsPayload(requestPeriod, dbInstanceId);
    return httpPost(payload)
        .then(function (data) {
            metrics = data;
        });
}

/**
 * @returns promise for http response containing instance info
*/
function getInstanceData() {

    var payload = {};
    payload["Action"] = "DescribeDBInstances",
        payload["Version"] = "2014-10-31",
        payload["DBInstanceIdentifier"] = dbInstanceId;
    return httpGet(prepareParams(payload))
        .then(function (data) {
            instanceInfo = data;
        });
}

function extractValueByLabel(data, label) {
    return function () {
        var filteredData = data.filter(function (item) { return item.Label === label; });
        if (filteredData.length === 0) {
            return null;
        }
        return filteredData[0].Values[0];
    };
}
function extractValueByKey(data, key) {
    return function () {
        var filteredData = data.filter(function (item) { return item; });
        if (filteredData.length === 0) {
            return null;
        }
        return filteredData[0][key];
    };
}

// The list of custom driver variables to monitor
function fillConfig() {
    monitoringList = [
        {
            //The percent of General Purpose SSD (gp2) burst-bucket I/O credits available.
            uid: "burst_balance",
            label: "Burst balance",
            execute: extractValueByLabel(metrics, "BurstBalance"),
            unit: "%"
        },
        {
            //Contains the name of the compute and memory capacity class of the DB instance.
            uid: "class",
            label: "Class",
            execute: extractValueByKey(instanceInfo, "DBInstanceClass")
        },
        {
            //The number of client network connections to the database instance.
            uid: "database_connections",
            label: "Connection",
            execute: extractValueByLabel(metrics, "DatabaseConnections")
        },
        {
            //The percentage of CPU utilization.
            uid: "utilization",
            label: "CPU: Utilization",
            execute: extractValueByLabel(metrics, "CPUUtilization"),
            unit: "%"
        },
        {
            //Provides the date and time the DB instance was created.
            uid: "create_time",
            label: "Create time",
            execute: [extractValueByKey(instanceInfo, "InstanceCreateTime"), function (res) { return new Date(res * 1000); }]
        },
        {
            //The number of CPU credits that an instance has accumulated.
            uid: "credit_balance",
            label: "Credit CPU: Balance",
            execute: extractValueByLabel(metrics, "CPUCreditBalance")
        },
        {
            //The number of CPU credits consumed during the specified period.
            uid: "credit_usage",
            label: "Credit CPU: Usage",
            execute: extractValueByLabel(metrics, "CPUCreditUsage")
        },
        {
            //The amount of disk space occupied by binary logs on the master. Applies to MySQL read replicas.
            uid: "bin_log_disk_usage",
            label: "Binlog Usage",
            execute: extractValueByLabel(metrics, "BinLogDiskUsage"),
            unit: "B"
        },
        {
            //The number of outstanding read/write requests waiting to access the disk.
            uid: "disk_queue_depth",
            label: "Queue depth",
            execute: extractValueByLabel(metrics, "DiskQueueDepth")
        },
        {
            //The average number of disk I/O operations per second.
            uid: "read_iops",
            label: "Read IOPS",
            execute: extractValueByLabel(metrics, "ReadIOPS"),
            unit: "Rps",
            type: D.valueType.RATE
        },
        {
            //The average number of disk read I/O operations to local storage per second.
            uid: "read_iops_local_storage",
            label: "Read IOPS (local storage)",
            execute: extractValueByLabel(metrics, "ReadIOPSLocalStorage"),
            unit: "Rps",
            type: D.valueType.RATE
        },
        {
            //The average amount of time taken per disk I/O operation.
            uid: "read_latency",
            label: "Read latency",
            execute: extractValueByLabel(metrics, "ReadLatency"),
            unit: "S"
        },
        {
            //The average amount of time taken per disk I/O operation for local storage.
            uid: "read_latency_local_storage",
            label: "Read latency (local storage)",
            execute: extractValueByLabel(metrics, "ReadLatencyLocalStorage"),
            unit: "S"
        },
        {
            //The average number of bytes read from disk per second.
            uid: "read_throughput",
            label: "Read throughput",
            execute: extractValueByLabel(metrics, "ReadThroughput"),
            type: D.valueType.RATE
        },
        {
            //The average number of bytes read from disk per second for local storage.
            uid: "read_throughput_local_storage",
            label: "Read throughput (local storage)",
            execute: extractValueByLabel(metrics, "ReadThroughputLocalStorage"),
            unit: "Rps",
            type: D.valueType.RATE
        },
        {
            //The number of write records generated per second.
            uid: "write_iops",
            label: "Write IOPS",
            execute: extractValueByLabel(metrics, "WriteIOPS"),
            unit: "Rps",
            type: D.valueType.RATE
        },
        {
            //The average number of disk write I/O operations per second on local storage in a Multi-AZ DB cluster.
            uid: "write_iops_local_storage",
            label: "Write IOPS (local storage)",
            execute: extractValueByLabel(metrics, "WriteIOPSLocalStorage"),
            unit: "Rps",
            type: D.valueType.RATE
        },
        {
            //The average amount of time taken per disk I/O operation.
            uid: "write_latency",
            label: "Write latency",
            execute: extractValueByLabel(metrics, "WriteLatency"),
            unit: "S"
        },
        {
            //The average amount of time taken per disk I/O operation on local storage in a Multi-AZ DB cluster.
            uid: "write_latency_local_storage",
            label: "Write latency (local storage)",
            execute: extractValueByLabel(metrics, "WriteLatencyLocalStorage")
        },
        {
            //The average number of bytes written to persistent storage every second.
            uid: "write_throughput",
            label: "Write throughput",
            execute: extractValueByLabel(metrics, "WriteThroughput"),
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //The average number of bytes written to disk per second for local storage.
            uid: "write_throughput_local_storage",
            label: "Write throughput (local storage)",
            execute: extractValueByLabel(metrics, "WriteThroughputLocalStorage"),
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //The percentage of throughput credits remaining in the burst bucket of your RDS database.
            uid: "ebs_byte_balance",
            label: "Byte balance",
            execute: extractValueByLabel(metrics, "EBSByteBalance%"),
            unit: "%"
        },
        {
            //The percentage of I/O credits remaining in the burst bucket of your RDS database.
            uid: "ebs_io_balance",
            label: "IO balance",
            execute: extractValueByLabel(metrics, "EBSIOBalance%"),
            unit: "%"
        },
        {
            //Database engine.
            uid: "engine",
            label: "Engine",
            execute: extractValueByKey(instanceInfo, "Engine")
        },
        {
            //Indicates the database engine version.
            uid: "version",
            label: "Engine version",
            execute: extractValueByKey(instanceInfo, "EngineVersion"),
        },
        {
            //The amount of available random access memory.
            uid: "freeable_memory",
            label: "Memory, freeable",
            execute: extractValueByLabel(metrics, "FreeableMemory"),
            unit: "B"
        },
        {
            //The incoming (receive) network traffic on the DB instance, including both customer database traffic and Amazon RDS traffic used for monitoring and replication.
            //For Amazon Aurora: The amount of network throughput received from the Aurora storage subsystem by each instance in the DB cluster.
            uid: "storage_network_receive_throughput",
            label: "Receive throughput",
            execute: extractValueByLabel(metrics, "NetworkReceiveThroughput"),
            unit: "Bps"
        },
        {
            //The incoming (Receive) network traffic on the DB instance, including both customer database traffic and Amazon RDS traffic used for monitoring and replication.
            uid: "network_receive_throughput",
            label: "Receive throughput",
            execute: extractValueByLabel(metrics, "StorageNetworkReceiveThroughput"),
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //The amount of network throughput both received from and transmitted to clients by each instance in the Aurora MySQL DB cluster, in bytes per second.
            uid: "network_throughput",
            label: "Throughput",
            execute: extractValueByLabel(metrics, "CPUCreditBaNetworkThroughputlance"),
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //The outgoing (Transmit) network traffic on the DB instance, including both customer database traffic and Amazon RDS traffic used for monitoring and replication.
            uid: "network_transmit_throughput",
            label: "Transmit throughput",
            execute: extractValueByLabel(metrics, "NetworkTransmitThroughput"),
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //The outgoing (transmit) network traffic on the DB instance, including both customer database traffic and Amazon RDS traffic used for monitoring and replication.
            //For Amazon Aurora: The amount of network throughput sent to the Aurora storage subsystem by each instance in the Aurora MySQL DB cluster.
            uid: "storage_network_transmit_throughput",
            label: "Transmit throughput",
            execute: extractValueByLabel(metrics, "StorageNetworkTransmitThroughput"),
            unit: "Bps"
        },
        {
            //The status of a read replica. If the instance isn't a read replica, this is blank.
            uid: "read_replica_state",
            label: "Read replica: State",
            execute: function () {
                var data = instanceInfo.filter(function (item) { return item; })[0].StatusInfos;
                if (data !== null) {
                    var resultat = data.filter(function (obj) { return obj; }).Normal;
                    return resultat;
                }
            }
        },
        {
            //The status of a read replica. If the instance isn't a read replica, this is blank.Status of the DB instance.
            uid: "read_replica_status",
            label: "Read replica: Status",
            execute: function () {
                var data = instanceInfo.filter(function (item) { return item; })[0].StatusInfos;
                if (data !== null) {
                    var resultat = data.filter(function (obj) { return obj; }).Status;
                    return resultat;
                }
            }
        },
        {
            //The amount of time a read replica DB instance lags behind the source DB instance.
            uid: "replica_lag",
            label: "Lag",
            execute: extractValueByLabel(metrics, "ReplicaLag"),
            unit: "S"
        },
        {
            //The number of failed Microsoft SQL Server Agent jobs during the last minute.
            uid: "failed_sql_server_agent_jobs_count",
            label: "Failed agent jobs",
            execute: extractValueByLabel(metrics, "FailedSQLServerAgentJobsCount"),
            unit: "Rpm"
        },
        {
            //Specifies the current state of this database.
            uid: "status",
            label: "Status",
            execute: extractValueByKey(instanceInfo, "DBInstanceStatus")
        },
        {
            //Specifies the allocated storage size specified in gibibytes (GiB).
            uid: "allocated",
            label: "Allocated",
            execute: extractValueByKey(instanceInfo, "AllocatedStorage"),
            unit: "GiB"
        },
        {
            //The amount of local storage available, in bytes.
            uid: "free_local_storage",
            label: "Local free",
            execute: extractValueByLabel(metrics, "FreeLocalStorage"),
            unit: "B"
        },
        {
            //The upper limit in gibibytes (GiB) to which Amazon RDS can automatically scale the storage of the DB instance.
            uid: "max_allocated",
            label: "Max allocated",
            execute: function () {
                return (typeof instanceInfo.MaxAllocatedStorage === "undefined") ? -1 : instanceInfo.MaxAllocatedStorage;
            },
            unit: "GiB"
        },
        {
            //The amount of available storage space.
            uid: "free_storage_space",
            label: "Space free",
            execute: extractValueByLabel(metrics, "FreeStorageSpace"),
            unit: "B"
        },
        {
            //Specifies the storage type associated with DB instance.
            uid: "storage_type",
            label: "Storage type",
            execute: extractValueByKey(instanceInfo, "StorageType")
        },
        {
            //The amount of swap space used.
            uid: "swap_usage",
            label: "Swap usage",
            execute: extractValueByLabel(metrics, "SwapUsage"),
            unit: "B"
        }
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
        //if (result != null) {
        return D.device.createVariable(c.uid, c.label, result, c.unit, c.type);
        /*} else {
            return null;
        }*/
    });
    /*.filter(function (v) {
        return v != null;
    });*/
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver AWS RDS instance is accessible for the device.
 */
function validate() {
    getMetricsData()
        .then(function () {
            D.success();
        });
}

//Indicate the successful execution for variable list.
function success() {
    D.success(vars);
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to extract monitoring parameters from AWS RDS.
 */
function get_status() {
    getMetricsData()
        .then(getInstanceData)
        .then(function () {
            fillConfig();
        })
        .then(extract)
        .then(success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}