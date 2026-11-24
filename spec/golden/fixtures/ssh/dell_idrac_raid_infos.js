// Simulated Dell iDRAC 9 (PowerEdge R740) `racadm hwinventory` output. Shape follows the Dell RACADM CLI
// Reference Guide for hwinventory: "[InstanceID: <FQDD>]" headers, "Key = Value" lines (with a repeated
// "InstanceID = <FQDD>" line), blank line between sections. Controller values (CacheSizeInMB = "2048 MB",
// EncryptionMode, SecurityStatus, SupportRAID10UnevenSpans) follow the iDRAC storage attribute names.
const reply = require("../../replies");

const HWINVENTORY = [
    "[InstanceID: RAID.Integrated.1-1]",
    "Device Type = Controller",
    "CacheSizeInMB = 2048 MB",
    "DeviceDescription = Integrated RAID Controller 1",
    "DriverVersion = 07.707.03.00",
    "EncryptionMode = None",
    "InstanceID = RAID.Integrated.1-1",
    "PrimaryStatus = Ok",
    "ProductName = PERC H730 Mini",
    "SecurityStatus = Encryption Capable",
    "SupportRAID10UnevenSpans = Supported",
    "",
    "[InstanceID: Disk.Bay.0:Enclosure.Internal.0-1:RAID.Integrated.1-1]",
    "Device Type = PhysicalDisk",
    "InstanceID = Disk.Bay.0:Enclosure.Internal.0-1:RAID.Integrated.1-1",
    "PrimaryStatus = Ok",
    "",
    "[InstanceID: RAID.Slot.6-1]",
    "Device Type = Controller",
    "CacheSizeInMB = 8192 MB",
    "DeviceDescription = RAID Controller in Slot 6",
    "DriverVersion = 07.707.03.00",
    "EncryptionMode = Local Key Management",
    "InstanceID = RAID.Slot.6-1",
    "PrimaryStatus = Critical",
    "ProductName = PERC H740P Adapter",
    "SecurityStatus = Secured",
    "SupportRAID10UnevenSpans = Not Supported",
    ""
].join("\n");

const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: "racadm hwinventory", reply: reply.ssh(HWINVENTORY) });

module.exports = {
    cases: [{
        name: "iDRAC 9 with two PERC controllers",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
