/**
     * Function createBackup
     * @function
     * @param {ConfigurationBackup} configurationBackup - The backup object to be filled in and validated
     * @return {ConfigurationBackup}
     */
function createBackup(configurationBackup) {
    // maybe move to a library file
    var validatedBackup = {};
    if (configurationBackup === undefined || configurationBackup === null) {
        throw Error("Invalid configuration backup object - it must not be null or undefined");
    }
    validatedBackup.label = configurationBackup.label || "Custom Driver Configuration Backup";
    if (
        configurationBackup.running === undefined || configurationBackup.running === null ||
        !(typeof configurationBackup.running === "string")
    ) {
        throw Error("Invalid running configuration backup content - it must be string and not " + typeof configurationBackup.running);
    } else if (1048576 < configurationBackup.running.length) {
        throw Error("Maximum running configuration backup size exceeded: allowed " + 1048576 + " bytes, provided " + configurationBackup.running.length.toString());
    } else {
        validatedBackup.running = configurationBackup.running;
    }
    if (typeof configurationBackup.startup === "string") {
        if (1048576 < configurationBackup.startup.length) {
            throw Error("Maximum startup configuration backup size exceeded: allowed " + 1048576 + " bytes, provided " + configurationBackup.startup.length.toString());
        } else {
            validatedBackup.startup = configurationBackup.startup;
        }
    } else if (configurationBackup.startup !== undefined || configurationBackup.startup !== null) {
        validatedBackup.startup = null;
    } else {
        throw Error("Invalid startup configuration backup content - it must be string, null or undefined and not " + typeof configurationBackup.startup);
    }
    validatedBackup.type="backup"
    return validatedBackup;
};


module.exports.createBackup = createBackup;