// Simulated Crestron TSW-760 (3.002.1025) replies. Shape follows the Crestron "Device" REST API: POST
// /userlogin.html answers the web UI page and sets the session cookie; GET /Device answers
// { Device: { SchedulingPanel: { Monitoring: { Scheduling: { CalendarSyncStatus, ConnectionStatus,
// ConnectionStatusMessage, Exchange: { Registration: { ExchangeRegistrationStatus } } } } } } }.
// Two cases: a panel synchronised with Exchange and one whose connection is down.
const reply = require("../../replies");

const login = () => ({ kind: "http", method: "post", target: "/userlogin.html", reply: reply.http(200, "<html><body>Crestron Device Web Interface</body></html>", { "set-cookie": ["AuthByPasswd=crypt:abc123; path=/; secure"] }) });
const device = (scheduling) => ({ kind: "http", method: "get", target: "/Device", reply: reply.http(200, { Device: { DeviceInfo: { Name: "TSW-760-Room1", Model: "TSW-760" }, SchedulingPanel: { Monitoring: { Scheduling: scheduling } } } }, { "content-type": "application/json" }) });

const synced = { CalendarSyncStatus: "Synchronized", ConnectionStatus: "Connected", ConnectionStatusMessage: "Connected to Exchange", Exchange: { Registration: { ExchangeRegistrationStatus: "Registered" } } };
const broken = { CalendarSyncStatus: "NotSynchronized", ConnectionStatus: "Disconnected", ConnectionStatusMessage: "Unable to reach the Exchange server", Exchange: { Registration: { ExchangeRegistrationStatus: "NotRegistered" } } };

const calls = (scheduling) => [login(), device(scheduling)];

module.exports = {
    cases: [
        { name: "exchange synchronised", entryPoints: { validate: { calls: calls(synced) }, get_status: { calls: calls(synced) } } },
        { name: "exchange unreachable", entryPoints: { validate: { calls: calls(broken) }, get_status: { calls: calls(broken) } } }
    ]
};
