// Simulated AWS CloudWatch replies. Shape follows the CloudWatch GetMetricData API reference (Query protocol, JSON
// rendering requested with Accept: application/json): { GetMetricDataResponse: { GetMetricDataResult: { MetricDataResults:
// [ { Id, Label, StatusCode, Timestamps, Values } ], Messages, NextToken }, ResponseMetadata } }, results in the order of
// the MetricDataQueries sent. The driver reads results by position. Region is us-east-2 (hard-coded in the driver).
const reply = require("../../replies");

const DATA = {
    GetMetricDataResponse: {
        GetMetricDataResult: {
            MetricDataResults: [
                { Id: "server1NetworkIn", Label: "NetworkIn", StatusCode: "Complete", Timestamps: [1768471800, 1768471500], Values: [1843200.5, 1500000] },
                { Id: "myDatabaseFreeStorage", Label: "FreeStorageSpace", StatusCode: "Complete", Timestamps: [1768471800], Values: [21474836480] },
                { Id: "myDatabaseCPUUsage", Label: "CPUUtilization", StatusCode: "Complete", Timestamps: [1768471800], Values: [37.25] },
                { Id: "volume1BurstBalance", Label: "BurstBalance", StatusCode: "Complete", Timestamps: [], Values: [] }
            ],
            Messages: [],
            NextToken: null
        },
        ResponseMetadata: { RequestId: "0c0b6a4e-2b0e-4a0c-9d52-6c5a2f7f1e11" }
    }
};

const call = () => ({
    kind: "http", method: "post", host: "monitoring.us-east-2.amazonaws.com",
    target: /^\/\?Action=GetMetricData&.*Version=2010-08-01/,
    reply: reply.http(200, DATA)
});

module.exports = {
    cases: [{
        name: "four metrics, the last one without datapoints",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
