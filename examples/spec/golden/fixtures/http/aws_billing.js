// Simulated AWS Cost Explorer replies. Shape follows the Cost Explorer API reference for GetCostAndUsage
// (JSON 1.1, X-Amz-Target AWSInsightsIndexService.GetCostAndUsage): { ResultsByTime: [ { TimePeriod, Total: { <Metric>: { Amount, Unit } }, Groups, Estimated } ],
// DimensionValueAttributes }. Amount is a decimal string. The driver ships with region "ADD_REGION" (placeholder the
// user edits), so the endpoint host is ce.ADD_REGION.amazonaws.com. The SigV4 Authorization header is not matched.
const reply = require("../../replies");

const COST = {
    ResultsByTime: [{
        TimePeriod: { Start: "2026-01-14", End: "2026-01-15" },
        Total: {
            AmortizedCost: { Amount: "12.3456789", Unit: "USD" },
            BlendedCost: { Amount: "11.2", Unit: "USD" },
            NetAmortizedCost: { Amount: "10.987654", Unit: "USD" },
            NetUnblendedCost: { Amount: "9.5", Unit: "USD" },
            NormalizedUsageAmount: { Amount: "1523.75", Unit: "N/A" },
            UnblendedCost: { Amount: "11.2004", Unit: "USD" },
            UsageQuantity: { Amount: "30571.25", Unit: "N/A" }
        },
        Groups: [],
        Estimated: true
    }],
    DimensionValueAttributes: []
};

const call = () => ({
    kind: "http", method: "post", host: "ce.ADD_REGION.amazonaws.com", target: "/",
    headers: { "X-Amz-Target": "AWSInsightsIndexService.GetCostAndUsage" },
    body: /"TimePeriod":\{"End":"2026-01-15","Start":"2026-01-14"\}/,
    reply: reply.http(200, COST)
});

module.exports = {
    cases: [{
        name: "one daily total",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
