/**
 * Domotz Custom Driver
 * Name: macOS - CPU and Memory Usage
 * Description: This script retrieves CPU and memory usage information from a macOS device
 *
 * Communication protocol is SSH
 *
 * Tested on macOS Version 14.5
 * 
 * Creates a custom driver variable:
 *     - Total Memory: Total physical memory in GB
 *     - Available Memory: Available physical memory in GB
 *     - Memory Usage: Percentage of memory usage
 *     - CPU Name: CPU model name
 *     - Processor Speed: Current processor speed in GHz
 *     - Physical Processors Packages: Number of physical CPU packages
 *     - Logical Processors Number: Number of logical processors
 *     - Cores Number: Number of CPU cores
 *     - CPU Load Average (1min): CPU load average (1-minute) as a percentage
 * 
 **/

var cmdCpuMemoryInfo = 'system_profiler SPHardwareDataType -json'
var cmdcpuAndMemoryUsage  = 'memory_pressure && sysctl  hw.logicalcpu vm.loadavg'

var sshConfig = {
  'username': D.device.username(),
  'password': D.device.password(),
  'timeout': 6000
}

/**
 * Checks SSH command errors and handles them appropriately
 * @param {Error} err The error object from the SSH command execution
 */
function checkSshError (err) {
  if(err.message) console.error(err.message)
  if(err.code == 5){
    D.failure(D.errorType.AUTHENTICATION_ERROR)
  } else if (err.code == 255 || err.code == 1) {
    D.failure(D.errorType.RESOURCE_UNAVAILABLE)
  } else {
    console.error(err)
    D.failure(D.errorType.GENERIC_ERROR)
  }
}

/**
 * Executes an SSH command using the provided configuration
 * @param {string} command The SSH command to execute
 * @returns {Promise} A promise that resolves with the command output or rejects with an error
 */
function executeCommand (command) {
  var d = D.q.defer()
  sshConfig.command = command
  D.device.sendSSHCommand(sshConfig, function (output, error) {
    if (error) {
      checkSshError(error)
      d.reject(error)
    } else {
      d.resolve(output)
    }
  })
  return d.promise
}


/**
 * Retrieves CPU and memory information.
 * @returns {Promise} A promise that resolves when both SSH commands are executed
 */
function execute() {
  return D.q.all([
    executeCommand(cmdCpuMemoryInfo),
    executeCommand(cmdcpuAndMemoryUsage)
  ])
}

/**
 * Converts bytes to gigabytes.
 * @param {number} bytes Number of bytes to convert
 * @returns {number} Equivalent number of gigabytes
 */
function bytesToGB(bytes) {
  return (bytes / Math.pow(1024, 3)).toFixed(2)
}

/**
 * Extracts variables from the SSH command output and creates custom driver variables
 * @param {string} output The output from the SSH command execution
 */
function extractVariables (output) {
  if (!output || output.length < 2 || output[0].trim() === '') {
    console.error('Output data is missing or incomplete')
    D.failure(D.errorType.PARSING_ERROR)
  } 
  // Parsing JSON output for system_profiler command
  var cpuMemoryInfo = JSON.parse(output[0])
  if (cpuMemoryInfo && cpuMemoryInfo.SPHardwareDataType && cpuMemoryInfo.SPHardwareDataType.length > 0) {
    var hardwareData = cpuMemoryInfo.SPHardwareDataType[0]
    var totalMemory = hardwareData.physical_memory ? hardwareData.physical_memory.replace(/[^\d,.]/g, "") : 0;
    var cpuName = hardwareData.cpu_type || 'N/A'
    var processorSpeed = hardwareData.current_processor_speed ? hardwareData.current_processor_speed.replace(/[^\d,.]/g, "") : 0;
    var physicalCPUPackages = hardwareData.packages || 0
    var coresNumber = hardwareData.number_processors || 0
  } else {
    console.error('Invalid or empty SPHardwareDataType')
  }
  // Parsing output from memory_pressure and sysctl commands
  if (output[1]) {
    var cpuMemoryUsage = output[1].trim().split('\n').filter(function(line) { return line.trim() !== '' })
    var memoryFreePercentage = (output[1].match(/System-wide memory free percentage: (\d+)%/)[1]) 
    var availableMemoryGB = (totalMemory * memoryFreePercentage) / 100
    var logicalCPUNumber = cpuMemoryUsage.find(function (line) { return line.indexOf('hw.logicalcpu') !== -1});
    logicalCPUNumber = logicalCPUNumber ? parseInt(logicalCPUNumber.split(':')[1].trim()) : 0;
    var loadAvg = cpuMemoryUsage.find(function (line) { return line.indexOf('vm.loadavg') !== -1})
    loadAvg = loadAvg ? loadAvg.split(':')[1].trim() : 0;
    var loadAverage1min = loadAvg ? loadAvg.replace(/[{}]/g, '').trim().split(' ')[0] : 0;
  } else {
    D.failure(D.errorType.PARSING_ERROR)
  }
  var variables = [
    D.createVariable('total-memory', 'Total Memory', totalMemory, 'GB', D.valueType.NUMBER ),
    D.createVariable('available-memory', 'Available Memory', availableMemoryGB, 'GB', D.valueType.NUMBER ),
    D.createVariable('memory-usage', 'Memory Usage', totalMemory > 0 ? (((totalMemory - availableMemoryGB) / totalMemory) * 100).toFixed(2) : 0, '%', D.valueType.NUMBER ),
    D.createVariable('cpu-name', 'CPU Name', cpuName, null, D.valueType.STRING),
    D.createVariable('processor-speed', 'Processor Speed', processorSpeed, 'GHz', D.valueType.NUMBER),
    D.createVariable('physical-processors-packages', 'Physical Processors Packages', physicalCPUPackages, null, D.valueType.NUMBER),
    D.createVariable('logical-processors-number', 'Logical Processors Number', logicalCPUNumber, null, D.valueType.NUMBER),
    D.createVariable('cores-number', 'Cores Number', coresNumber, null, D.valueType.NUMBER),
    D.createVariable('cpu-average', 'CPU Load Average (1min)', coresNumber > 0 ? (loadAverage1min / coresNumber) * 100 : 0, '%', D.valueType.NUMBER)
  ]
  D.success(variables)
}

/**
 * @remote_procedure
 * @label Validate SSH connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate () {
  execute()
    .then(parseValidateOutput)
    .catch(function (err) {
      console.error(err)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}

function parseValidateOutput (output) {
  if (output && output.length === 2 && output[0].trim() !== '' && output[1]) {
    console.log('Validation successful')
    D.success()
  } else {
    console.error('Validation failed');
    D.failure(D.errorType.GENERIC_ERROR);
  }
}

/**
* @remote_procedure
* @label Get CPU and memory usage 
* @documentation This procedure retrieves CPU and memory usage information from a macOS device
*/
function get_status () {
  execute()
    .then(extractVariables)
    .catch(checkSshError)
}