// Simulated AWS CloudWatch replies for an RDS (PostgreSQL) instance. Shape follows the CloudWatch GetMetricData API
// reference (JSON 1.0 protocol): { MetricDataResults: [ { Id, Label, StatusCode, Timestamps, Values } ], Messages, NextToken }.
// Label is the queried MetricName; metrics a PostgreSQL instance does not publish (Aurora, SQL Server, MySQL binlog ...)
// come back with empty Values. FreeStorageSpace is requested by the driver with Unit "Percent" while CloudWatch publishes
// it in Bytes, so CloudWatch returns no datapoints for it (reported as a driver bug). The driver ships with region
// "ADD_REGION" and DB instance id "ADD_DB_INSTANCE_ID" (placeholders).
const reply = require("../../replies");

const VALUES = {
    "BurstBalance": [88.5],
    "DatabaseConnections": [23],
    "CPUUtilization": [17.8125],
    "CPUCreditBalance": [288],
    "CPUCreditUsage": [0.45],
    "BinLogDiskUsage": [],
    "DiskQueueDepth": [0.0032],
    "ReadIOPS": [12.5],
    "ReadLatency": [0.0021],
    "ReadThroughput": [204800],
    "WriteIOPS": [45.25],
    "WriteLatency": [0.0035],
    "WriteThroughput": [819200],
    "EBSByteBalance%": [99],
    "EBSIOBalance%": [98.5],
    "FreeableMemory": [1073741824],
    "NetworkReceiveThroughput": [51200],
    "NetworkTransmitThroughput": [76800],
    "NetworkThroughput": [128000],
    "ReplicaLag": [0.5],
    "FreeLocalStorage": [],
    "SwapUsage": [0],
    "FreeStorageSpace": [],
    "StorageNetworkReceiveThroughput": [],
    "StorageNetworkTransmitThroughput": [],
    "FailedSQLServerAgentJobsCount": [],
    "EngineUptime": [864000],
    "Queries": []
};

const NAMES = [
    "AbortedClients",
    "ActiveTransactions",
    "AuroraBinlogReplicaLag",
    "AuroraReplicaLag",
    "AuroraReplicaLagMaximum",
    "AuroraReplicaLagMinimum",
    "BacktrackWindowActual",
    "BacktrackWindowAlert",
    "BinLogDiskUsage",
    "BlockedTransactions",
    "BufferCacheHitRatio",
    "CheckpointLag",
    "CommitLatency",
    "CommitThroughput",
    "CPUCreditBalance",
    "CPUCreditUsage",
    "CPUUtilization",
    "DatabaseConnections",
    "DDLLatency",
    "DDLThroughput",
    "Deadlocks",
    "DeleteLatency",
    "DeleteThroughput",
    "DiskQueueDepth",
    "DMLLatency",
    "DMLThroughput",
    "EBSByteBalance%",
    "EBSIOBalance%",
    "EngineUptime",
    "FailedSQLServerAgentJobsCount",
    "FreeableMemory",
    "FreeLocalStorage",
    "InsertLatency",
    "InsertThroughput",
    "LoginFailures",
    "MaximumUsedTransactionIDs",
    "NetworkReceiveThroughput",
    "NetworkThroughput",
    "NetworkTransmitThroughput",
    "NumBinaryLogFiles",
    "Queries",
    "RDSToAuroraPostgreSQLReplicaLag",
    "ReadIOPS",
    "ReadLatency",
    "ReadLatencyLocalStorage",
    "ReadThroughput",
    "ReadThroughputLocalStorage",
    "ReplicationSlotDiskUsage",
    "ResultSetCacheHitRatio",
    "RollbackSegmentHistoryListLength",
    "RowLockTime",
    "SelectLatency",
    "SelectThroughput",
    "StorageNetworkReceiveThroughput",
    "StorageNetworkThroughput",
    "StorageNetworkTransmitThroughput",
    "SumBinaryLogSize",
    "SwapUsage",
    "TransactionLogsDiskUsage",
    "UpdateLatency",
    "UpdateThroughput",
    "WriteIOPS",
    "WriteLatency",
    "WriteThroughput",
    "BurstBalance",
    "FreeStorageSpace",
    "OldestReplicationSlotLag",
    "ReplicaLag",
    "TransactionLogsGeneration"
];

function result(name) {
    const values = VALUES[name] || [];
    return {
        Id: name.replace(/[^a-zA-Z0-9]/g, "").replace(/^./, (c) => c.toLowerCase()),
        Label: name,
        StatusCode: "Complete",
        Timestamps: values.map((v, i) => 1768471800 - i * 600),
        Values: values
    };
}

const DATA = { MetricDataResults: NAMES.map(result), Messages: [], NextToken: null };

const call = () => ({
    kind: "http", method: "post", host: "monitoring.ADD_REGION.amazonaws.com", target: "/",
    headers: { "X-Amz-Target": "GraniteServiceVersion20100801.GetMetricData" },
    body: /"Namespace":"AWS\/RDS"/,
    reply: reply.http(200, DATA)
});

module.exports = {
    cases: [{
        name: "postgres instance, aurora and sql server metrics absent",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
