// Simulated Ubuntu 22.04 `apt-get -s dist-upgrade | grep ^Inst` output. Shape follows apt-get's simulation lines:
// "Inst <package> [<installed version>] (<candidate version> <origin>[, <origin>] [<arch>])"; a package that is not installed
// yet (a new kernel pulled in by dist-upgrade) has no "[installed]" part.
const reply = require("../../replies");

// "; test $? -le 1": grep exits 1 on an up-to-date host, which is not an error.
const CMD = "out=$(apt-get -q -y --ignore-hold --allow-change-held-packages --allow-unauthenticated -s dist-upgrade) || exit 1; printf '%s\\n' \"$out\" | /bin/grep ^Inst; test $? -le 1";

const INST = [
    "Inst libssl3 [3.0.2-0ubuntu1.10] (3.0.2-0ubuntu1.12 Ubuntu:22.04/jammy-updates, Ubuntu:22.04/jammy-security [amd64])",
    "Inst openssl [3.0.2-0ubuntu1.10] (3.0.2-0ubuntu1.12 Ubuntu:22.04/jammy-updates, Ubuntu:22.04/jammy-security [amd64])",
    "Inst curl [7.81.0-1ubuntu1.14] (7.81.0-1ubuntu1.15 Ubuntu:22.04/jammy-updates, Ubuntu:22.04/jammy-security [amd64])",
    "Inst libcurl4 [7.81.0-1ubuntu1.14] (7.81.0-1ubuntu1.15 Ubuntu:22.04/jammy-updates, Ubuntu:22.04/jammy-security [amd64])",
    "Inst linux-image-5.15.0-94-generic (5.15.0-94.104 Ubuntu:22.04/jammy-updates, Ubuntu:22.04/jammy-security [amd64])",
    ""
].join("\n");

const call = (output) => ({ kind: "ssh", method: "sendSSHCommand", target: CMD, reply: reply.ssh(output === undefined ? INST : output) });

module.exports = {
    cases: [{
        name: "ubuntu 22.04",
        parameters: { packagesFilter: [] },
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }, {
        name: "ubuntu 22.04, up to date",
        parameters: { packagesFilter: [] },
        entryPoints: {
            validate: { calls: [call("")] },
            get_status: { calls: [call("")], expect: { allowEmptyTable: true } }
        }
    }]
};
