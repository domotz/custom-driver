// Simulated AWS RDS replies. Shape follows the RDS API reference for DescribeDBInstances (API version 2014-10-31),
// rendered as JSON (the driver sends Accept: application/json to the Query endpoint):
// { DescribeDBInstancesResponse: { DescribeDBInstancesResult: { DBInstances: [ DBInstance ], Marker }, ResponseMetadata } }.
// DBInstance carries DBInstanceIdentifier, DBInstanceClass, Engine, EngineVersion, DBInstanceStatus, AllocatedStorage (GiB),
// MaxAllocatedStorage (GiB), StorageType, InstanceCreateTime (epoch seconds in the JSON rendering) and StatusInfos
// ([{ Normal, Status, StatusType }], for read replicas). The driver ships with region "ADD_REGION" and DB instance id
// "ADD_DB_INSTANCE_ID" (placeholders).
const reply = require("../../replies");

const DATA = {
    DescribeDBInstancesResponse: {
        DescribeDBInstancesResult: {
            DBInstances: [{
                DBInstanceIdentifier: "ADD_DB_INSTANCE_ID",
                DBInstanceClass: "db.t3.medium",
                Engine: "postgres",
                EngineVersion: "15.4",
                DBInstanceStatus: "backing-up",
                MasterUsername: "dbadmin",
                AllocatedStorage: 200,
                MaxAllocatedStorage: 1000,
                StorageType: "gp3",
                InstanceCreateTime: 1700000000.123,
                MultiAZ: false,
                StatusInfos: [{ Normal: true, Status: "replicating", StatusType: "read replication" }]
            }],
            Marker: null
        },
        ResponseMetadata: { RequestId: "9c4d0f4c-6a7b-4f10-8a31-0e2f3b6d7a11" }
    }
};

const call = () => ({
    kind: "http", method: "get", host: "rds.ADD_REGION.amazonaws.com",
    target: "/?Action=DescribeDBInstances&DBInstanceIdentifier=ADD_DB_INSTANCE_ID&Version=2014-10-31",
    reply: reply.http(200, DATA)
});

module.exports = {
    cases: [{
        name: "replica instance in backing-up state",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
