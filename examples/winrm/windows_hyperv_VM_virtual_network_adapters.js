/**
 * Domotz Custom Driver 
 * Name: Windows Hyper-V VM Virtual Network Adapters
 * Description: This script retrieves information about the Hyper-V VM Virtual Network Adapters
 *   
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Windows 10
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates a Custom Driver table with the following columns:
 *    - Name: User-friendly name of the network adapter.
 *    - ClusterMonitored: Indicates if the adapter is monitored by the cluster (Yes or No).
 *    - PoolName: Name of the network pool to which the adapter belongs.
 *    - Connected: Indicates if the adapter is currently connected (Yes or No).
 *    - SwitchName: Name of the virtual switch connected to the adapter.
 *    - BandwidthPercentage: Percentage of bandwidth allocated to the adapter.
 *    - IsDeleted: Indicates if the adapter has been deleted (Yes or No).
 * 
 * Privilege required: 
 *    - Administrator
 */


// The VM ID for which you want to display the Virtual Network Adapters.
var vmIdFilter = D.getParameter('vmId');

var getVmVirtualNetworkAdapters = '(Get-VM -id "' + vmIdFilter + '" | Select-Object -ExpandProperty NetworkAdapters).ForEach( { @{ "Id" = $_.Id; "Name" = $_.Name; "ClusterMonitored" = $_.ClusterMonitored; "PoolName" = $_.PoolName; "Connected" = $_.Connected; "SwitchName" = $_.SwitchName; "BandwidthPercentage" = $_.BandwidthPercentage; "IsDeleted" = $_.IsDeleted } }) | ConvertTo-Json';

// Define the WinRM options when running the commands
var winrmConfig = {
    "command": getVmVirtualNetworkAdapters,
    "username": D.device.username(),
    "password": D.device.password()
};

var booleanCodes = {
    "true": "Yes",
    "false": "No",
};

// Creation of custom driver table 
var virtualNetworkAdaptersTable = D.createTable(
    "Virtual network adapters",
    [
        { label: "Name" },
        { label: "SwitchName" },
        { label: "PoolName" },
        { label: "ClusterMonitored" },
        { label: "Connected" },
        { label: "BandwidthPercentage" },
        { label: "IsDeleted" }
    ]
);

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
    winrmConfig.command = "Get-vm";
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
 * @label Retrieve list of VM virtual network adapters
 * @documentation This procedure retrieves a list of virtual network adapters for the target virtual Machine 
 */
function get_status() {
    D.device.sendWinRMCommand(winrmConfig, parseOutput);
}

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

function populateTable(id, Name, SwitchName, PoolName, ClusterMonitored, Connected, BandwidthPercentage, IsDeleted) {
    // var recordId = sanitize(id);
    var recordId = (id);
    ClusterMonitored = booleanCodes[ClusterMonitored];
    Connected = booleanCodes[Connected];
    IsDeleted = booleanCodes[IsDeleted];
    virtualNetworkAdaptersTable.insertRecord(recordId, [Name, SwitchName, PoolName, ClusterMonitored, Connected, BandwidthPercentage, IsDeleted]);
}

/**
 * @description Parses the output of the WinRM command and fill the virtual network adapters table.
 * @param {object} output - The output of the WinRM command.
 */
function parseOutput(output) {
    if (output.error === null) {

        var jsonOutput = JSON.parse(JSON.stringify(output));
        var listOfVirtualNetworkAdapters = [];
        if (!jsonOutput.outcome.stdout) {
            console.log("There are no virtual network adapters related to this virtual machine.");
        } else {
            var result = JSON.parse(jsonOutput.outcome.stdout);
        }
        if (Array.isArray(result)) {
            listOfVirtualNetworkAdapters = result;
        } else if (typeof result === 'object') {
            listOfVirtualNetworkAdapters.push(result);
        }
        for (var k = 0; k < listOfVirtualNetworkAdapters.length; k++) {
            populateTable(
                listOfVirtualNetworkAdapters[k].Id,
                listOfVirtualNetworkAdapters[k].Name,
                listOfVirtualNetworkAdapters[k].SwitchName,
                listOfVirtualNetworkAdapters[k].PoolName,
                listOfVirtualNetworkAdapters[k].ClusterMonitored,
                listOfVirtualNetworkAdapters[k].Connected,
                listOfVirtualNetworkAdapters[k].BandwidthPercentage,
                listOfVirtualNetworkAdapters[k].IsDeleted
            );
        }
        D.success(virtualNetworkAdaptersTable);
    } else {
        checkWinRmError(output.error);
    }
}