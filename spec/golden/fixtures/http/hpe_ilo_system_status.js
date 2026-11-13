// Simulated HPE ProLiant DL380 Gen10 (iLO 5 2.78) replies. Shape follows the HPE iLO 5 Redfish API reference,
// POST /redfish/v1/Views with a Select: Oem.Hpe.AggregateHealthStatus (aliased Health: per-component
// { Status: { Health } }, redundancy strings, PowerSupplies.PowerSuppliesMismatch), PowerState, and
// Oem.Hpe.PostState (HpeComputerSystem.PostState, e.g. "FinishedPost").
const reply = require("../../replies");

const views = {
    Health: {
        AgentlessManagementService: "Unavailable",
        BiosOrHardwareHealth: { Status: { Health: "OK" } },
        FanRedundancy: "Redundant",
        Fans: { Status: { Health: "Warning" } },
        Memory: { Status: { Health: "OK" } },
        Network: { Status: { Health: "OK" } },
        PowerSupplies: { PowerSuppliesMismatch: false, Status: { Health: "OK" } },
        PowerSupplyRedundancy: "Redundant",
        Processors: { Status: { Health: "OK" } },
        Storage: { Status: { Health: "OK" } },
        Temperature: { Status: { Health: "OK" } }
    },
    PowerState: "On",
    PostState: "FinishedPost"
};

const calls = () => [{ kind: "http", method: "post", target: "/redfish/v1/Views", body: /AggregateHealthStatus/, reply: reply.http(200, views) }];

module.exports = {
    cases: [{
        name: "dl380 gen10",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
