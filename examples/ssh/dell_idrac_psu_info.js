/**
 * Name: Dell iDRAC PSU Monitoring
 * Description: Monitors the operational status of Power Supply Units (PSUs), as well as power usage details including total power consumption and capacity usage, on a Dell server with iDRAC.
 * 
 * Communication protocol is SSH.
 * 
 * Tested under iDRAC version 7.0.3 21053776 U3 P70
 * 
 * Keyboard Interactive option: true/false (depends on iDRAC version).
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Description: Description of the PSU unit
 *      - Primary Status: Current status of the PSU
 *      - Total Output Power: Total power output in watts (W)
 *      - Input Voltage: Voltage input to the PSU in volts (V)
 *      - Redundancy Status: Indicates PSU redundancy
 *      - Part Number: The part number of the PSU unit
 *      - Model: The model identifier for the PSU
 *      - Manufacturer: The manufacturer of the PSU unit
 * 
 * Creates a Custom Driver Variables
 *      - Power Usage: The current power consumption of the system
 *      - Power Capacity: The maximum power capacity available
 *      - Capacity Percentage: The percentage of power capacity currently being used
 */

// SSH command to retrieve PSU information
var psuCommand = 'racadm hwinventory'
var powerUsageCommand = 'racadm getsensorinfo'


// SSH options when running the command
var sshConfig = {
    'username': D.device.username(),
    'password': D.device.password(),
    'timeout': 30000,
    'keyboard_interactive': true,
    'port': 52144
}

// Custom Driver Table to store PSU information
var table = D.createTable(
    'PSU Info',
    [
        { label: 'Description', valueType: D.valueType.STRING },
        { label: 'Primary Status', valueType: D.valueType.STRING },
        { label: 'Total Output Power', unit: 'W', valueType: D.valueType.NUMBER },      
        { label: 'Input Voltage', unit: 'V', valueType: D.valueType.NUMBER },      
        { label: 'Redundancy Status', valueType: D.valueType.STRING },
        { label: 'Part Number', valueType: D.valueType.STRING },
        { label: 'Model', valueType: D.valueType.STRING },
        { label: 'Manufacturer', valueType: D.valueType.STRING }
    ]
)

/**
 * Handles SSH errors and logs them
 * @param {Object} err The error object from the SSH command
 */
function checkSshError(err) {
    if(err.message) console.error(err.message)
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR)
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    console.error(err)
    D.failure(D.errorType.GENERIC_ERROR)
}

/**
 * Executes an SSH command on the Dell iDRAC device
 * @param {string} command The command to execute on iDRAC
 * @returns {Promise} Resolves with the command output, or rejects with an error
 */
function executeCommand(command) {
    var d = D.q.defer()
    sshConfig.command = command
    D.device.sendSSHCommand(sshConfig, function (output, err) {
        if (err) {
            checkSshError(err)
        } else {           
            if (output && output.indexOf('COMMAND NOT RECOGNIZED')!==-1 || output.indexOf('ERROR')!==-1) {
                D.failure(D.errorType.PARSING_ERROR)
            } else {
                d.resolve(output)
            }           
        }
    })
    return d.promise
}

/**
 * Executes both the PSU status command and power usage command
 * @returns {Promise} Resolves with the combined output of PSU and power usage commands
 */
function executeDelliDracCommands(){
    return executeCommand(psuCommand) 
        .then(function (psuOutput) {
            return executeCommand(powerUsageCommand)
                .then(function (powerUsageOutput) {
                    return { psuOutput, powerUsageOutput }
                })
        })
}

/**
 * Sanitizes the output by removing reserved words and formatting it
 * @param {string} output The string to be sanitized
 * @returns {string} The sanitized string
 */
function sanitize(output) {
    const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
    const recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}

/**
 * Inserts a new PSU record into the table.
 * @param {Object} recordData - The PSU record data to insert.
 */
function insertPsuRecord(recordData) {
    table.insertRecord(
        recordData.recordId, [
            recordData.description,
            recordData.primaryStatus,
            recordData.totalOutputPower,
            recordData.inputVoltage,
            recordData.redundancyStatus,
            recordData.partNumber,
            recordData.model,
            recordData.manufacturer
        ]
    )
}

function extractData(output) {
    if (output) {
        var psulines = output.psuOutput.split('\n');
        var data = {};
        var instanceIdPsu = false;
        for (var i = 0; i < psulines.length; i++) {
            var line = psulines[i].trim();
            if (line.indexOf('[InstanceID: PSU.Slot.') >= 0) {
                instanceIdPsu = true;
                data = {};
            } else if (instanceIdPsu && line.length === 0) {
                var recordData = {
                    recordId: sanitize(data['InstanceID']),
                    description: data['DeviceDescription'] || 'N/A',
                    primaryStatus: data['PrimaryStatus'] || 'N/A',
                    totalOutputPower: (data['TotalOutputPower'] || '').replace(/\D+/g, '') || 'N/A',
                    inputVoltage: (data['InputVoltage'] || '').replace(/\D+/g, '') || 'N/A',
                    redundancyStatus: data['RedundancyStatus'] || 'N/A',
                    partNumber: data['PartNumber'] || 'N/A',
                    model: data['Model'] || 'N/A',
                    manufacturer: data['Manufacturer'] || 'N/A'
                };
                insertPsuRecord(recordData)
                data = {}
                instanceIdPsu = false
            } else if (instanceIdPsu) {
                var keyValue = line.split('=')
                if (keyValue.length === 2) {
                    var key = keyValue[0].trim()
                    var value = keyValue[1].trim()
                    data[key] = value
                }
            }
        }
        var powerUsagelines = output.powerUsageOutput.split('\n');
        for (var i = 0; i < powerUsagelines.length; i++) {
            var line = powerUsagelines[i].trim()
            if (line.indexOf('System Board Pwr Consumption') !== -1) {
                var parts = line.split(/\s+/)
                var powerUsage = parseInt(parts[5].replace('Watts', '').trim()) || 'N/A';
                var powerCapacity = parseInt(parts[7].replace('Watts', '').trim()) || 'N/A';
                if (powerUsage && powerCapacity) {
                    var capacityPercentage = ((powerUsage / powerCapacity) * 100).toFixed(2);
                }
            }
        }
        var variables = [
            D.createVariable("power-usage", "Power Usage", powerUsage, 'W', D.valueType.NUMBER),
            D.createVariable("capacity", "Maximum Capacity Usage", powerCapacity, 'W', D.valueType.NUMBER),
            D.createVariable("capacity-percentage", "Capacity Percentage", capacityPercentage, '%', D.valueType.NUMBER)
        ]
        D.success(variables, table)
    } else {
        console.error("No output provided.")
        D.failure(D.errorType.GENERIC_ERROR)
    }
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure validates if the driver can be applied to a device during association and validates provided credentials.
 */
function validate() {
    executeDelliDracCommands()
        .then(parseValidateOutput)
        .then(D.success)
        .catch(checkSshError)
}

function parseValidateOutput(output) {
    if (!output || !output.psuOutput|| !output.powerUsageOutput) {
        console.error("Validation failed: One or both of the command outputs are invalid.")
        D.failure(D.errorType.GENERIC_ERROR)
    } else {
        console.log("Validation successful")
    }
}

/**
 * @remote_procedure
 * @label Get PSU Info
 * @documentation Retrieves operational status of Power Supply Units (PSUs) on a Dell server with iDRAC
 */
function get_status() {
    executeDelliDracCommands()
        .then(extractData)
        .catch(checkSshError)
}
