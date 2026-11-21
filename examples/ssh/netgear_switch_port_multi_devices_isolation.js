/**
 * Domotz Custom Driver
 * Name: Dynamic VLAN Isolation for NETGEAR Switch Ports with Multiple Devices
 * Description: This script isolates switch ports with multiple reachable devices by moving them to an empty VLAN. If the port returns to a single device, it is restored to its original VLAN
 *
 * Communication protocol is SSH
 *
 * Tested on NETGEAR Switch model M4250-10G2F-PoE+
 *
 * Creates a custom driver table with the following columns:
 *       - Vlan: The VLAN ID or name associated with the port
 *       - Reachable Mac Addresses: A list of MAC addresses detected on the port
 *       - Status: Indicates whether the port is active with a single device or has been moved to the isolated VLAN
 *
 * Create a custom actions:
 *       - Isolate switch port: Move switch port to an empty VLAN if more than one reachable device is detected. This isolates misused ports
 *       - Restore Switch Port: Restores switch ports to their original VLAN if the isolated VLAN contains 0 or 1 device, indicating that the port is no longer misused
 *
 **/

/**
 * The VLAN ID for the new isolated VLAN that will be created.
 * @type NUMBER
 */
const newIsolatedVlanId = D.getParameter('isolatedVlanId')

/**
 * The name of the production VLAN that is used
 * @type STRING
 */
const productionVlanName = D.getParameter('productionVlanName')

/**
 * @description Excluded ports from the device parameters to avoid them being isolated
 * @type LIST
 */
const excludedPorts = D.getParameter('excludedPorts')

// SSH configuration parameters for connecting to the switch
const sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    inter_command_timeout_ms: '5000',
    global_timeout_ms: '100000'
}

let isolatedPorts = []
let productionVlanID
let vlanList = []
let isolatedVlanId
let misusedPorts = []
let commands = ['enable', 'terminal length 0']

// Create a table to store data about reachable devices
var table = D.createTable(
    'Reachable devices', [
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
    if(err.code === 5){
        D.failure(D.errorType.AUTHENTICATION_ERROR)
    } else if (err.code === 255 || err.code === 1) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    } else {
        console.error(err)
        D.failure(D.errorType.GENERIC_ERROR)
    }
}

