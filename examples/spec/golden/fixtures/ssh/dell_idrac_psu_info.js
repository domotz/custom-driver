// Simulated Dell iDRAC 9 (PowerEdge R740) replies. `racadm hwinventory` shape follows the Dell RACADM CLI
// Reference Guide ("[InstanceID: PSU.Slot.N]" headers, "Key = Value" lines, blank line between sections;
// TotalOutputPower = "750 W", InputVoltage = "230"). `racadm getsensorinfo` follows the same guide: a
// "System Board Pwr Consumption" row in the POWER sensor table with status, reading and thresholds.
const reply = require("../../replies");

const HWINVENTORY = [
    "[InstanceID: PSU.Slot.1]",
    "Device Type = PowerSupply",
    "DeviceDescription = Power Supply 1",
    "FirmwareVersion = 00.1D.7D",
    "InputVoltage = 230",
    "InstanceID = PSU.Slot.1",
    "Manufacturer = DELL",
    "Model = PWR SPLY,750W,RDNT,LTON",
    "PartNumber = 0GRTXNA00",
    "PrimaryStatus = Ok",
    "RedundancyStatus = Fully Redundant",
    "SerialNumber = CNLOD0012345",
    "TotalOutputPower = 750 W",
    "",
    "[InstanceID: PSU.Slot.2]",
    "Device Type = PowerSupply",
    "DeviceDescription = Power Supply 2",
    "FirmwareVersion = 00.1D.7D",
    "InputVoltage = 0",
    "InstanceID = PSU.Slot.2",
    "Manufacturer = DELL",
    "Model = PWR SPLY,750W,RDNT,LTON",
    "PartNumber = 0GRTXNA00",
    "PrimaryStatus = Warning",
    "RedundancyStatus = Lost",
    "SerialNumber = CNLOD0012346",
    "TotalOutputPower = 750 W",
    ""
].join("\n");

const SENSORINFO = [
    "Sensor Type : POWER",
    "",
    "<Sensor Name>              <Status>        <Type>",
    "PS1 Status                 Present         AC",
    "PS2 Status                 Present         AC",
    "",
    "<Sensor Name>              <Status>        <Reading>    <lc>      <uc>",
    "System Board Pwr Consumption  Ok           186 W        896 W     1050 W",
    ""
].join("\n");

const calls = () => [
    { kind: "ssh", method: "sendSSHCommand", target: "racadm hwinventory", reply: reply.ssh(HWINVENTORY) },
    { kind: "ssh", method: "sendSSHCommand", target: "racadm getsensorinfo", reply: reply.ssh(SENSORINFO) }
];

module.exports = {
    cases: [{
        name: "iDRAC 9 with PSU 2 on lost input",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
