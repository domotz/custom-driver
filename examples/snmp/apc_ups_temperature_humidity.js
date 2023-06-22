/**
 * This Driver can monitor the UPS Temperatury and Humidity and stores it in a custom driver table.
 * Communication protocol is SNMP
 * Creates a Custom Driver Table with the following columns:
 *      - Probe Index: The index of the prob
 *      - Room Temperature: The current temperature reading from the probe
 *      - Room Humidity: The current humidity reading from the probe in percent
 */



/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate(){
    var iemStatusProbesTable = "1.3.6.1.4.1.318.1.1.10.2.3.2"; //A list of probes supported by the Environmental Monitor and their status
    function getCallback(output, error){
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } else {
            D.success();
        }
    }
    var snmpSession = D.device.createSNMPSession();
    snmpSession.walk(iemStatusProbesTable, getCallback);
}  

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure collects UPS Temperatury and Humidity values and sets it in a custom driver table
*/
function get_status() {
    var iemStatusProbesTable = "1.3.6.1.4.1.318.1.1.10.2.3.2";
    function getCallback(output, error) {
        if (error) {
            console.error("Walk error for oid", error);
            D.failure(D.errorType.PARSING_ERROR);
        } else {
            var probes = output;
            var recordId = probes["1.3.6.1.4.1.318.1.1.10.2.3.2.1.1.1"];
            var iemStatusProbeNumber = "probe_" + recordId;
            var iemStatusProbeCurrentTemp = probes["1.3.6.1.4.1.318.1.1.10.2.3.2.1.4.1"];  
            var iemStatusProbeTempUnits = probes["1.3.6.1.4.1.318.1.1.10.2.3.2.1.5.1"];
            var iemStatusProbeCurrentHumid = probes["1.3.6.1.4.1.318.1.1.10.2.3.2.1.6.1"];
            var unitTemp;
            if (iemStatusProbeTempUnits == 2) {
                unitTemp = "F"; 
            } else {
                unitTemp = "C";
            }
            var table = D.createTable("UPS Temperatury and Humidity", 
                [
                    {label: "Probe Index"},
                    {label: "Room Temperature", unit: unitTemp},
                    {label: "Room Humidity", unit: "%"}
                ]
            );
            table.insertRecord(recordId, [iemStatusProbeNumber, iemStatusProbeCurrentTemp, iemStatusProbeCurrentHumid]);
            D.success(table);
        }
    }
    var snmpSession = D.device.createSNMPSession();
    snmpSession.walk(iemStatusProbesTable, getCallback);
}