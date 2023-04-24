/**
 * The driver gets AWS RDS instance metrics and uses the script item to make HTTP requests to the CloudWatch API.
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
var region = "ADD_REGION";
var secretKey = "ADD_SECRET_ACCESS_KEY";
var accessKey = "ADD_ACCESS_KEY";
var dbInstanceId = "ADD_DB_INSTANCE_ID";
var requestPeriod = 600;
var monitoringList;
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
    var amzdate = (new Date()).toISOString().replace(/\.\d+Z/, "Z").replace(/[-:]/g, ""),
        date = amzdate.replace(/T\d+Z/, ""),
        host = service + "." + region + ".amazonaws.com:443",
        device = D.createExternalDevice(service + "." + region + ".amazonaws.com"),
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
            d.resolve(JSON.parse(body));
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
            metrics = data.MetricDataResults;
        });
}

/**
 * @param {string} label  The label to search for in the metric array.
 * @returns A function that takes no arguments and returns the first value associated with the given label, or null if no such label exists.
 */
function extractValue(label) {
    return function () {
        var filteredData = metrics.filter(function (item) { return item.Label === label; });
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
            //The percent of General Purpose SSD (gp2) burst-bucket I/O credits available.
            uid: "burst_balance",
            label: "Burst balance",
            execute: extractValue("BurstBalance"),
            unit: "%"
        },
        {
            //The number of client network connections to the database instance.
            uid: "database_connections",
            label: "Connection",
            execute: extractValue("DatabaseConnections")
        },
        {
            //The percentage of CPU utilization.
            uid: "utilization",
            label: "CPU: Utilization",
            execute: extractValue("CPUUtilization"),
            unit: "%"
        },
        {
            //The number of CPU credits that an instance has accumulated.
            uid: "credit_balance",
            label: "Credit CPU: Balance",
            execute: extractValue("CPUCreditBalance")
        },
        {
            //The number of CPU credits consumed during the specified period.
            uid: "credit_usage",
            label: "Credit CPU: Usage",
            execute: extractValue("CPUCreditUsage")
        },
        {
            //The amount of disk space occupied by binary logs on the master. Applies to MySQL read replicas.
            uid: "bin_log_disk_usage",
            label: "Disk: Binlog Usage",
            execute: extractValue("BinLogDiskUsage"),
            unit: "B"
        },
        {
            //The number of outstanding read/write requests waiting to access the disk.
            uid: "disk_queue_depth",
            label: "Disk: Queue depth",
            execute: extractValue("DiskQueueDepth")
        },
        {
            //The average number of disk I/O operations per second.
            uid: "read_iops",
            label: "Disk: Read IOPS",
            execute: extractValue("ReadIOPS"),
            unit: "Rps",
            type: D.valueType.RATE
        },
        {
            //The average number of disk read I/O operations to local storage per second.
            uid: "read_iops_local_storage",
            label: "Disk: Read IOPS, local storage",
            execute: extractValue("ReadIOPSLocalStorage"),
            unit: "Rps",
            type: D.valueType.RATE
        },
        {
            //The average amount of time taken per disk I/O operation.
            uid: "read_latency",
            label: "Disk: Read latency",
            execute: extractValue("ReadLatency"),
            unit: "S"
        },
        {
            //The average amount of time taken per disk I/O operation for local storage.
            uid: "read_latency_local_storage",
            label: "Disk: Read latency, local storage",
            execute: extractValue("ReadLatencyLocalStorage"),
            unit: "S"
        },
        {
            //The average number of bytes read from disk per second.
            uid: "read_throughput",
            label: "Disk: Read throughput",
            execute: extractValue("ReadThroughput"),
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //The average number of bytes read from disk per second for local storage.
            uid: "read_throughput_local_storage",
            label: "Disk: Read throughput, local storage",
            execute: extractValue("ReadThroughputLocalStorage"),
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //The number of write records generated per second.
            uid: "write_iops",
            label: "Disk: Write IOPS",
            execute: extractValue("WriteIOPS"),
            unit: "Rps",
            type: D.valueType.RATE
        },
        {
            //The average number of disk write I/O operations per second on local storage in a Multi-AZ DB cluster.
            uid: "write_iops_local_storage",
            label: "Disk: Write IOPS, local storage",
            execute: extractValue("WriteIOPSLocalStorage"),
            unit: "Rps",
            type: D.valueType.RATE
        },
        {
            //The average amount of time taken per disk I/O operation.
            uid: "write_latency",
            label: "Disk: Write latencys",
            execute: extractValue("WriteLatency"),
            unit: "s"
        },
        {
            //The average amount of time taken per disk I/O operation on local storage in a Multi-AZ DB cluster.
            uid: "write_latency_local_storage",
            label: "Disk: Write latency, local storage",
            execute: extractValue("WriteLatencyLocalStorage"),
            unit: "s"
        },
        {
            //The average number of bytes written to persistent storage every second.
            uid: "write_throughput",
            label: "Disk: Write throughput",
            execute: extractValue("WriteThroughput"),
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //The average number of bytes written to disk per second for local storage.
            uid: "write_throughput_local_storage",
            label: "Disk: Write throughput, local storage",
            execute: extractValue("WriteThroughputLocalStorage"),
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //The percentage of throughput credits remaining in the burst bucket of your RDS database.
            uid: "ebs_byte_balance",
            label: "EBS: Byte balance",
            execute: extractValue("EBSByteBalance%"),
            unit: "%"
        },
        {
            //The percentage of I/O credits remaining in the burst bucket of your RDS database.
            uid: "ebs_io_balance",
            label: "EBS: IO balance",
            execute: extractValue("EBSIOBalance%"),
            unit: "%"
        },
        {
            //The amount of available random access memory.
            uid: "freeable_memory",
            label: "Memory, freeable",
            execute: extractValue("FreeableMemory"),
            unit: "B"
        },
        {
            //The incoming (Receive) network traffic on the DB instance, including both customer database traffic and Amazon RDS traffic used for monitoring and replication.
            uid: "network_receive_throughput",
            label: "Network: Receive throughput",
            execute: extractValue("NetworkReceiveThroughput"),
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //The incoming (receive) network traffic on the DB instance, including both customer database traffic and Amazon RDS traffic used for monitoring and replication.
            //For Amazon Aurora: The amount of network throughput received from the Aurora storage subsystem by each instance in the DB cluster.
            uid: "storage_network_receive_throughput",
            label: "Network: Receive throughput",
            execute: extractValue("StorageNetworkReceiveThroughput"),
            unit: "Bps"
        },
        {
            //The amount of network throughput both received from and transmitted to clients by each instance in the Aurora MySQL DB cluster, in bytes per second.
            uid: "network_throughput",
            label: "Network: Throughput",
            execute: extractValue("NetworkThroughput"),
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //The outgoing (Transmit) network traffic on the DB instance, including both customer database traffic and Amazon RDS traffic used for monitoring and replication.
            uid: "network_transmit_throughput",
            label: "Network: Transmit throughput",
            execute: extractValue("NetworkTransmitThroughput"),
            unit: "Bps",
            type: D.valueType.RATE
        },
        {
            //The outgoing (transmit) network traffic on the DB instance, including both customer database traffic and Amazon RDS traffic used for monitoring and replication.
            //For Amazon Aurora: The amount of network throughput sent to the Aurora storage subsystem by each instance in the Aurora MySQL DB cluster.
            uid: "storage_network_transmit_throughput",
            label: "Network: Transmit throughput",
            execute: extractValue("StorageNetworkTransmitThroughput"),
            unit: "Bps"
        },
        {
            //The amount of time a read replica DB instance lags behind the source DB instance.
            uid: "replica_lag",
            label: "Replication: Lag",
            execute: extractValue("ReplicaLag"),
            unit: "s"
        },
        {
            //The number of failed Microsoft SQL Server Agent jobs during the last minute.
            uid: "failed_sql_server_agent_jobs_count",
            label: "SQLServer: Failed agent jobs",
            execute: extractValue("FailedSQLServerAgentJobsCount"),
            unit: "Rpm"
        },
        {
            //The amount of local storage available, in bytes.
            uid: "free_local_storage",
            label: "Storage: Local free",
            execute: extractValue("FreeLocalStorage"),
            unit: "B"
        },
        {
            //The amount of available storage space.
            uid: "free_storage_space",
            label: "Storage: Space free",
            execute: extractValue("FreeStorageSpace"),
            unit: "B"
        },
        {
            //The amount of swap space used.
            uid: "swap_usage",
            label: "Swap usage",
            execute: extractValue("SwapUsage"),
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
 * @documentation This procedure is used to validate if the driver AWS RDS instance is accessible.
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
 * @documentation This procedure is used to extract monitoring parameters from AWS RDS.
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