function executeCommands () {
    const d = D.q.defer()
    D.device.sendSSHCommands(sshConfig, function (output, error) {
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
 * Retrieves VLAN information from the switch via SSH
 * @returns {Promise} A promise resolving to VLAN information
 */
function getVlanInfo() {
    const d = D.q.defer()
    sshConfig.commands = commands.concat('show vlan')
    executeCommands(sshConfig)
        .then(function (output) {
            vlanList = parseVlanResponse(output)
            productionVlanID = getVlanIDFromName(vlanList)
            d.resolve()
        }).catch(failure)

    return d.promise
}

/**
 * Parses the VLAN response to get VLAN list and IDs
 * @param {string} response The raw SSH response from `show vlan`
 * @returns {Object} The parsed VLAN list
 */
function parseVlanResponse(response) {
    const vlanList = []
    const lines = response[2].split('\n')
    lines.forEach(function(line) {
        if (!line.trim() || line.includes('show vlan') || line.includes('Maximum VLAN Entries') || line.includes('VLAN Entries Currently in Use') || line.includes('VLAN ID VLAN Name') || line.includes('-------')) return
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 2) {
            vlanList.push({
                id: parts[0].trim(),
                name: parts[1]
            })
        }
    })
    return vlanList
}

/**
 * Returns the VLAN ID for a given VLAN name
 * @param {Array} vlanList List of VLAN objects
 * @returns {string} The VLAN ID
 */
function getVlanIDFromName(vlanList) {
    const vlan = vlanList.find(function(v){ return v.name.toUpperCase() === productionVlanName.toUpperCase() })
    if (!vlan) {
        console.error('VLAN', productionVlanName, 'doesn\'t exist or not found.')
        D.failure(D.errorType.GENERIC_ERROR)
    }
    console.log('VLAN', vlan.name, 'found with ID', vlan.id)
    return vlan.id
}

/**
 * Retrieves MAC address table for the production VLAN and checks port isolation
 * @returns {Promise} A promise resolving to the list of misused ports
 */
function getMacAddVlanProd() {
    const d = D.q.defer()
    sshConfig.commands = commands.concat('show mac-addr-table vlan ' + productionVlanID)
    executeCommands(sshConfig)
        .then(function (output) {
            misusedPorts = parseMacAddressTable(output)
            isolatedPorts = filterIsolatedPorts(misusedPorts)
            if (isolatedPorts.length === 0) {
                console.log('No ports need to be isolated')
                return getMacAddressTableForIsolatedVlan()
                    .then(function () {
                        d.resolve()
                    })
            } else {
                const portsToIsolate = isolatedPorts.map(function (port) { return port.port })
                console.log('Ports that need to be isolated: ', portsToIsolate)
                return getVlanDetailsPorts()
                    .then(function () {
                        return movePortsToIsolatedVlan()
                            .then(function () {
                                return getMacAddressTableForIsolatedVlan()
                            })
                            .then(function () {
                                d.resolve()
                            })
                    })
                    .then(function () {
                        d.resolve()
                    })
            }
        }).catch(failure)
    return d.promise
}

/**
 * Parses the MAC address table to identify ports with multiple devices
 * @param {string} response The raw SSH response from `show mac-addr-table`
 * @returns {Object} A list of port objects with reachable devices and MAC addresses
 */
function parseMacAddressTable(response) {
    const ports = []
    const lines = response[2].split('\n')
    lines.forEach(function(line) {
        if (!line.trim() || line.includes('show') || line.includes('Address Entries Currently in Use') || line.includes('MAC Address') || line.includes('-----------------')) return
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 3) {
            const port = parts[1]
            const macAddress = parts[0]
            const portData = ports.find(function(p) { return p.port === port })
            if (portData) {
                portData.reachableDevices++
                portData.macAddresses.push(macAddress)
            } else {
                ports.push({
                    port: port,
                    macAddresses: [macAddress],
                    reachableDevices: 1
                })
            }
        }
    })
    ports.forEach(function(portData) {
        portData.macAddresses = portData.macAddresses.join(', ')
    })
    return ports
}

/**
 * Filters out the ports that should be isolated based on the number of reachable devices
 * @param {Array} misusedPorts List of ports with reachable devices
 * @returns {Array} List of ports that need to be isolated
 */
function filterIsolatedPorts(misusedPorts) {
    return misusedPorts.filter(function (port) {
        return port.reachableDevices > 1 && !excludedPorts.map(function(excluded) { return excluded.toLowerCase() }).includes(port.port.toLowerCase())
    })
}

/**
 * Retrieves detailed VLAN information for all ports
 * @returns {Promise} A promise resolving once VLAN details have been fetched
 */
function getVlanDetailsPorts() {
    const d = D.q.defer()
    sshConfig.commands = commands.concat('show vlan port all')
    executeCommands(sshConfig)
        .then(function(output){
            const vlanAllList = parseVlanPortMapping(output)
            isolatedVlanId = filterIsolatedVlan(vlanList, vlanAllList)
            if (isolatedVlanId === null) {
                console.log('No isolated VLAN exists')
                return createIsolatedVlan()
            }

            d.resolve()
        })
        .catch(failure)
    return d.promise
}

/**
 * Checks if a VLAN exists in the list of VLANs
 * @param {string} vlanId The VLAN ID to check
 * @param {Array} vlanAllList List of VLAN objects
 * @returns {boolean} True if the VLAN exists, false otherwise
 */
function isVlanExists(vlanId, vlanAllList) {
    return vlanAllList.some(function(existingVlan) {
        return existingVlan.vlanId === vlanId
    })
}

/**
 * Filters for an isolated VLAN from the available VLANs
 * @param {Array} vlanList List of VLANs to search
 * @param {Array} vlanAllList List of all VLANs on the switch
 * @returns {string|null} The ID of the isolated VLAN, or null if none exists
 */
function filterIsolatedVlan(vlanList, vlanAllList) {
    for (let i = 0; i < vlanList.length; i++) {
        const vlan = vlanList[i]
        if (!isVlanExists(vlan.id, vlanAllList)) {
            console.log('An isolated VLAN already exists with ID', vlan.id, 'and name', vlan.name)
            return vlan.id
        }
    }
    return null
}

/**
 * Parses the VLAN port mapping response to determine the current port-to-VLAN associations
 * @param {string} response The raw SSH response from `show vlan port all`
 * @returns {Array} List of VLAN port mappings
 */
function parseVlanPortMapping(response) {
    const vlanPortMap = []
    const lines = response[2].split('\n')
    lines.forEach(function(line) {
        if (!line.trim() || line.includes('show vlan port all') || line.includes('Interface') || line.includes('Port') || line.includes('VLAN ID') || line.includes('---------')) return
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 2) {
            vlanPortMap.push({ vlanId: parts[1].trim() })
        }
    })
    return vlanPortMap
}

