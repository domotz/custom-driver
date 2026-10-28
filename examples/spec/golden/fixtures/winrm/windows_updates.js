// Simulated Windows Server 2019 / PowerShell 5.1 replies. Shape follows Get-HotFix's default table for validate and
// ConvertTo-Json of the Microsoft.Update.Searcher results (IUpdate: KBArticleIDs, Title, MsrcSeverity,
// Categories[].Name, MoreInfoUrls) for get_status. MsrcSeverity is an empty string for updates without MSRC rating
// (e.g. definition updates); ConvertTo-Json emits a bare object, not an array, when there is a single update.
const reply = require("../../replies");

const COMMAND = "$UpdateSession = New-Object -ComObject Microsoft.Update.Session;$UpdateSearcher = $UpdateSession.CreateupdateSearcher();$Updates = @($UpdateSearcher.Search('IsHidden=0 and IsInstalled=0 and AutoSelectOnWebSites=1').Updates);$Updates| select  @{n='KB';e={$($_.KBArticleIDs) -join ','}},title,MsrcSeverity,@{n='Category';e={[array](($_.Categories | select Name).Name) -join '|'}}, @{n='URL';e={$($_.moreinfourls) -join ' - '}}|ConvertTo-Json";
const SSH_COMMAND = 'powershell -Command "' + COMMAND.replace(/"/g, '\\"') + '"';

const HOTFIX = [
    "",
    "Source        Description      HotFixID      InstalledBy          InstalledOn",
    "------        -----------      --------      -----------          -----------",
    "WIN-SRV01     Security Update  KB5034127      NT AUTHORITY\\SYSTEM  1/17/2024 12:00:00 AM",
    "WIN-SRV01     Update           KB5033912      NT AUTHORITY\\SYSTEM  12/14/2023 12:00:00 AM",
    "",
    ""
].join("\r\n");

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

function pair(name, updates) {
    return {
        name,
        entryPoints: {
            validate: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: "Get-HotFix", reply: reply.winrm(HOTFIX) }] },
            get_status: {
                calls: [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(psJson(updates)) }]
            }
        }
    };
}

module.exports = {
    cases: [
        Object.assign(pair("winrm, three missing updates", UPDATES), { parameters: { protocol: "winrm" } }),
        Object.assign(pair("winrm, one missing update is a bare object", UPDATES[0]), { parameters: { protocol: "winrm" } }),
        {
            name: "ssh, three missing updates",
            parameters: { protocol: "ssh" },
            entryPoints: {
                validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: 'powershell -Command "Get-HotFix"', reply: reply.ssh(HOTFIX) }] },
                get_status: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: SSH_COMMAND, reply: reply.ssh(psJson(UPDATES)) }] }
            }
        }
    ]
};
