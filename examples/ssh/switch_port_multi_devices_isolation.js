/**
 * Domotz Custom Driver
 * Name: Dynamic VLAN Isolation for Switch Ports with Multiple Devices
 * Description: This script isolates switch ports with multiple reachable devices by moving them to an empty VLAN. If the port returns to a single device, it is restored to its original VLAN
 *
 * Communication protocol is SSH
 *
 * Tested on Cisco switch version 15.2
 *
 * Creates a custom driver table with the follawing columns:
 *       - Vlan: The VLAN ID or name associated with the port
 *       - Reachable Mac Addresses: A list of MAC addresses detected on the port
 *       - Status: Indicates whether the port is active with a single device or has been moved to the isolated VLAN
 *
 * Create a custom actions:
 *       - Isolate switch port: Move switch port to an empty VLAN if more than one reachable device is detected. This isolates misused ports
 *       - Restore Switch Port: Restores switch ports to their original VLAN if the isolated VLAN contains 0 or 1 device, indicating that the port is no longer misused
 **/

// SSH command to retrieve MAC address table from the switch
const cmdGetMACAddressTable = 'show mac address-table'
// SSH command to retrieve VLAN information from the switch
const cmdShowVlans = 'show vlan brief'

// The name of the isolated VLAN used to move misused ports, which can be modified by the user to any desired name.
const isolatedVlanName = 'isolated-vlan'

/**
 * @description Excluded ports from the device parameters to avoid them being isolated
 * @type LIST
 */
const excludedPorts = D.getParameter('excludedPorts')

// SSH configuration parameters for connecting to the switch
const sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 10000,
    algorithms: {
        kex: [
            'diffie-hellman-group-exchange-sha1',
            'diffie-hellman-group14-sha1',
            'diffie-hellman-group1-sha1'
        ]
    }
}

// Create a table to store data about reachable devices
var table = D.createTable(
    'Reachable devices',
    [
        { label: 'Vlan', valueType: D.valueType.STRING },
        { label: 'Reachable Mac Addresses', valueType: D.valueType.STRING },
        { label: 'Status', valueType: D.valueType.STRING }
    ]
)

/**
 * Checks SSH command errors and handles them appropriately
 * @param {Error} err The error object from the SSH command execution
 */
