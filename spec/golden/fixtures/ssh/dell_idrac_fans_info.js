// Simulated Dell iDRAC 9 (PowerEdge R740) `racadm hwinventory` output. Shape follows the Dell RACADM CLI
// Reference Guide for hwinventory: "[InstanceID: Fan.Embedded.NX]" headers, "Key = Value" lines, blank line
// between sections.
const reply = require("../../replies");

const HWINVENTORY = [
    "[InstanceID: Fan.Embedded.1A]",
    "Device Type = Fan",
    "ActiveCooling = 1",
    "CurrentReading = 4800",
    "DeviceDescription = System Board Fan1A",
    "InstanceID = Fan.Embedded.1A",
    "PWM = 33",
    "PrimaryStatus = Ok",
    "RedundancyStatus = Fully Redundant",
    "VariableSpeed = 1",
    "",
    "[InstanceID: Fan.Embedded.1B]",
    "Device Type = Fan",
    "ActiveCooling = 1",
    "CurrentReading = 4560",
    "DeviceDescription = System Board Fan1B",
    "InstanceID = Fan.Embedded.1B",
    "PWM = 31",
    "PrimaryStatus = Ok",
    "RedundancyStatus = Fully Redundant",
    "VariableSpeed = 1",
    "",
    "[InstanceID: Fan.Embedded.2A]",
    "Device Type = Fan",
    "ActiveCooling = 1",
    "CurrentReading = 0",
    "DeviceDescription = System Board Fan2A",
    "InstanceID = Fan.Embedded.2A",
    "PWM = 0",
    "PrimaryStatus = Critical",
    "RedundancyStatus = Lost",
    "VariableSpeed = 1",
    "",
    "[InstanceID: PSU.Slot.1]",
    "Device Type = PowerSupply",
    "InstanceID = PSU.Slot.1",
    ""
].join("\n");

const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: "racadm hwinventory", reply: reply.ssh(HWINVENTORY) });

module.exports = {
    cases: [{
        name: "iDRAC 9 with one failed fan",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
