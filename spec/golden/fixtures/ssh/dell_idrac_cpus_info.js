// Simulated Dell iDRAC 9 (PowerEdge R740) `racadm hwinventory` output. Shape follows the Dell RACADM CLI
// Reference Guide for hwinventory: "[InstanceID: CPU.Socket.N]" headers, "Key = Value" lines with units
// (MaxClockSpeed = "4000 MHz", CurrentClockSpeed = "2.1 GHz" as iDRAC 9 prints it), blank line between sections.
const reply = require("../../replies");

const HWINVENTORY = [
    "[InstanceID: CPU.Socket.1]",
    "Device Type = CPU",
    "CPUStatus = CPU Enabled",
    "CurrentClockSpeed = 2.1 GHz",
    "DeviceDescription = CPU 1",
    "HyperThreadingEnabled = Yes",
    "InstanceID = CPU.Socket.1",
    "MaxClockSpeed = 4000 MHz",
    "Model = Intel(R) Xeon(R) Gold 6130 CPU @ 2.10GHz",
    "NumberOfEnabledCores = 16",
    "PrimaryStatus = Ok",
    "VirtualizationTechnologyEnabled = Yes",
    "",
    "[InstanceID: CPU.Socket.2]",
    "Device Type = CPU",
    "CPUStatus = CPU Disabled By BIOS",
    "CurrentClockSpeed = 2.1 GHz",
    "DeviceDescription = CPU 2",
    "HyperThreadingEnabled = No",
    "InstanceID = CPU.Socket.2",
    "MaxClockSpeed = 4000 MHz",
    "Model = Intel(R) Xeon(R) Gold 6130 CPU @ 2.10GHz",
    "NumberOfEnabledCores = 16",
    "PrimaryStatus = Warning",
    "VirtualizationTechnologyEnabled = No",
    "",
    "[InstanceID: DIMM.Socket.A1]",
    "Device Type = Memory",
    "InstanceID = DIMM.Socket.A1",
    ""
].join("\n");

const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: "racadm hwinventory", reply: reply.ssh(HWINVENTORY) });

module.exports = {
    cases: [{
        name: "iDRAC 9 dual socket",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
