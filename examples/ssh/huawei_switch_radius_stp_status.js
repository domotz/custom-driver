/**
 * Domotz Custom Driver
 * Name: Huawei Switch - Radius and STP status
 * Description: This script retrieves the status of RADIUS authentication and Spanning Tree Protocol (STP) from a Huawei Switch.
 *
 * Communication protocol is SSH
 *
 * Tested on Huawei S5731 version V200R022C00SPC500
 *
 * Creates a custom driver variable:
 *      - RADIUS: Indicates whether RADIUS authentication is enabled or disabled.
 *      - STP: Indicates whether Spanning Tree Protocol (STP) is enabled or disabled.
 *
 **/

const sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    inter_command_timeout_ms: 5000,
    global_timeout_ms: 60000,
    prompt_regex: /--- More ---|>/
}

/**
 * Checks SSH command errors and handles them appropriately
 * @param {Error} error The error object from the SSH command execution
 */
function checkSshError (error) {
    if(error.message) console.error(error.message)
    if(error.code == 5){
        D.failure(D.errorType.AUTHENTICATION_ERROR)
    } else if (error.code == 255 || error.code == 1) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    } else {
        console.error(error)
        D.failure(D.errorType.GENERIC_ERROR)
    }
}

/**
 * Executes an SSH command using the provided configuration
 * @param {string} command The SSH command to execute
 * @returns {Promise} A promise that resolves with the command output or rejects with an error
 */
function executeCommands () {
    const d = D.q.defer()
    sshConfig.commands = ['display authentication-scheme', 'display stp']
    D.device.sendSSHCommands(sshConfig, function (output, error) {
        if (error) {
            checkSshError(error)
            d.reject(error)
        } else {
            if (output && output.some(function(commandOutput) {
                return commandOutput.includes("Ambiguous command found")
            })) {
                console.error("Error: Ambiguous command found")
                D.failure(D.errorType.PARSING_ERROR)
            } else {
                d.resolve(output)
            }
        }
    })
    return d.promise
}

/**
 * Extracts RADIUS and STP status from the SSH command output
 * @param {Array} output The array containing command outputs
 * @returns {Object} An object containing the extracted RADIUS and STP status
 */
function extractVariables(output) {
    let radiusStatus = 'Disabled'
    const radiusCommandOutput = output[0]
    if (radiusCommandOutput.includes('RADIUS')) {
        radiusStatus = "Enabled"
    }

    let stpStatus = 'Disabled'
    const stpCommandOutput = output[1]
    console.log(output[1])
    if (stpCommandOutput.includes('Mode MSTP') || stpCommandOutput.includes('Mode RSTP')) {
        stpStatus = 'Enabled'
    }

    return {
        radius: radiusStatus,
        stp: stpStatus
    }
}

/**
 * Displays extracted RADIUS and STP status as Domotz variables
 * @param {Object} variables The object containing extracted status values
 */
function displayData(variables) {
    D.success([
        D.createVariable("radius", "Radius", variables.radius, null, D.valueType.STRING),
        D.createVariable("stp", "STP", variables.stp, null, D.valueType.STRING)
    ])
}

/**
 * @remote_procedure
 * @label Validate SSH connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate () {
    executeCommands()
        .then(function (output) {
            if (output && output.length === 2 && output[0].trim() !== "" && output[1].trim() !== "") {
                console.log("Validation Success")
                D.success()
            } else {
                console.log("Validation failed")
                D.failure(D.errorType.GENERIC_ERROR)
            }
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * @remote_procedure
 * @label Get RADIUS and STP status
 * @documentation This procedure retrieves the status of RADIUS authentication and STP from the switch.
 */
function get_status () {
    executeCommands()
        .then(extractVariables)
        .then(displayData)
        .catch(checkSshError)
}