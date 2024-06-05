/**
 * Domotz Custom Driver 
 * Name: Windows Hyper-V Show all VMs
 * Description: Show Hyper-V Show all VMs
 *   
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Windows 10
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates a Custom Driver table with the following columns:
 *    - Id: Unique identifier for the disk within the virtual hard drive system.
 *    - Name: The unique identifier or name assigned to the virtual machine.
 *    - State: The current operational state of the virtual machine .
 *    - OS Name: The virtual machine The OS Name when is powered on.
 *    - OS Version: The virtual machine The OS Version when is powered on.
 *    - Memory size (MB): The amount of memory allocated to the virtual machine, typically measured in megabytes (MB).
 *    - CPU Usage ( % ): The percentage of CPU resources currently being utilized by the virtual machine.
 *    - Creation Time: The timestamp indicating when the virtual machine was initially created.
 *    - Processors: The number of virtual processors or CPU cores assigned to the virtual machine.
 *    - Up time: The timestamp indicating when the virtual machine was last booted or started.
 *    - Status : A summary of the current state and health of the virtual machine, providing insights into its operational status and any issues detected.
 * 
 * Privilege required: 
 *    - Administrator
 */


// WinRM command to retrieve all Hyper-v VMs
cmd = '(Get-VM | ForEach-Object '+
'{ '+
    'try {$Kvp = Get-WmiObject -namespace root/virtualization/v2 -query ("Associators of {" + (Get-WmiObject -Namespace root/virtualization/v2 -Query "Select * From Msvm_ComputerSystem Where ElementName=`"$($_.Name)`"").path + "} Where ResultClass=Msvm_KvpExchangeComponent")' + 
    '} catch {  Write-Error "Failed to execute the query. Error details: $_";}' + 
    '@{ "Id" = $_.Id; "Name" = $_.Name; "State" = $_.State; "osInfo" = $Kvp.GuestIntrinsicExchangeItems; "MemoryAssigned" = [math]::round($_.MemoryAssigned / 1MB, 2); "CPUUsage" = $_.CPUUsage; "Status" = $_.Status; "CreationTime" = $_.CreationTime; "ProcessorCount" = $_.ProcessorCount; "Uptime" = $_.Uptime}'+
'}) | ConvertTo-Json';

// Define the WinRM options when running the commands
var winrmConfig = {
    "command": cmd,
    "username": D.device.username(),
    "password": D.device.password()
};

/**
 * Object mapping state codes to their corresponding descriptions.
 */
var stateCodes = {
    "1": "Other",
    "2": "Running",
    "3": "Off",
    "4": "Stopping",
    "5": "Saved",
    "6": "Paused",
    "7": "Starting",
    "8": "Reset",
    "9": "Saving",
    "10": "Pausing",
    "11": "Resuming",
    "12": "FastSaved",
    "13": "FastSaving",
    "14": "ForceShutdown",
    "15": "ForceReboot",
    "16": "Hibernated",
    "17": "ComponentServicing",
    "18": "RunningCritical",
    "19": "OffCritical",
    "20": "StoppingCritical",
    "21": "SavedCritical",
    "22": "PausedCritical",
    "23": "StartingCritical",
    "24": "ResetCritical",
    "25": "SavingCritical",
    "26": "PausingCritical",
    "27": "ResumingCritical",
    "28": "FastSavedCritical",
    "29": "FastSavingCritical"
};

