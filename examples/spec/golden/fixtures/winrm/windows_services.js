// Source: Windows Server 2019, PowerShell 5.1. ConvertTo-Json in 5.1 writes the Status and StartType
// enums as numbers and uses two spaces after each colon; Get-Service output is the default table view.
const reply = require("../../replies");

const SERVICES = ["Dhcp", "Dnscache", "LanmanServer", "MpsSvc", "W32Time"];
const GET_SERVICES = 'ConvertTo-Json @(@("' + SERVICES.join('","') + '") | Get-Service | Select-Object ServiceName,DisplayName,Status,StartType)';

const GET_SERVICE_EVENTLOG = [
    "",
    "Status   Name               DisplayName",
    "------   ----               -----------",
    "Running  eventlog           Windows Event Log",
    "",
    ""
].join("\r\n");

const SERVICES_JSON = [
    "[",
    "    {",
    "        \"ServiceName\":  \"Dhcp\",",
    "        \"DisplayName\":  \"DHCP Client\",",
    "        \"Status\":  4,",
    "        \"StartType\":  2",
    "    },",
    "    {",
    "        \"ServiceName\":  \"Dnscache\",",
    "        \"DisplayName\":  \"DNS Client\",",
    "        \"Status\":  4,",
    "        \"StartType\":  2",
    "    },",
    "    {",
    "        \"ServiceName\":  \"LanmanServer\",",
    "        \"DisplayName\":  \"Server\",",
    "        \"Status\":  4,",
    "        \"StartType\":  2",
    "    },",
    "    {",
    "        \"ServiceName\":  \"mpssvc\",",
    "        \"DisplayName\":  \"Windows Defender Firewall\",",
    "        \"Status\":  4,",
    "        \"StartType\":  2",
    "    },",
    "    {",
    "        \"ServiceName\":  \"W32Time\",",
    "        \"DisplayName\":  \"Windows Time\",",
    "        \"Status\":  1,",
    "        \"StartType\":  3",
    "    }",
    "]",
    ""
].join("\r\n");

module.exports = {
    cases: [{
        name: "winrm, server 2019",
        parameters: { servicesFilter: SERVICES, protocol: "winrm" },
        entryPoints: {
            validate: {
                calls: [{ kind: "winrm", method: "sendWinRMCommand", target: "Get-Service eventlog", reply: reply.winrm(GET_SERVICE_EVENTLOG) }]
            },
            get_status: {
                calls: [{ kind: "winrm", method: "sendWinRMCommand", target: GET_SERVICES, reply: reply.winrm(SERVICES_JSON) }]
            }
        }
    }]
};
