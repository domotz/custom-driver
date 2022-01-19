/**
 * This Driver Collects System uptime for a cisco device and stores it in a custom driver variable.
 * A driver action function is exposed by this driver that allows the reboot of a cisco device with "snmp-server system-shutdown" configuration set
 * Communication protocol is SNMP
 * Creates a single custom driver variable
 */

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure verifies if the device has the needed Cisco Enterprise OID for the custom_1 action (reboot)
*/
function validate(){
    var tsMsgSendOid = '1.3.6.1.4.1.9.2.9.9.0'; // Integer
    function getCallback(output, error){
        if (error || output[tsMsgSendOid].error){
            console.error("Received an error during the SNMP Get ", error || output[tsMsgSendOid].error);
            D.failure(D.errorType.PARSING_ERROR);
        } else {
            D.success();
        }
    };
    // Creating the SNMP session
    var snmpSession = D.device.createSNMPSession();
    // Executing an SNMP get towards set status needed OID
    snmpSession.get([tsMsgSendOid], getCallback)

} 
/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure collects system uptime value and sets it in a custom driver variable
*/
function get_status(){
    var variables = []
    var sysUptimeOid = '1.3.6.1.2.1.1.3.0';
    function getCallback(output, error){
        console.info("asd", output[sysUptimeOid]);
        if (error || output[sysUptimeOid].error){
            console.error("Received an error during the SNMP Get ", error || output[sysUptimeOid].error);
            D.failure(D.errorType.PARSING_ERROR);
        } else {
            var variableSystemUptime = D.device.createVariable(1, "System Uptime in Days", Math.round(output[sysUptimeOid]/86400000), "days");
            variables.push(variableSystemUptime)
            D.success(variables);
        }
    };
    // Creating the SNMP session
    var snmpSession = D.device.createSNMPSession();
    // Executing an SNMP get towards the system uptime OID
    snmpSession.get([sysUptimeOid], getCallback)
};
/**
 * The device configuration must have this line : snmp-server system-shutdown
 * @remote_procedure
 * @label Reboot
 * @documentation Reboots a Cisco device
*/
function custom_1(){
    var rebootCommand = 2;
    var tsMsgSendOid = '1.3.6.1.4.1.9.2.9.9.0'; // Integer
    // The callback functions to determine success or failure of the snmp set call 
    function setCallback(output, error){
        if (error || output[tsMsgSendOid].error){
            console.error("Received an error during the SNMP Set ", error || output[sysUptimeOid].error);
            D.failure(D.errorType.GENERIC_ERROR);
        } else {
            D.success();
        }
    };
    // Creating the SNMP session
    var snmpSession = D.device.createSNMPSession();
    // Executing the snmp set reboot command
    snmpSession.set(tsMsgSendOid, rebootCommand, setCallback);
}