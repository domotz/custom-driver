// Simulated Ubuntu 22.04 `apt-get -s dist-upgrade | grep ^Inst | grep -E openssl\|libssl3\|curl\|linux-image` output.
// Shape follows apt-get's simulation lines: "Inst <package> [<installed version>] (<candidate version> <origin>[, <origin>]
// [<arch>])"; a package not installed yet (a new kernel) has no "[installed]" part. The "curl" pattern also matches
// libcurl4 (grep is a substring match), which the driver does not count under "curl".
const reply = require("../../replies");

const FILTER = ["openssl", "libssl3", "curl", "linux-image"];
const CMD = "apt-get -q -y --ignore-hold --allow-change-held-packages --allow-unauthenticated -s dist-upgrade | /bin/grep ^Inst | grep -E openssl\\|libssl3\\|curl\\|linux-image; test $? -le 1";

const INST = [
    "Inst libssl3 [3.0.2-0ubuntu1.10] (3.0.2-0ubuntu1.12 Ubuntu:22.04/jammy-updates, Ubuntu:22.04/jammy-security [amd64])",
    "Inst openssl [3.0.2-0ubuntu1.10] (3.0.2-0ubuntu1.12 Ubuntu:22.04/jammy-updates, Ubuntu:22.04/jammy-security [amd64])",
    "Inst curl [7.81.0-1ubuntu1.14] (7.81.0-1ubuntu1.15 Ubuntu:22.04/jammy-updates, Ubuntu:22.04/jammy-security [amd64])",
    "Inst libcurl4 [7.81.0-1ubuntu1.14] (7.81.0-1ubuntu1.15 Ubuntu:22.04/jammy-updates, Ubuntu:22.04/jammy-security [amd64])",
    "Inst linux-image-5.15.0-94-generic (5.15.0-94.104 Ubuntu:22.04/jammy-updates, Ubuntu:22.04/jammy-security [amd64])",
    "Inst linux-image-generic [5.15.0.91.89] (5.15.0.94.92 Ubuntu:22.04/jammy-updates, Ubuntu:22.04/jammy-security [amd64])",
    ""
].join("\n");

const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: CMD, reply: reply.ssh(INST) });

module.exports = {
    cases: [{
        name: "ubuntu 22.04",
        parameters: { packagesFilter: FILTER },
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }, {
        name: "ubuntu 22.04, up to date",
        parameters: { packagesFilter: FILTER },
        entryPoints: {
            validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: CMD, reply: reply.ssh("") }] },
            get_status: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: CMD, reply: reply.ssh("") }] }
        }
    }]
};
