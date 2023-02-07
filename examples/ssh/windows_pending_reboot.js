/**
 * Domotz Custom Driver
 * Name: Windows Pending Reboot sensor
 * Description:  Monitors the "Pending Reboot" state [YES,no] - Reboot action can be performed using the reboot button.
 * Communication protocol is SSH.
 * 
 * Creates a Custom Driver Variable containing YES or no, depending on the device pending reboot status
 * 
 * Code used in the command was taken and modified from the PS module "pendingreboot"
 */

// The ssh options for windows update info retrieval
var command ="powershell -c \"$invokeWmiMethodParameters = @{Namespace= 'root/default';Class= 'StdRegProv';Name= 'EnumKey';ErrorAction  = 'Stop';};$hklm = [UInt32] '0x80000002';$invokeWmiMethodParameters.ArgumentList = @($hklm, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\');$registryComponentBasedServicing = (Invoke-WmiMethod @invokeWmiMethodParameters).sNames -contains 'RebootPending';$invokeWmiMethodParameters.ArgumentList = @($hklm, 'SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\');$registryWindowsUpdateAutoUpdate = (Invoke-WmiMethod @invokeWmiMethodParameters).sNames -contains 'RebootRequired';$invokeWmiMethodParameters.ArgumentList = @($hklm, 'SYSTEM\CurrentControlSet\Services\Netlogon');$registryNetlogon = (Invoke-WmiMethod @invokeWmiMethodParameters).sNames;$pendingDomainJoin = ($registryNetlogon -contains 'JoinDomain') -or ($registryNetlogon -contains 'AvoidSpnSet');$invokeWmiMethodParameters.Name = 'GetMultiStringValue';$invokeWmiMethodParameters.ArgumentList = @($hklm, 'SYSTEM\CurrentControlSet\Control\ComputerName\ActiveComputerName\', 'ComputerName');$registryActiveComputerName = Invoke-WmiMethod @invokeWmiMethodParameters;$invokeWmiMethodParameters.ArgumentList = @($hklm, 'SYSTEM\CurrentControlSet\Control\ComputerName\ComputerName\', 'ComputerName');$registryComputerName = Invoke-WmiMethod @invokeWmiMethodParameters;$pendingComputerRename = $registryActiveComputerName -ne $registryComputerName -or $pendingDomainJoin;$invokeWmiMethodParameters.ArgumentList = @($hklm, 'SYSTEM\CurrentControlSet\Control\Session Manager\', 'PendingFileRenameOperations');$registryPendingFileRenameOperations = (Invoke-WmiMethod @invokeWmiMethodParameters).sValue;$registryPendingFileRenameOperationsBool = [bool]$registryPendingFileRenameOperations;$isRebootPending = $registryComponentBasedServicing -or $pendingComputerRename -or $pendingDomainJoin -or $registryPendingFileRenameOperationsBool -or $registryWindowsUpdateAutoUpdate;@{ IsRebootPending = $isRebootPending; Uptime =  ((Get-Date) - $(Get-CimInstance -ClassName Win32_OperatingSystem | Select -ExpandProperty LastBootupTime)).Hours}\""
var options = {
    "command": command,
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 10000
};

// Helper function to parse response and call the success callback
function successCallback(output) {
    var outputArr = output.split(/\r?\n/);
    for (var i = 2; i < 3; i++) {
        var fields = outputArr[i].replace(/\s+/g,' ').trim();
        var fieldsArr = fields.split(" ");
        var pRebootValue = fieldsArr[1]
        if (pRebootValue == "True") {
            pRebootValue = "YES"
        }
        if (pRebootValue == "False") {
            pRebootValue = "no"
        }
    }
    for (var i = 3; i < 4; i++) {
        var fields = outputArr[i].replace(/\s+/g,' ').trim();
        var fieldsArr = fields.split(" ");
        var uptimeValue = fieldsArr[1]
    }
    var pRebootVar = D.createVariable('1','Pending Reboot',pRebootValue,'', D.valueType.NUMBER)
    var uptimeVar = D.createVariable('2','Uptime',uptimeValue,'hours', D.valueType.NUMBER)

    D.success([pRebootVar,uptimeVar]);
}
    
/**
* SSH Command execution Callback
* Checks for errors: Parsing, Authentication, Generic
* Calls success callback on ssh output
*/
function commandExecutionCallback(output, error) {
    // console.info("Execution: ", output);
    if (error) {
        console.error("Error: ", error);
        if (error.message && (error.message.indexOf("Invalid") === -1 || error.message.indexOf("Handshake failed") === -1)) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
    } else {
        if (output && output.indexOf("is not recognized as") !== -1) {
            D.failure(D.errorType.PARSING_ERROR);
        } else {
            successCallback(output);
        }
    }
}

/**
* @remote_procedure
* @label Reboot
* @documentation WARNING!! This button does not provide with a confirmation dialogue. It will reboot the computer immediately once pressed.
*/
function custom_1(){
    // Command to issued when pressing the button
    option.command="powershell -c \"Restart-Computer -Force\""
    D.device.sendSSHCommand(options, commandExecutionCallback);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation Verifies if the driver can be applied on the device. Checks for credentials
*/
function validate() {
    console.info("Verifying device can respond correctly to command ... ");
    D.device.sendSSHCommand(options, commandExecutionCallback);
}

/**
* @remote_procedure
* @label Get Variables
* @documentation Pending Reboot Status can be [YES,no]
*/
function get_status() {
    D.device.sendSSHCommand(options, commandExecutionCallback);
}
