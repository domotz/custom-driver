// Simulated Windows Server 2019 / PowerShell 5.1 over OpenSSH. Shape follows ConvertTo-Json of the Microsoft.Update.Searcher
// results (IUpdate: KBArticleIDs, Title, MsrcSeverity, Categories[].Name, MoreInfoUrls). MsrcSeverity is an empty string for
// updates without an MSRC rating (e.g. definition updates); ConvertTo-Json emits a bare object, not an array, for a single
// update and nothing at all when the machine is up to date. Install Updates prints nothing.
const reply = require("../../replies");

const UPDATES = [
    {
        KB: "5034768",
        Title: "2024-02 Cumulative Update for Windows Server 2019 (1809) for x64-based Systems (KB5034768)",
        MsrcSeverity: "Critical",
        Category: "Security Updates|Windows Server 2019",
        URL: "https://support.microsoft.com/help/5034768"
    },
    {
        KB: "5034863",
        Title: "2024-02 Security Update for Microsoft server operating system version 21H2 (KB5034863)",
        MsrcSeverity: "Important",
        Category: "Security Updates|Windows Server 2019",
        URL: "https://support.microsoft.com/help/5034863"
    },
    {
        KB: "2267602",
        Title: "Security Intelligence Update for Microsoft Defender Antivirus - KB2267602 (Version 1.405.1210.0)",
        MsrcSeverity: "",
        Category: "Definition Updates|Microsoft Defender Antivirus",
        URL: "https://go.microsoft.com/fwlink/?LinkId=52661"
    }
];

const psJson = (value) => JSON.stringify(value, null, 4).replace(/'/g, "\\u0027") + "\r\n";
const SEARCH = /^powershell -command ".*Microsoft\.Update\.Session.*ConvertTo-Json"$/;
const INSTALL = /^powershell -c ".*\$Installer\.Install\(\)"$/;

const search = (output) => ({ kind: "ssh", method: "sendSSHCommand", target: SEARCH, reply: reply.ssh(output) });
const install = () => ({ kind: "ssh", method: "sendSSHCommand", target: INSTALL, reply: reply.ssh("") });

const pair = (name, output, expect) => ({
    name,
    entryPoints: {
        validate: { calls: [search(output)], expect },
        get_status: { calls: [search(output)], expect },
        custom_1: { calls: [install()] }
    }
});

module.exports = {
    cases: [
        pair("three missing updates", psJson(UPDATES)),
        // A single update is a bare object: the driver reads .length (undefined) and lists nothing (reported as a driver bug).
        pair("one missing update is a bare object", psJson(UPDATES[0]), { allowEmptyTable: true }),
        // No updates: the machine prints nothing and the driver substitutes a placeholder "None" update (reported as a driver bug).
        pair("up to date", "")
    ]
};
