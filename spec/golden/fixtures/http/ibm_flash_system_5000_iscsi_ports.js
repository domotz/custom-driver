// Simulated FlashSystem 5000 (8.5.0.6) replies. Command: lsportip (-json), an array (one row per
// node port; IPv6 fields empty when unused).
// Format notes: speed is value + unit ("10Gb/s", "1Gb/s", "100Mb/s"), empty when the link is down;
// state configured/unconfigured; link_state active/inactive; remote_copy is a group number string.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const row = (over) => Object.assign({
    id: "1", node_id: "1", node_name: "node1", IP_address: "10.20.0.11", mask: "255.255.255.0", gateway: "10.20.0.1",
    IP_address_6: "", prefix_6: "", gateway_6: "", MAC: "40:f2:e9:aa:bb:01", duplex: "Full", state: "configured",
    speed: "10Gb/s", failover: "no", link_state: "active", host: "yes", remote_copy: "0", host_6: "", remote_copy_6: "0",
    remote_copy_status: "", remote_copy_status_6: "", vlan: "", vlan_6: "", adapter_location: "0", adapter_port_id: "1",
    storage: "yes", storage_6: "", host_port_grp_id: "0", rdma_type: "None", is_rdma_clustering: "no"
}, over);

const lsportip = [
    row({}),
    row({ id: "2", node_id: "2", node_name: "node2", IP_address: "10.20.0.12", MAC: "40:f2:e9:aa:bb:02", speed: "1Gb/s", vlan: "120" }),
    row({ id: "3", node_id: "1", IP_address: "10.20.1.11", MAC: "40:f2:e9:aa:bb:03", speed: "100Mb/s", adapter_port_id: "2", IP_address_6: "2001:db8:20::11", prefix_6: "64", gateway_6: "2001:db8:20::1" }),
    row({ id: "4", node_id: "2", node_name: "node2", IP_address: "", mask: "", gateway: "", MAC: "40:f2:e9:aa:bb:04", duplex: "", state: "unconfigured", speed: "", link_state: "inactive", host: "", storage: "", adapter_port_id: "2" })
];

const calls = () => [authCall, dataCall("lsportip", lsportip)];

module.exports = {
    cases: [{
        name: "four ip ports",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
