// Simulated FlashSystem 5000 (8.5.0.6) replies. Command: lsportethernet (-json), an array.
// Format notes: speed is value + unit ("10Gb/s", "1Gb/s", "100Mb/s"), empty when no link;
// link_state active/inactive; host/storage/replication/eth_clustering/management are yes/no.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const row = (over) => Object.assign({
    id: "0", node_id: "1", node_name: "node1", port_id: "1", port_status: "configured", port_speed: "10Gb/s",
    MAC: "40:f2:e9:aa:bb:01", duplex: "Full", speed: "10Gb/s", link_state: "active", dcbx_state: "disabled",
    adapter_location: "0", adapter_port_id: "1", host: "yes", storage: "yes", replication: "yes", eth_clustering: "no", management: "yes"
}, over);

const lsportethernet = [
    row({}),
    row({ id: "1", node_id: "1", port_id: "2", MAC: "40:f2:e9:aa:bb:02", speed: "1Gb/s", adapter_port_id: "2", management: "no" }),
    row({ id: "2", node_id: "2", node_name: "node2", port_id: "1", MAC: "40:f2:e9:aa:bb:11", speed: "100Mb/s" }),
    row({ id: "3", node_id: "2", node_name: "node2", port_id: "2", MAC: "40:f2:e9:aa:bb:12", duplex: "", speed: "", link_state: "inactive", adapter_port_id: "2", host: "no", storage: "no", management: "no" })
];

const calls = () => [authCall, dataCall("lsportethernet", lsportethernet)];

module.exports = {
    cases: [{
        name: "four ethernet ports",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
