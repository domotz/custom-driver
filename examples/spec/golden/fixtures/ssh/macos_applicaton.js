// Simulated macOS 14.5 `system_profiler SPApplicationsDataType -json` output. Shape follows system_profiler's JSON: a
// "SPApplicationsDataType" array of items with _name, version, path, arch_kind ("arch_arm_i64", "arch_i64", "arch_other"),
// lastModified (ISO 8601 UTC), obtained_from ("apple", "mac_app_store", "identified_developer", "unknown") and signed_by
// (the signing certificate chain, absent for unsigned apps).
const reply = require("../../replies");

const OUTPUT = JSON.stringify({
    SPApplicationsDataType: [
        {
            _name: "Safari",
            arch_kind: "arch_arm_i64",
            lastModified: "2024-05-14T18:32:11Z",
            obtained_from: "apple",
            path: "/Applications/Safari.app",
            signed_by: ["Software Signing", "Apple Code Signing Certification Authority", "Apple Root CA"],
            version: "17.5"
        },
        {
            _name: "Slack",
            arch_kind: "arch_arm_i64",
            lastModified: "2024-05-04T09:05:03Z",
            obtained_from: "identified_developer",
            path: "/Applications/Slack.app",
            signed_by: ["Developer ID Application: Slack Technologies, Inc. (BQR82RBBHL)", "Developer ID Certification Authority", "Apple Root CA"],
            version: "4.38.125"
        },
        {
            _name: "Calculator",
            arch_kind: "arch_arm_i64",
            lastModified: "2024-03-01T12:00:00Z",
            obtained_from: "apple",
            path: "/System/Applications/Calculator.app",
            signed_by: ["Software Signing", "Apple Code Signing Certification Authority", "Apple Root CA"],
            version: "10.16"
        },
        {
            _name: "LegacyTool",
            arch_kind: "arch_i64",
            lastModified: "2019-11-20T23:59:59Z",
            obtained_from: "unknown",
            path: "/Applications/LegacyTool.app"
        }
    ]
}, null, 2) + "\n";

const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: "system_profiler SPApplicationsDataType -json", reply: reply.ssh(OUTPUT) });

module.exports = {
    cases: [
        {
            name: "named applications",
            parameters: { applicationName: ["Safari", "Slack", "LegacyTool"] },
            entryPoints: {
                validate: { calls: [call()] },
                get_status: { calls: [call()] }
            }
        },
        {
            name: "all applications",
            parameters: { applicationName: ["ALL"] },
            entryPoints: {
                validate: { calls: [call()] },
                get_status: { calls: [call()] }
            }
        }
    ]
};
