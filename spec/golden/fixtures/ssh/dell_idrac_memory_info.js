// Simulated Dell iDRAC 9 (PowerEdge R740) `racadm hwinventory` output. Shape follows the Dell RACADM CLI
// Reference Guide for hwinventory: "[InstanceID: DIMM.Socket.XN]" headers, "Key = Value" lines with units
// (Size = "16384 MB", Speed / CurrentOperatingSpeed = "2666 MHz"), blank line between sections.
const reply = require("../../replies");

const HWINVENTORY = [
    "[InstanceID: DIMM.Socket.A1]",
    "Device Type = Memory",
    "BankLabel = A",
    "CurrentOperatingSpeed = 2666 MHz",
    "DeviceDescription = DIMM A1",
    "InstanceID = DIMM.Socket.A1",
    "ManufactureDate = Wed Nov 02 00:00:00 2022 UTC",
    "Manufacturer = Hynix Semiconductor",
    "MemoryType = DDR-4",
    "Model = DDR4 DIMM",
    "PartNumber = HMA82GR7CJR8N-VK",
    "PrimaryStatus = Ok",
    "Rank = Double Rank",
    "SerialNumber = 3C0D5A0E",
    "Size = 16384 MB",
    "Speed = 2666 MHz",
    "",
    "[InstanceID: DIMM.Socket.A2]",
    "Device Type = Memory",
    "BankLabel = A",
    "CurrentOperatingSpeed = 2666 MHz",
    "DeviceDescription = DIMM A2",
    "InstanceID = DIMM.Socket.A2",
    "ManufactureDate = Wed Nov 02 00:00:00 2022 UTC",
    "Manufacturer = Hynix Semiconductor",
    "MemoryType = DDR-4",
    "Model = DDR4 DIMM",
    "PartNumber = HMA82GR7CJR8N-VK",
    "PrimaryStatus = Critical",
    "Rank = Double Rank",
    "SerialNumber = 3C0D5B77",
    "Size = 32768 MB",
    "Speed = 2933 MHz",
    "",
    "[InstanceID: CPU.Socket.1]",
    "Device Type = CPU",
    "InstanceID = CPU.Socket.1",
    ""
].join("\n");

const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: "racadm hwinventory", reply: reply.ssh(HWINVENTORY) });

module.exports = {
    cases: [{
        name: "iDRAC 9 two DIMMs, one critical",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