/**
 * Checks if the new isolated VLAN ID already exists in the VLAN list
 */
function checkExistingVlanId() {
    const existingVlans = []
    for (let i = 0; i < vlanList.length; i++) {
        existingVlans.push(vlanList[i].id)
    }
    if (existingVlans.includes(newIsolatedVlanId)) {
        console.error('VLAN ID ' + newIsolatedVlanId + ' already exists. Please choose another ID.')
        D.failure(D.errorType.GENERIC_ERROR)
    }
}

/**
 * Creates a new isolated VLAN by sending the necessary commands via SSH
 * @returns {Promise} Resolves once the VLAN creation is successful
 */
function createIsolatedVlan() {
    checkExistingVlanId()
    isolatedVlanId = newIsolatedVlanId
    const d = D.q.defer()
    sshConfig.commands = [
        'enable',
        'vlan database',
        'vlan ' + newIsolatedVlanId,
        'exit'
    ]
    executeCommands(sshConfig)
        .then(function() {
            console.log('Isolated VLAN ' + isolatedVlanId + ' created successfully')
            d.resolve()
        })
        .catch(failure)
    return d.promise
}

/**
 * Moves identified misused ports to the isolated VLAN
 * @returns {Promise} Resolves once the ports have been moved
 */
function movePortsToIsolatedVlan() {
    const d = D.q.defer()
    let isolateCommands = [
        'enable',
        'configure'
    ]
    isolatedPorts.forEach(function(port) {
        console.log('Moving port ' + port.port + ' to isolated VLAN', isolatedVlanId)
        isolateCommands.push('interface ' + port.port)
        isolateCommands.push('switchport access vlan ' + isolatedVlanId)
        isolateCommands.push('exit')
    })
    isolateCommands.push('exit')
    isolatedPorts.forEach(function(port) {
        isolateCommands.push('clear mac-addr-table interface ' + port.port)
    })
    sshConfig.commands = isolateCommands
    executeCommands(sshConfig)
        .then(function() {
            console.log('Ports ' + isolatedPorts + ' moved to isolated VLAN successfully.')
            d.resolve()
        })
        .catch(failure)
    return d.promise
}

let macTable = []
/**
 * Retrieves the MAC address table for the isolated VLAN and checks port isolation
 * @returns {Promise} Resolves once the MAC address table has been processed
 */
