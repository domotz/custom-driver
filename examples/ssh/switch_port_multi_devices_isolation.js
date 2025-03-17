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

const cmdGetMACAddressTable = 'show mac address-table'
const cmdGetARPTable = 'show arp'
const cmdShowVlans = 'show vlan brief'

const isolatedVlanName = 'isolated-vlan'

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
 * Retrieves information.
 * @returns {Promise} A promise that resolves when all SSH commands are executed
 */
function executeSwitchCommands(){
    return D.q.all([
        executeCommand(cmdGetMACAddressTable),
        executeCommand(cmdGetARPTable),
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
 * Parses the ARP table output into a structured format
 * @param {string} output Raw command output from the ARP table
 * @returns {Array} Array of parsed ARP table entries
 */
function parseArpTable(output) {
    const arpEntries = []
    const lines = output.split('\n')
    lines.forEach(function(line) {
        const trim = line.trim()
        if (trim === '' || trim.includes('Protocol') || trim.includes('show arp')) return
        const parts = trim.split(/\s+/).filter(Boolean)
        if (parts.length >= 6) {
            arpEntries.push({ ip: parts[1], mac: parts[3] })
        }
    })
    return arpEntries
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
 * Excludes uplink ports based on ARP table information
 * @param {Array} macEntries Parsed MAC address table entries
 * @param {Array} arpEntries Parsed ARP table entries
 * @returns {Array} List of ports to be excluded
 */
function excludeUplinkPorts(macEntries, arpEntries) {
    const excludedPorts = []
    const arpMacs = arpEntries.map(function(entry) {
        return entry.mac
    })
    macEntries.forEach(function(entry) {
        if (arpMacs.includes(entry.mac)) {
            excludedPorts.push(entry.port)
        }
    })
    return excludedPorts
}

/**
 * Processes the command results and extracts MAC, ARP, and VLAN data
 * @param {Array} results Array containing command outputs
 * @returns {Object} Processed data including macEntries, arpEntries, vlanEntries, and excludedPorts
 */
function processResults(results) {
    const macTableOutput = results[0]
    const arpTableOutput = results[1]
    const vlanTableOutput = results[2]

    if (!macTableOutput || !arpTableOutput || !vlanTableOutput) {
        console.error('Missing MAC, ARP, or VLAN table output')
        return D.failure(D.errorType.GENERIC_ERROR)
    }

    const macEntries = parseMacTableLines(macTableOutput)
    const arpEntries = parseArpTable(arpTableOutput)
    const vlanEntries = parseVlanTable(vlanTableOutput)

    const excludedPorts = excludeUplinkPorts(macEntries, arpEntries)
    return { macEntries, arpEntries, vlanEntries, excludedPorts }
}

/**
 * Identifies reachable devices on switch ports, excluding uplink ports
 * @param {Array} macEntries Parsed MAC address table entries
 * @param {Array} excludedPorts List of ports to be excluded
 * @returns {Array} List of processed ports with VLAN, reachable MAC addresses, and status
 */
function reachableDevices(macEntries, excludedPorts) {
    const processedPorts = []
    return macEntries
        .filter(function(entry) { return !excludedPorts.includes(entry.port)})
        .reduce(function(acc, entry) {
            if (processedPorts.indexOf(entry.port) === -1) {
                processedPorts.push(entry.port)
                const vlan = entry.vlan
                const reachableMacs = macEntries.filter(function(macEntry) { return macEntry.port === entry.port }).map(function(macEntry) { return macEntry.mac })
                acc.push({
                    port: entry.port,
                    vlan: 'VLAN' + vlan,
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
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
    return output.replace(recordIdSanitisationRegex, '').slice(0, maxLength).replace(/\s+/g, '-').toLowerCase()
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
 * @param {Array} macEntries Parsed MAC address table entries
 * @param {Array} excludedPorts List of ports to exclude from counting
 * @returns {Object} A map of port numbers to device counts
 */
function countPorts(macEntries, excludedPorts) {
    const portCount = {}
    macEntries.forEach(function(portEntry) {
        if (!excludedPorts.includes(portEntry.port)) {
            portCount[portEntry.port] = (portCount[portEntry.port] || 0) + 1
        }
    })
    console.log('Port Count:', portCount)
    return portCount
}

/**
 * Finds ports that have multiple devices connected
 * @param {Object} portCount A map of port numbers to device counts
 * @returns {Array} List of ports with multiple connected devices
 */
function findPortsWithMultipleDevices(portCount) {
    return Object.keys(portCount).filter(function(port) {return portCount[port] > 1})
}

/**
 * Identifies ports that have multiple reachable devices and need isolation
 * @param {Array} macEntries List of MAC address entries with port details
 * @param {Array} excludedPorts List of ports to be excluded from evaluation
 * @returns {Array} List of isolated ports
 */
function findIsolatedPorts(macEntries, excludedPorts) {
    const portCount = countPorts(macEntries, excludedPorts)
    return findPortsWithMultipleDevices(portCount)
}

/**
 * Checks if an isolated VLAN already exists
 * @param {Array} vlanEntries List of VLAN entries
 * @returns {Object|null} Returns VLAN details if found, otherwise null
 */
function checkExistingIsolatedVlan(vlanEntries) {
    let existingIsolatedVlan = vlanEntries.find(function(vlan) {
        return vlan.name === isolatedVlanName
    })
    console.log('Isolated VLAN:', existingIsolatedVlan || 'Not exist')
    return existingIsolatedVlan
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
 * Counts the number of devices in isolated VLAN connected to a specific port
 * @param {string} port Port to check
 * @param {Array} macEntries List of MAC address entries
 * @returns {number} Count of connected devices
 */
function getDeviceCount(port, macEntries) {
    return macEntries.filter(function(entry){ return entry.port === port}).length
}

/**
 * Checks whether ports should be restored to their original VLAN based on device count
 * @param {Array} restoredPorts Ports under evaluation
 * @param {Array} macEntries MAC address entries
 */
function checkAndRestorePorts(restoredPorts, macEntries) {
    restoredPorts.forEach(function(port) {
        const deviceCount = getDeviceCount(port, macEntries)

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
 * @param {Array} vlanEntries VLAN entries
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
 * Restores the specified ports back to the defaul VLAN 1
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
            const isolatedPorts = findIsolatedPorts(isolationData.macEntries, isolationData.excludedPorts)
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
 * @documentation This procedure retrieves switch port status, detects ports with multiple reachable devices and populates the results in a table.
 */
function get_status () {
    executeSwitchCommands()
        .then(function (result){
            const isolationData = processResults(result)
            const isolationTable = reachableDevices(isolationData.macEntries, isolationData.excludedPorts)
            insertDataIntoTable(isolationTable)
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
            const isolatedPorts = findIsolatedPorts(isolationData.macEntries, isolationData.excludedPorts)
            handleIsolation(isolatedPorts, isolationData.vlanEntries)
            D.success()
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
            checkAndRestorePorts(restoredPorts, isolationData.macEntries)
        })
        .catch(checkSshError)
}