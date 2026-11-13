// Simulated Dell iDRAC 9 (PowerEdge R740) `racadm hwinventory` output. Shape follows the Dell RACADM CLI
// Reference Guide for hwinventory: one "[InstanceID: <FQDD>]" header per component, then "Key = Value" lines
// (including a repeated "InstanceID = <FQDD>" line), sections separated by a blank line. A virtual disk
// section ("Disk.Virtual.*") is listed by the real command next to the physical disks.
const reply = require("../../replies");

const HWINVENTORY = [
    "[InstanceID: System.Embedded.1]",
    "Device Type = System",
    "InstanceID = System.Embedded.1",
    "Model = PowerEdge R740",
    "",
    "[InstanceID: RAID.Integrated.1-1]",
    "Device Type = Controller",
    "DeviceDescription = Integrated RAID Controller 1",
    "InstanceID = RAID.Integrated.1-1",
    "PrimaryStatus = Ok",
    "ProductName = PERC H730 Mini",
    "",
    "[InstanceID: Disk.Bay.0:Enclosure.Internal.0-1:RAID.Integrated.1-1]",
    "Device Type = PhysicalDisk",
    "BusProtocol = SAS",
    "DeviceDescription = Disk 0 in Backplane 1 of Integrated RAID Controller 1",
    "FreeSizeInBytes = 0",
    "InstanceID = Disk.Bay.0:Enclosure.Internal.0-1:RAID.Integrated.1-1",
    "Manufacturer = SEAGATE",
    "MediaType = HDD",
    "Model = ST600MM0099",
    "PrimaryStatus = Ok",
    "RAIDTypes = Unknown",
    "RaidStatus = Online",
    "SerialNumber = S0M2ABCD",
    "SizeInBytes = 599550590976",
    "UsedSizeInBytes = 599550590976",
    "",
    "[InstanceID: Disk.Bay.1:Enclosure.Internal.0-1:RAID.Integrated.1-1]",
    "Device Type = PhysicalDisk",
    "BusProtocol = SAS",
    "DeviceDescription = Disk 1 in Backplane 1 of Integrated RAID Controller 1",
    "FreeSizeInBytes = 299775295488",
    "InstanceID = Disk.Bay.1:Enclosure.Internal.0-1:RAID.Integrated.1-1",
    "Manufacturer = SEAGATE",
    "MediaType = HDD",
    "Model = ST600MM0099",
    "PrimaryStatus = Warning",
    "RAIDTypes = Unknown",
    "RaidStatus = Degraded",
    "SerialNumber = S0M2EFGH",
    "SizeInBytes = 599550590976",
    "UsedSizeInBytes = 299775295488",
    "",
    "[InstanceID: Disk.Bay.2:Enclosure.Internal.0-1:RAID.Integrated.1-1]",
    "Device Type = PhysicalDisk",
    "BusProtocol = SATA",
    "DeviceDescription = Disk 2 in Backplane 1 of Integrated RAID Controller 1",
    "FreeSizeInBytes = 479559942144",
    "InstanceID = Disk.Bay.2:Enclosure.Internal.0-1:RAID.Integrated.1-1",
    "Manufacturer = INTEL",
    "MediaType = SSD",
    "Model = SSDSC2KB480G7R",
    "PrimaryStatus = Ok",
    "RAIDTypes = Unknown",
    "RaidStatus = Ready",
    "SerialNumber = PHYF1234",
    "SizeInBytes = 479559942144",
    "UsedSizeInBytes = 0",
    "",
    "[InstanceID: Disk.Virtual.0:RAID.Integrated.1-1]",
    "Device Type = VirtualDisk",
    "DeviceDescription = Virtual Disk 0 on Integrated RAID Controller 1",
    "InstanceID = Disk.Virtual.0:RAID.Integrated.1-1",
    "Name = Virtual Disk 0",
    "PrimaryStatus = Ok",
    "RAIDTypes = RAID-1",
    "SizeInBytes = 599550590976",
    "",
    "[InstanceID: Enclosure.Internal.0-1:RAID.Integrated.1-1]",
    "Device Type = Enclosure",
    "InstanceID = Enclosure.Internal.0-1:RAID.Integrated.1-1",
    "PrimaryStatus = Ok",
    ""
].join("\n");

const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: "racadm hwinventory", reply: reply.ssh(HWINVENTORY) });

module.exports = {
    cases: [{
        name: "iDRAC 9 with PERC H730",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
