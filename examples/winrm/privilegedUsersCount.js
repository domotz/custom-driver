/**
 * Domotz Custom Driver 
 * Name: Active Directory privileged users count
 * Description: reports the number of members of AD privileged groups
 *   
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Microsoft Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates a Custom Driver table with the number of members in AD privileged groups.
 * 
 * Privilege required: AD User
 * 
**/
var winrmConfig = {
    "command": '',
    "username": D.device.username(),
    "password": D.device.password()
};


// Check for Errors on the WinRM command response
function checkWinRmError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 401) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 404) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate WinRM is working on device
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    winrmConfig.command = "Get-ADUser administrator";
    D.device.sendWinRMCommand(winrmConfig, function (output) {
        if (output.error === null) {
            D.success();
        } else {
            checkWinRmError(output.error);
        }
    });
}

/**
* @remote_procedure
* @label Get domain privileged users
* @documentation This procedure retrieves the number of privileged users
*/
function get_status() {
    winrmConfig.command = '$Domain = (Get-ADDomain).DNSRoot;$DC=$false;if ($(Get-SmbShare |? name  -eq \"SYSVOL\")){$DC=$true}; if (-not $DC){return $([PSCustomObject]@{Name=\"N/A\";\"MemberCount\"= \"This computer is not a Domain Controller\"}|ConvertTo-Json)};$Filter = {admincount -eq 1 -and iscriticalsystemobject -like \"*\"};$PrivilegedGroups = Get-ADGroup -server $Domain -filter $Filter  -Properties * | Select-Object Name, members;[System.Collections.ArrayList]$aPrivGroupsMembersCount = @();foreach ($g in $PrivilegedGroups) {$PrivGroupMemberCountObj = [PSCustomObject]@{Name= $null;MemberCount = $null};$PrivGroupMemberCountObj.Name = $g.name;$PrivGroupMemberCountObj.MemberCount = $($g.members).count;$aPrivGroupsMembersCount += $PrivGroupMemberCountObj};$aPrivGroupsMembersCount|ConvertTo-Json';
    D.device.sendWinRMCommand(winrmConfig, parseOutput);
}
var privilegedUsersTable = D.createTable(
    "Privileged AD groups members",
    [

        { label: "Group" },
        { label: "Count" }

    ]
);

function parseOutput(output) {
    if (output.error === null) {
        var k = 0;
        var totPrivilegedUsers = 0;
        var jsonOutput = JSON.parse(JSON.stringify(output));
        jsonOutput = JSON.parse(jsonOutput.outcome.stdout);
        console.log(JSON.stringify(jsonOutput));
        while (k < jsonOutput.length) {
            privilegedUsersTable.insertRecord(k.toString(), [jsonOutput[k].Name,jsonOutput[k].MemberCount]);
            totPrivilegedUsers += jsonOutput[k].MemberCount;
            k++
        }
        var totPrivilegedUsers = [D.createVariable('PrivilegedUsers', 'Total privileged users', totPrivilegedUsers, null, D.valueType.NUMBER)];
        D.success(totPrivilegedUsers,privilegedUsersTable);
    } else {
        console.error(output.error);
        D.failure();
    }

}