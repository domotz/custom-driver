/**
 * Domotz Custom Driver
 * Name: Windows Pending Reboot Sensor
 * Description:  Monitors the "Pending Reboot" state [Yes, No] - Reboot action can be performed using the reboot button.
 * Communication protocol is SSH. Utilizing the native windows powershell command
 * 
 * Tested on Windows Versions:
 *      - Windows 10
 *      - Microsoft Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates two custom driver variables:
 *      - Device Uptime - The uptime of the device the driver is applied on
 *      - Pending Reboot - Yes or No, depending if the device has a pending reboot
 * 
 * Code used in the command was taken and modified from the PS module "pendingreboot"
 */


var commandGetPendingReboot ="powershell -c \"$invokeWmiMethodParameters = @{Namespace= 'root/default';Class= 'StdRegProv';Name= 'EnumKey';ErrorAction  = 'Stop';};$hklm = [UInt32] '0x80000002';$invokeWmiMethodParameters.ArgumentList = @($hklm, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\');$registryComponentBasedServicing = (Invoke-WmiMethod @invokeWmiMethodParameters).sNames -contains 'RebootPending';$invokeWmiMethodParameters.ArgumentList = @($hklm, 'SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\');$registryWindowsUpdateAutoUpdate = (Invoke-WmiMethod @invokeWmiMethodParameters).sNames -contains 'RebootRequired';$invokeWmiMethodParameters.ArgumentList = @($hklm, 'SYSTEM\CurrentControlSet\Services\Netlogon');$registryNetlogon = (Invoke-WmiMethod @invokeWmiMethodParameters).sNames;$pendingDomainJoin = ($registryNetlogon -contains 'JoinDomain') -or ($registryNetlogon -contains 'AvoidSpnSet');$invokeWmiMethodParameters.Name = 'GetMultiStringValue';$invokeWmiMethodParameters.ArgumentList = @($hklm, 'SYSTEM\CurrentControlSet\Control\ComputerName\ActiveComputerName\', 'ComputerName');$registryActiveComputerName = Invoke-WmiMethod @invokeWmiMethodParameters;$invokeWmiMethodParameters.ArgumentList = @($hklm, 'SYSTEM\CurrentControlSet\Control\ComputerName\ComputerName\', 'ComputerName');$registryComputerName = Invoke-WmiMethod @invokeWmiMethodParameters;$pendingComputerRename = $registryActiveComputerName -ne $registryComputerName -or $pendingDomainJoin;$invokeWmiMethodParameters.ArgumentList = @($hklm, 'SYSTEM\CurrentControlSet\Control\Session Manager\', 'PendingFileRenameOperations');$registryPendingFileRenameOperations = (Invoke-WmiMethod @invokeWmiMethodParameters).sValue;$registryPendingFileRenameOperationsBool = [bool]$registryPendingFileRenameOperations;$isRebootPending = $registryComponentBasedServicing -or $pendingComputerRename -or $pendingDomainJoin -or $registryPendingFileRenameOperationsBool -or $registryWindowsUpdateAutoUpdate;@{ IsRebootPending = $isRebootPending; Uptime =  ((Get-Date) - $(Get-CimInstance -ClassName Win32_OperatingSystem | Select -ExpandProperty LastBootupTime)).Hours}\""
var sshOptions = {
    "command": commandGetPendingReboot,
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 10000
};

// Helper function to parse response and call the success callback
function successCallback(output) {
    var outputList = output.split(/\r?\n/);
    var outputLineRebootState = 2;
    var outputLineDeviceUptime = 3;
    var pendingRebootLabel = outputList[outputLineRebootState].replace(/\s+/g,' ').trim().split(" ")[0];
    var pendingRebootValue = outputList[outputLineRebootState].replace(/\s+/g,' ').trim().split(" ")[1];
    if (pendingRebootValue.indexOf('alse') === -1) {
        pendingRebootValue = "Yes"
    } else {
        pendingRebootValue = "No"
    }
    var deviceUptimeLabel = outputList[outputLineDeviceUptime].replace(/\s+/g,' ').trim().split(" ")[0];
    var deviceUptimeValue = outputList[outputLineDeviceUptime].replace(/\s+/g,' ').trim().split(" ")[1];
    
    D.success([
        D.createVariable('pending-reboot', pendingRebootLabel, pendingRebootValue, null, D.valueType.STRING),
        D.createVariable('device-uptime-hours', deviceUptimeLabel, deviceUptimeValue, null, D.valueType.NUMBER)
    ]);
}
    
/**
* SSH Command execution Callback
* Checks for errors: Parsing, Authentication, Generic
* Calls success callback on ssh output
*/
function commandExecutionCallback(output, error) {
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
* @label Validate Association
* @documentation Verifies if the driver can be applied on the device. Checks for credentials
*/
function validate() {
    console.info("Verifying device can respond correctly to command ... ");
    D.device.sendSSHCommand(sshOptions, commandExecutionCallback);
}

/**
* @remote_procedure
* @label Get Reboot Pending and Device Uptimne
* @documentation Pending Reboot Status can be [Yes, No]. Device uptime is in Hours
*/
function get_status() {
    D.device.sendSSHCommand(sshOptions, commandExecutionCallback);
}

/**
* @remote_procedure
* @label Reboot Now
* @documentation WARNING! This button does not provide you with a confirmation dialogue. It will reboot the computer immediately once pressed.
*/
function custom_1(){
    function rebootCallback(output, error) {
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
                D.success();
            }
        }
    }
    var rebootCommand ="powershell -c \"Restart-Computer -Force\""; 
    sshOptions.command = rebootCommand
    D.device.sendSSHCommand(sshOptions, rebootCallback);
}
