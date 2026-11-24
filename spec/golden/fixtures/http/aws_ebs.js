// Simulated AWS CloudWatch replies. Shape follows the CloudWatch GetMetricData API reference (JSON 1.0 protocol):
// { MetricDataResults: [ { Id, Label, StatusCode, Timestamps, Values } ], Messages, NextToken }. Label is the metric name
// that was queried; Values are doubles, newest first (the driver reads the first one). A metric with no datapoints comes
// back with empty Values. The driver ships with region "ADD_REGION" (placeholder), so the host is monitoring.ADD_REGION.amazonaws.com.
const reply = require("../../replies");

function result(name, values) {
    return {
        Id: name.charAt(0).toLowerCase() + name.slice(1),
        Label: name,
        StatusCode: "Complete",
        Timestamps: values.map((v, i) => 1768471800 - i * 600),
        Values: values
    };
}

const DATA = {
    MetricDataResults: [
        result("BurstBalance", [99.5, 100]),
        result("VolumeReadOps", [1250, 1100]),
        result("VolumeWriteOps", [4800.25]),
        result("VolumeTotalReadTime", [3.125]),
        result("VolumeQueueLength", [0.0123]),
        result("VolumeWriteBytes", [52428800]),
        result("VolumeTotalWriteTime", [12.5]),
        result("VolumeReadBytes", [10485760]),
        result("VolumeIdleTime", [540.5])
    ],
    Messages: [],
    NextToken: null
};

const call = () => ({
    kind: "http", method: "post", host: "monitoring.ADD_REGION.amazonaws.com", target: "/",
    headers: { "X-Amz-Target": "GraniteServiceVersion20100801.GetMetricData" },
    body: /"Namespace":"AWS\/EBS"/,
    reply: reply.http(200, DATA)
});

module.exports = {
    cases: [{
        name: "volume with a short history on two metrics",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