// Creation of custom driver table 
var virtualMachineTable = D.createTable(
    "Virtual machines",
    [
        { label: "Name" },
        { label: "State" },
        { label: "OS Name" },
        { label: "OS Version" },
        { label: "Memory", unit: "MB", valueType: D.valueType.NUMBER },
        { label: "CPU Usage", unit: "%", valueType: D.valueType.NUMBER  },
        { label: "Creation Time" },
        { label: "Processor Count" },
        { label: "Uptime" },
        { label: "Status" }
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
    winrmConfig.command = "Get-VM";
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
 * @label Retrieve list of virtual machines
 * @documentation This procedure retrieves a list of virtual machines for the target device
 */
function get_status() {
    D.device.sendWinRMCommand(winrmConfig, parseOutput);
}

/**
 * @description Sanitizes the given output string by removing reserved words and special characters,
 * limiting its length to 50 characters, replacing spaces with hyphens, and converting it to lowercase.
 * @param {string} output - The string to be sanitized.
 * @returns {string} - The sanitized string.
 */
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

/**
 * Populates a table with virtual machine information.
 */
function populateTable(id, name, state, osName, osVersion, memoryAssigned, CPUUsage, creationTime, processorCount,  uptime, status) {
    var recordId = sanitize(id);
    state = stateCodes[state];
    creationTime = formatDate(new Date(parseInt(creationTime.match(/\d+/)[0], 10)));
    uptime = convertTotalSeconds(uptime.TotalSeconds);
    virtualMachineTable.insertRecord(recordId, [name, state, osName, osVersion, memoryAssigned, CPUUsage, creationTime, processorCount,  uptime, status]);
}

/**
 * Formats a date into a string in the format 'YYYY-MM-DD HH:mm:ss'.
 * @param {Date} date - The date object to format.
 * @returns {string} - The formatted date string.
 */
function formatDate (date){
    var year = date.getFullYear();
    var month = date.getMonth() + 1; // Month is zero-indexed, so we add 1
    var day = date.getDate();
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var seconds = date.getSeconds();
    return year + '-' + pad(month) + '-' + pad(day) + ' ' + pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
}

/**
 * Pads a number with leading zero if it's less than 10.
 * @param {number} number - The number to pad.
 * @returns {string|number} - The padded number as a string if less than 10, otherwise the original number.
 */
function pad(number) {
    if (number < 10) {
        return '0' + number;
    }
    return number;
}

/**
 * Convert total seconds into a human-readable duration string.
 * @param {number} totalSeconds - The total number of seconds to be converted.
 * @returns {string} - The formatted duration string in the format "X days, X hours, X minutes, X seconds".
 */
function convertTotalSeconds(totalSeconds) {
    // Calculate days, hours, minutes, and seconds from totalSeconds
    var days = Math.floor(totalSeconds / (60 * 60 * 24));
    var hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
    var minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    var seconds = Math.floor(totalSeconds % 60); 

    // Construct the formatted duration string
    var formattedDuration = days + " days, " + hours + " hours, " + minutes + " minutes, " + seconds + " seconds";

    // Return the formatted duration
    return formattedDuration;
}

/**
 * @description Parses the output of the WinRM command and fill the virtual machines table.
 * @param {object} output - The output of the WinRM command.
 */
function parseOutput(output) {
    if (output.error === null) {
        var jsonOutput = JSON.parse(JSON.stringify(output));
        console.log(" *********************  \n\n\n\n\n\n\n");
        console.log(" jsonOutput.outcome.stdout : ", jsonOutput.outcome.stdout);
        var listOfVMs = [];
        if (!jsonOutput.outcome.stdout) {
            console.log("There are no virtual machines related to this filter.");
        } else {
            var result = JSON.parse(jsonOutput.outcome.stdout.replace(/__/g, ''));
        }
        if (Array.isArray(result)) {
            listOfVMs = result;
        } else if (typeof result === 'object') {
            listOfVMs.push(result);
        }
        for (var k = 0; k < listOfVMs.length; k++) {            
            var xmlData = listOfVMs[k].osInfo;
            var osInfo = extractOSInfo(xmlData);
            var osName = osInfo.osName;
            var osVersion = osInfo.osVersion;
            console.log('osInfo Name: '+osName);
            console.log('osInfo Version: '+osVersion);
            populateTable(
                listOfVMs[k].Id,
                listOfVMs[k].Name,
                listOfVMs[k].State,
                osName,
                osVersion,
                listOfVMs[k].MemoryAssigned,
                listOfVMs[k].CPUUsage,
                listOfVMs[k].CreationTime,
                listOfVMs[k].ProcessorCount,
                listOfVMs[k].Uptime, 
                listOfVMs[k].Status
            );
        }
        D.success(virtualMachineTable);
    } else {
        checkWinRmError(output.error);
    }
}

/**
 * Extracts the operating system name and version from an XML list.
 * @param {Array<string>} xmlList - The list of XML strings to extract OS information from.
 * @returns {Object} - An object containing the extracted OS name and version.
 * @property {string} osName - The extracted operating system name.
 * @property {string} osVersion - The extracted operating system version.
 */
function extractOSInfo(xmlList) {
    var osName = 'N/A';
    var osVersion = 'N/A';
    if(xmlList !== null){
        xmlList.forEach(function(xml){
            var $ = D.htmlParse(xml, { xmlMode: true });
            $('PROPERTY').each(function(i, el){
                var name = $(el).attr('NAME');
                var value = $(el).find('VALUE').text();
                if (name === 'Name') {
                    var nameValue = $(el).find('VALUE').text();
                    if (nameValue === 'OSName') {
                        osName = $(el).siblings('PROPERTY[NAME="Data"]').find('VALUE').text();
                    } else if (nameValue === 'OSVersion') {
                        osVersion = $(el).siblings('PROPERTY[NAME="Data"]').find('VALUE').text();
                    }
                }
            });
        });
    }
    return { osName: osName, osVersion: osVersion };
}