function checkSshError(err) {
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
function executeCommand(command) {
    const d = D.q.defer()
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
 * Executes the SSH commands to retrieve MAC address table and VLAN information
 * @returns {Promise} A promise that resolves when all SSH commands are executed
 */
function executeSwitchCommands(){
    return D.q.all([
        executeCommand(cmdGetMACAddressTable),
        executeCommand(cmdShowVlans)
    ])
}

/**
 * Parses the MAC address table output into a structured format
 * @param {string} output Raw command output from the MAC address table
 * @returns {Array} Array of parsed MAC table entries
 */
function parseMacTableLines(output) {
    const macEntries = []
    const lines = output.split('\n')
    lines.forEach(function(line) {
        const trim = line.trim()
        if (trim === '' || trim.includes('Mac Address Table') || trim.includes('Vlan') || trim.includes('----') || trim.includes('Total')) return
        const parts = trim.split(/\s+/).filter(Boolean)
        if (parts.length >= 4) {
            macEntries.push({ vlan: parts[0], mac: parts[1], port: parts[3] })
        }
    })
    return macEntries
}

/**
 * Parses the VLAN table output into a structured format
 * @param {string} output Raw command output from the VLAN table
 * @returns {Array} Array of parsed VLAN entries
 */
function parseVlanTable(output) {
    return output.split('\n').reduce(function (vlanEntries, line) {
        let match = line.trim().match(/^(\d+)\s+([\w-]+)(?:\s+(\S+))?(?:\s+(.+))?$/)
        if (match) {
            vlanEntries.push({
                vlan: match[1],
                name: match[2],
                status: match[3] || '',
                ports: match[4] ? match[4].trim() : ''
            })
        } else if (vlanEntries.length > 0) {
            vlanEntries[vlanEntries.length - 1].ports += (vlanEntries[vlanEntries.length - 1].ports ? ', ' : '')
        }
        return vlanEntries
    }, [])
}

/**
 * Excludes uplink ports from the MAC address table to avoid them being isolated
 * @param {Array} macEntries List of parsed MAC address table entries
 * @returns {Array} Filtered list of MAC entries excluding uplink ports
 */
function excludeUplinkPorts(macEntries) {
    return macEntries.filter(function(entry) {
        return !excludedPorts.some(function(excludedPort) {
            return entry.port.toLowerCase() === excludedPort.toLowerCase()
        })
    })
}

/**
 * Processes the command results and extracts MAC, and VLAN data
 * @param {Array} results Array containing command outputs
 * @returns {Object} Processed data including macEntries, arpEntries, vlanEntries, and excludedPorts
 */
function processResults(results) {
    const macTableOutput = results[0]
    const vlanTableOutput = results[1]

    if (!macTableOutput || !vlanTableOutput) {
        console.error('Missing MAC, ARP, or VLAN table output')
        return D.failure(D.errorType.GENERIC_ERROR)
    }

    const macEntries = parseMacTableLines(macTableOutput)
    const vlanEntries = parseVlanTable(vlanTableOutput)

    const filteredMacEntries = excludeUplinkPorts(macEntries)
    return { filteredMacEntries, vlanEntries }
}

/**
 * Identifies reachable devices on switch ports, excluding uplink ports
 * @param {Array} filteredMacEntries List of filtered MAC address table entries
 * @returns {Array} List of processed ports with VLAN, reachable MAC addresses, and status
 */
function reachableDevices(filteredMacEntries) {
    const processedPorts = []
    return filteredMacEntries.reduce(function(acc, entry) {
        if (processedPorts.indexOf(entry.port) === -1) {
            processedPorts.push(entry.port)
            const reachableMacs = filteredMacEntries
                .filter(function(macEntry) { return macEntry.port === entry.port })
                .map(function(macEntry) { return macEntry.mac })
            acc.push({
                port: entry.port,
                vlan: 'VLAN' + entry.vlan,
                reachableMacAddresses: reachableMacs.join(', '),
                status: reachableMacs.length > 1 ? 'Moved to ' + isolatedVlanName : 'Active with 1 device'
            })
        }
        return acc
    }, [])
}

/**
 * Sanitizes a string by removing reserved words and limiting its length
 * @param {string} output The string to be sanitized
 * @param {number} maxLength The maximum length of the sanitized string
 * @returns {string} The sanitized string, truncated and formatted
 */
function sanitize(output, maxLength){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
    return output.replace(recordIdSanitizationRegex, '').slice(0, maxLength).replace(/\s+/g, '-').toLowerCase()
}

/**
 * Inserts processed port data into the table after sanitizing input
 * @param {Array} ports List of port objects containing VLAN, MAC addresses, and status
 */
function insertDataIntoTable(ports) {
    ports.forEach(function(port) {
        table.insertRecord(sanitize(port.port), [
            port.vlan,
            port.reachableMacAddresses,
            port.status
        ])
    })
}

/**
 * Counts the number of devices connected to each port
 * @param {Array} filteredMacEntries List of filtered MAC address table entries
 * @returns {Object} A map of port numbers to device counts
 */
function countPorts(filteredMacEntries) {
    const portCount = {}
    filteredMacEntries.forEach(function(portEntry) {
        portCount[portEntry.port] = (portCount[portEntry.port] || 0) + 1
    })
    console.log('Port Count:', portCount)
    return portCount
}

/**
 * Finds ports that have multiple devices connected that need isolation
 * @param {Object} portCount A map of port numbers to device counts
 * @returns {Array} List of ports with multiple connected devices
 */
function findPortsWithMultipleDevices(portCount) {
    return Object.keys(portCount).filter(function(port) {return portCount[port] > 1})
}

/**
 * Identifies ports that have multiple reachable devices and need isolation
 * @param {Array} filteredMacEntries List of filtered MAC address entries with port details
 * @returns {Array} List of isolated ports that require VLAN isolation
 */
function findIsolatedPorts(filteredMacEntries) {
    const portCount = countPorts(filteredMacEntries)
    return findPortsWithMultipleDevices(portCount)
}

/**
 * Checks if an isolated VLAN already exists
 * @param {Array} vlanEntries List of existing VLAN entries
 * @returns {Object|null} Returns the isolated VLAN details if found, otherwise null
 */
function checkExistingIsolatedVlan(vlanEntries) {
    return vlanEntries.find(function(vlan) {
        return vlan.name === isolatedVlanName
    })
}

/**
 * Handles the VLAN isolation process by checking existing VLANs or creating a new one
 * @param {Array} isolatedPorts Ports that need to be isolated
 * @param {Array} vlanEntries List of existing VLANs
 */
function handleIsolation(isolatedPorts, vlanEntries) {
    if (isolatedPorts.length === 0) {
        console.log('No ports need to be isolated')
        return
    }

    console.log('Ports that need to be isolated: ', isolatedPorts)

    let existingIsolatedVlan = checkExistingIsolatedVlan(vlanEntries)
    if (existingIsolatedVlan) {
        console.log('An isolated VLAN already exists with ID', existingIsolatedVlan.vlan, 'and name', existingIsolatedVlan.name)
        return movePortsToEmptyVlan(isolatedPorts, existingIsolatedVlan.vlan)
    } else {
        console.log('No isolated VLAN exists')
        return createNewVlanAndMovePorts(isolatedPorts, vlanEntries)
    }
}

/**
 * Moves specified ports to an existing isolated VLAN
 * @param {Array} isolatedPorts Ports to be moved
 * @param {number} vlanId VLAN ID to move the ports to
 * @returns {Promise} Resolves on successful execution
 */
function movePortsToEmptyVlan(isolatedPorts, vlanId) {
    var d = D.q.defer()
    let vlanCommands = [
        'configure terminal',
    ]

    vlanCommands = vlanCommands.concat(createPortSwitchCommands(isolatedPorts, vlanId))
    vlanCommands.push('exit')
    sshConfig.commands = vlanCommands
    D.device.sendSSHCommands(sshConfig, function(out, err) {
        if (err) {
            console.error('Error executing VLAN change command: ', err)
            d.reject(err)
        } else {
            console.log('VLAN change successful for ports: ', out)
            D.success()
        }
    })
    return d.promise
}

/**
 * Generates a new VLAN ID within a specified range, ensuring it does not conflict with existing VLANs
 * @param {Array} vlanEntries List of existing VLANs
 * @returns {number} Available VLAN ID
 */
function generateVlanId(vlanEntries) {
    const minVlan = 2
    const maxVlan = 1001
    const existingVlans = []
    for (let i = 0; i < vlanEntries.length; i++) {
        existingVlans.push(parseInt(vlanEntries[i].vlan))
    }
    for (let vlanId = minVlan; vlanId <= maxVlan; vlanId++) {
        if (existingVlans.indexOf(vlanId) === -1) {
            return vlanId
        }
    }
}

/**
 * Creates a new isolated VLAN and moves the specified ports into it
 * @param {Array} isolatedPorts Ports to be moved
 * @param {Array} vlanEntries List of existing VLANs
 * @returns {Promise} Resolves when VLAN creation and port movement are successful
 */
function createNewVlanAndMovePorts(isolatedPorts, vlanEntries) {
    const newVlanId = generateVlanId(vlanEntries)
    console.log("Creating new isolated VLAN with ID: ", newVlanId)

    var d = D.q.defer()
    let vlanCommands = [
        'configure terminal',
        'vlan ' + newVlanId,
        'name ' + isolatedVlanName,
    ]

    vlanCommands = vlanCommands.concat(createPortSwitchCommands(isolatedPorts, newVlanId))
    vlanCommands.push('exit')

    sshConfig.commands = vlanCommands
    D.device.sendSSHCommands(sshConfig, function(out, err) {
        if (err) {
            console.error('Error creating new VLAN and switching ports: ', err)
            d.reject(err)
        } else {
            console.log('New VLAN created and ports switched successfully: ', out)
            D.success()
        }
    })
    return d.promise
}

/**
 * Generates CLI commands to switch ports to a specified VLAN
 * @param {Array} isolatedPorts Ports to be switched
 * @param {number} vlanId Target VLAN ID
 * @returns {Array} List of CLI commands
 */
function createPortSwitchCommands(isolatedPorts, vlanId) {
    let portSwitchCommands = []
    isolatedPorts.forEach(function(port) {
        console.log('Switching port', port, 'to the isolated VLAN', vlanId)
        portSwitchCommands.push('interface ' + port)
        portSwitchCommands.push('switchport access vlan ' + vlanId)
    })
    return portSwitchCommands
}

/**
 * Counts the number of devices connected to a specific port in the isolated VLAN
 * @param {string} port The port to check for connected devices
 * @param {Array} filteredMacEntries List of MAC address entries filtered for the isolated VLAN
 * @returns {number} The count of devices connected to the specified port
 */
function getDeviceCount(port, filteredMacEntries) {
    return filteredMacEntries.filter(function(entry){ return entry.port === port}).length
}

/**
 * Checks whether ports should be restored to their original VLAN based on device count
 * @param {Array} restoredPorts List of ports to be evaluated for restoration
 * @param {Array} filteredMacEntries List of filtered MAC address entries
 */
function checkAndRestorePorts(restoredPorts, filteredMacEntries) {
    restoredPorts.forEach(function(port) {
        const deviceCount = getDeviceCount(port, filteredMacEntries)

        if (deviceCount === 0 || deviceCount === 1) {
            console.log('Port', port, 'has', deviceCount, 'device(s), restoring to VLAN 1')
            restorePortsToOriginalVlan([port])
        } else {
            console.log('Port', port, 'still has', deviceCount, 'devices, cannot restore yet')
        }
    })
}

/**
 * Retrieves a list of ports associated with the isolated VLAN
 * @param {Array} vlanEntries List of VLAN entries to search for the isolated VLAN
 * @returns {Array} List of ports assigned to the isolated VLAN
 */
function getIsolatedVlanPorts(vlanEntries) {
    const isolatedVlan = vlanEntries.find(function(vlan) {
        return vlan.name === isolatedVlanName
    })
    return isolatedVlan.ports.split(',').map(function(port) {
        return port.trim()
    })
}

/**
 * Restores the specified ports back to the default VLAN 1
 * @param {Array} restoredPorts Ports to be restored
 * @returns {Promise} Resolves when restoration is complete
 */
function restorePortsToOriginalVlan(restoredPorts) {
    var d = D.q.defer()
    let restoreCommands = [
        'configure terminal',
    ]

    restoredPorts.forEach(function(port) {
        console.log('Restoring port', port, 'to VLAN 1')
        restoreCommands.push('interface ' + port)
        restoreCommands.push('switchport access vlan 1')
    })
    restoreCommands.push('exit')
    sshConfig.commands = restoreCommands
    D.device.sendSSHCommands(sshConfig, function(out, err) {
        if (err) {
            console.error('Error restoring VLAN 1: ', err)
            d.reject(err)
        } else {
            console.log('Ports restored to VLAN 1 successfully: ', out)
            D.success()
        }
    })
    return d.promise
}

/**
 * @remote_procedure
 * @label Validate Switch Connection
 * @documentation This procedure validates the execution of switch commands by checking the SSH connection and command execution success.
 * Additionally, it checks if there are any devices that need to be isolated
 */
function validate () {
    executeSwitchCommands()
        .then(function (result){
            const isolationData = processResults(result)
            const isolatedPorts = findIsolatedPorts(isolationData.filteredMacEntries)
            if (isolatedPorts.length > 0) {
                console.log('There is some Ports that need to be isolated:', isolatedPorts)
            }
            console.log('No ports need to be isolated')
            D.success()
        })
        .catch(checkSshError)
}

/**
 * @remote_procedure
 * Get Switch Port Status
 * @documentation This procedure retrieves switch port status, detects ports with multiple reachable devices, isolates ports as needed, and restores ports when only zero or one device is connected. It also populates the results in a table.
 */
function get_status() {
    executeSwitchCommands()
        .then(function (result) {
            const isolationData = processResults(result)

            const isolationTable = reachableDevices(isolationData.filteredMacEntries)
            insertDataIntoTable(isolationTable)

            const isolatedPorts = findIsolatedPorts(isolationData.filteredMacEntries)
            handleIsolation(isolatedPorts, isolationData.vlanEntries)

            const restoredPorts = getIsolatedVlanPorts(isolationData.vlanEntries)
            checkAndRestorePorts(restoredPorts, isolationData.filteredMacEntries)
            D.success(table)
        })
        .catch(checkSshError)
}

/**
 * @remote_procedure
 * @label Isolate Switch Port
 * @documentation Move switch port to an empty VLAN if more than one reachable device is detected. This isolates misused ports
 */
function custom_1(){
    executeSwitchCommands()
        .then(function (result) {
            const isolationData = processResults(result)
            const isolatedPorts = findIsolatedPorts(isolationData.filteredMacEntries)
            handleIsolation(isolatedPorts, isolationData.vlanEntries)
        })
        .catch(checkSshError)
}

/**
 * @remote_procedure
 * @label Restore Switch Port
 * @documentation Restores switch ports to their original VLAN if the isolated VLAN contains 0 or 1 device, indicating that the port is no longer misused.
 */
function custom_2(){
    executeSwitchCommands()
        .then(function (result) {
            const isolationData = processResults(result)
            const restoredPorts = getIsolatedVlanPorts(isolationData.vlanEntries)
            checkAndRestorePorts(restoredPorts, isolationData.filteredMacEntries)
            D.success()
        })
        .catch(checkSshError)
}