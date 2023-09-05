/**
 * Domotz Custom Driver 
 * Name: Microsoft Exchange server 
 * Description: This script is for monitoring a Microsoft Exchange Server.
 *   
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Windows 10
 *      - Microsoft Exchange Server 2019 CU12
 * 
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates a Custom Driver Table with the following columns:
 *      - Id: Performance counter path
 *      - Instance Name: Instance name of the counter
 *      - Cooked Value: Cooked value of the counter
 *      - Counter Type: Type of the performance counter
 * 
 */

// List of performance counters to monitor
var counters = [
    // Define the performance counters to monitor
    "\\MSExchange OWA\\Current Unique Users",
    "\\MSExchange OWA\\Requests/sec",
    "\\MSExchange Availability Service\\Availability Requests (sec)",
    "\\MSExchange MapiHttp Emsmdb\\User Count",
    "\\MSExchangeAutodiscover\\Requests/sec", 
    "\\MSExchange ActiveSync\\Average RPC Latency", 
    "\\MSExchange Database(*)\\I/O Database Reads Average Latency",
    "\\MSExchange Database(*)\\I/O Database Writes Average Latency",
    "\\MSExchange Database(*)\\Database Page Fault Stalls/sec",
    "\\MSExchangeIS Store(*)\\RPC Average Latency",
    "\\MSExchange ADAccess Domain Controllers(*)\\LDAP Read Time",
    "\\MSExchange ADAccess Domain Controllers(*)\\LDAP Search Time",
    "\\Web Service(*)\\Current Connections",
    "\\MSExchange Database(*)\\Database Page Faults/sec",
    "\\MSExchange Database(*)\\Database Page Fault Stalls/sec",
    "\\MSExchangeTransport Queues(*)\\Messages Queued For Delivery"
];

// Counter type mappings
var counterTypeMappings = {
    0: "number", //NumberOfItemsHEX32
    256: "number.", //NumberOfItemsHEX64
    65536: "number", // NumberOfItems32
    65792: "number", // NumberOfItems64
    4195328: "CounterDelta32", //
    4195584: "CounterDelta64", //
    4260864: "SampleCounter", //
    4523008: "CountPerTimeInterval32", //
    4523264: "CountPerTimeInterval64", //
    272696320: "rate/s", //RateOfCountsPerSecond32
    272696576: "rate/s", //RateOfCountsPerSecond64
    537003008: "RawFraction", //
    541132032: "CounterTimer", //
    542180608: "Timer100Ns", //
    549585920: "SampleFraction", //
    557909248: "CounterTimerInverse", //
    558957824: "Timer100NsInverse", //
    574686464: "CounterMultiTimer", //
    575735040: "CounterMultiTimer100Ns", //
    591463680: "CounterMultiTimerInverse", //
    592512256: "CounterMultiTimer100NsInverse", //
    805438464: "average time", //AverageTimer32
    807666944: "elapsed time", //ElapsedTime
    1073874176: "average count", //AverageCount64
    1073939457: "SampleBase", //
    1073939458: "AverageBase", //
    1073939459: "RawBase", //
    1107494144: "CounterMultiase" //
};

// WinRM configuration
var winrmConfig = {
    "command": 'Get-Counter -Counter ' + counters.map(function(counter){return '"' + counter + '"';}).join(',') + ' | ForEach-Object { $_.countersamples | Select-Object path, InstanceName, CookedValue, CounterType } | ConvertTo-Json',
    "username": D.device.username(),
    "password": D.device.password()
};


// Create a table to store monitored data
var table = D.createTable(
    "MS Exchange Monitored Items",
    [
        { label: "Instance Name" },
        { label: "Value" },
        { label: "Unit" }
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
 * @label Validate WinRM connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate() {
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
 * @label Get status
 * @documentation This procedure retrieves the current status of the Microsoft Exchange Server by querying performance counters.
 */
function get_status() {
    D.device.sendWinRMCommand(winrmConfig, parseOutput);
}

/**
 * Parses the output of the WinRM command and extracts data
 * @param {object} output - The output of the WinRM command.
 */
function parseOutput(output) {
    if (output.error === null) {
        var k = 0;
        var jsonOutput = JSON.parse(JSON.stringify(JSON.parse(output.outcome.stdout)));
        while (k < jsonOutput.length) {
            var path = jsonOutput[k].Path;
            const msitem = path.replace(/\\\\(.*?)\\/g,"").replace(/\\/g, " ").replace("msexchange", "");
            var recordId = ((k + 1) + "-" + msitem).slice(0,50);
            var instanceName = jsonOutput[k].InstanceName || "-";
            var cookedValue = jsonOutput[k].CookedValue;
            var counterTypeCode = jsonOutput[k].CounterType;
            var counterType = counterTypeMappings[counterTypeCode] || "Unknown Counter Type";           
            table.insertRecord(recordId, [instanceName, cookedValue, counterType]); 
            k++;
        }
        D.success(table);
    } else {
        console.error(output.error);
        checkWinRmError(output.error);
    }
}