function getMacAddressTableForIsolatedVlan() {
    const d = D.q.defer()
    sshConfig.commands = commands.concat('show mac-addr-table vlan ' + isolatedVlanId)
    executeCommands(sshConfig)
        .then(function(output){
            macTable = parseMacAddressTable(output)
            macTable.forEach(function (entry){
                if (entry.reachableDevices <= 1) {
                    console.log('Port', entry.port, 'has', entry.reachableDevices, 'device(s), restoring to original VLAN ' + productionVlanID)
                    return restorePortToOriginalVlan([entry])
                } else {
                    console.log('Port', entry.port, 'still has', entry.reachableDevices, 'devices, cannot restore yet')
                    d.resolve()
                }
            })
            d.resolve()
        })
        .catch(failure)
    return d.promise
}

/**
 * Restores the given ports back to their original production VLAN
 * @param {Array} ports List of port objects to be restored
 * @returns {Promise} Resolves once the ports have been restored
 */
function restorePortToOriginalVlan(ports) {
    const d = D.q.defer()
    let restoreCommands = [
        'enable',
        'configure'
    ]
    ports.forEach(function(port) {
        console.log('Restoring port ' + port.port + ' to the original VLAN ' + productionVlanID)
        restoreCommands.push('interface ' + port.port)
        restoreCommands.push('switchport access vlan ' + productionVlanID)
        restoreCommands.push('exit')
    })
    restoreCommands.push('exit')
    ports.forEach(function(port) {
        restoreCommands.push('clear mac-addr-table interface ' + port.port)
    })
    sshConfig.commands = restoreCommands
    executeCommands(sshConfig)
        .then(function() {
            console.log('Port '+ port.port +  ' restored to VLAN ' + productionVlanID)
            d.resolve()
        })
        .catch(failure)
    return d.promise
}

/**
 * Handles any failure, logging the error and returning a failure response
 * @param {Error} err The error object to be logged
 */
function failure(err) {
    console.error(err)
    D.failure(D.errorType.GENERIC_ERROR)
}

/**
 * Inserts processed port data into a table after sanitizing input
 */
function insertDataIntoTable() {
    const filteredPorts = misusedPorts.filter(function(port) {
        return !excludedPorts.map(function(excluded) { return excluded.toLowerCase() }).includes(port.port.toLowerCase())
    })
    filteredPorts.forEach(function(port) {
        const statusProdVlan = port.reachableDevices > 1 ? 'Moved to VLAN ' + isolatedVlanId : 'Active with 1 device'
        table.insertRecord(port.port, [
            productionVlanID,
            port.macAddresses,
            statusProdVlan
        ])
    })

    D.success(table)
}


/**
 * @remote_procedure
 * @label Validate Switch Connection
 * @documentation This procedure validates the execution of switch commands by checking the SSH connection and command execution success.
 * Additionally, it checks if there are any devices that need to be isolated
 */
function validate () {
    getVlanInfo()
        .then(getMacAddVlanProd)
        .then(D.success)
        .catch(checkSshError)
}
/**
 * @remote_procedure
 * Get Switch Port Status
 * @documentation This procedure retrieves switch port status, detects ports with multiple reachable devices, isolates ports as needed, and restores ports when only zero or one device is connected. It also populates the results in a table.
 */
function get_status() {
    getVlanInfo()
        .then(getMacAddVlanProd)
        .then(insertDataIntoTable)
        .catch(checkSshError)
}

/**
 * @remote_procedure
 * @label Isolate Switch Port
 * @documentation Move switch port to an empty VLAN if more than one reachable device is detected. This isolates misused ports
 */
function custom_1(){
    getVlanInfo()
        .then(getMacAddVlanProd)
        .then(D.success)
        .catch(checkSshError)
}

/**
 * @remote_procedure
 * @label Restore Switch Port
 * @documentation Restores switch ports to their original VLAN if the isolated VLAN contains 0 or 1 device, indicating that the port is no longer misused.
 */
function custom_2(){
    getVlanInfo()
        .then(getMacAddVlanProd)
        .then(D.success)
        .catch(checkSshError)
}