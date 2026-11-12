// Simulated AWS CloudWatch replies for an EC2 instance. Shape follows the CloudWatch GetMetricData API reference (Query
// protocol with Accept: application/json): { GetMetricDataResponse: { GetMetricDataResult: { MetricDataResults:
// [ { Id, Label, StatusCode, Timestamps, Values } ] } } }, Label = queried MetricName, Values newest first.
// The driver ships with region "ADD_REGION" (placeholder). Metrics without datapoints (burstable-credit and
// metadata metrics on a non-burstable instance) come back with empty Values. The EBS balance metrics are named
// "EBSIOBalance%" / "EBSByteBalance%" (no space) by CloudWatch.
const reply = require("../../replies");

function m(name, values) {
    return { Id: name.charAt(0).toLowerCase() + name.slice(1), Label: name, StatusCode: "Complete", Timestamps: values.map((v, i) => 1768471800 - i * 300), Values: values };
}

const DATA = {
    GetMetricDataResponse: {
        GetMetricDataResult: {
            MetricDataResults: [
                m("StatusCheckFailed", [0]),
                m("StatusCheckFailed_Instance", [0]),
                m("StatusCheckFailed_System", [1]),
                m("CPUUtilization", [42.5, 40.1]),
                m("NetworkIn", [3000000]),
                m("NetworkOut", [1500000]),
                m("NetworkPacketsIn", [9000]),
                m("NetworkPacketsOut", [6000]),
                m("DiskReadOps", [600]),
                m("DiskWriteOps", [1500]),
                m("DiskReadBytes", [6144000]),
                m("DiskWriteBytes", [30720000]),
                m("MetadataNoToken", []),
                m("CPUCreditUsage", []),
                m("CPUCreditBalance", []),
                m("CPUSurplusCreditBalance", []),
                m("CPUSurplusCreditsCharged", []),
                m("EBSReadOps", [300]),
                m("EBSWriteOps", [900]),
                m("EBSReadBytes", [3072000]),
                m("EBSWriteBytes", [9216000]),
                m("EBSIOBalance%", [99.5]),
                m("EBSByteBalance%", [87.25])
            ]
        }
    }
};

const call = () => ({
    kind: "http", method: "get", host: "monitoring.ADD_REGION.amazonaws.com",
    target: /^\/\?Action=GetMetricData&.*Namespace=AWS%2FEC2/,
    reply: reply.http(200, DATA)
});

module.exports = {
    cases: [{
        name: "instance with one failed system status check",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
