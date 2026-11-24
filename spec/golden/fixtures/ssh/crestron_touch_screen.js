// Crestron TSW-1070 console replies over SSH. The sensor names and values come from the variables production stores
// for this driver: `temperature` prints one "<sensor> Temperature: <n>C" line per sensor and `info` prints
// "<label>: <value>" lines. Some info lines have two parts ("Web Server: Enabled: Level 1"); the driver always
// stored them as "Enabled Level 1". The exact spacing of the console output is inferred.
const reply = require("../../replies");

const TEMPERATURE = [
    "Current CPU/SATA Temperature: 44C",
    "Current PMIC Junction Temperature: 43C",
    ""
].join("\r\n");

const INFO = [
    "Category: TouchPanel",
    "Core3UILevel: 3.00",
    "DHCP Support: Yes",
    "DisplayList: YES",
    "Ethernet Active: Yes",
    "Ethernet Ports: 1",
    "Front Panel Slot: 2",
    "Front Panel Type: TouchScreen",
    "FTP Transfers: Enabled: Level 1",
    "IP Masters: 16",
    "IP Table: Yes",
    "Max Host Name: 63",
    "Max IP Entries: 16",
    "Password: Yes",
    "RConsole support: SUPPORTED: Level 3",
    "SSL support: SUPPORTED: Level 1",
    "System Monitor: SUPPORTED: Level 4",
    "TJI support: Level 2",
    "Web Server: Enabled: Level 1",
    ""
].join("\r\n");

module.exports = {
    cases: [{
        name: "tsw-1070",
        entryPoints: {
            validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: "temperature", reply: reply.ssh(TEMPERATURE) }] },
            get_status: {
                calls: [
                    { kind: "ssh", method: "sendSSHCommand", target: "temperature", reply: reply.ssh(TEMPERATURE) },
                    { kind: "ssh", method: "sendSSHCommand", target: "info", reply: reply.ssh(INFO) }
                ]
            },
            custom_1: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: "reboot", reply: reply.ssh("Rebooting...\r\n") }] }
        }
    }]
};
