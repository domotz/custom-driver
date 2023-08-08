/**
 * This script can monitor the UPS Temperatury and Humidity.
 * Communication protocol is SNMP V2
 * Creates a custom driver variable:
 *      - Probe Name: The descriptive name for the probe
 *      - Probe Temperature: The current temperature reading from the probe
 *      - Probe Humidity: The current humidity reading from the probe in percent
 * 
 * Tested under APC Smart-UPS X 3000 version 6.8.2
 */
    
var iemStatusProbesTableOID = "1.3.6.1.4.1.318.1.1.10.2.3.2";
var probNameOID = "1.3.6.1.4.1.318.1.1.10.2.3.2.1.2.1";
var probeTempOID = "1.3.6.1.4.1.318.1.1.10.2.3.2.1.4.1";
var probeTempUnitsOID = "1.3.6.1.4.1.318.1.1.10.2.3.2.1.5.1";
var probeHumidityOID = "1.3.6.1.4.1.318.1.1.10.2.3.2.1.6.1";

function validateAndGetData() {
    var d = D.q.defer();
    D.device.createSNMPSession().walk(iemStatusProbesTableOID, function(out, err) {
        if (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        } else if (!out) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (!(probNameOID in out) || !(probeTempOID in out) || !(probeTempUnitsOID in out) || !(probeHumidityOID in out)) {
            console.error("Missing necessary OID valuvares in SNMP response");
            D.failure(D.errorType.PARSING_ERROR);
        }  else {
            d.resolve(out);
        }
    });
    return d.promise;
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate(){
    validateAndGetData()
        .then(D.success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}  

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure collects UPS Temperatury and Humidity values and sets it in a table
*/
function get_status() {
    validateAndGetData()
        .then(function(out) {
            var variables = [];
            var iemStatusProbeTempUnits = out[probeTempUnitsOID];
            var unitTemp;
            if (iemStatusProbeTempUnits == 2) {
                unitTemp = "F";
            } else {
                unitTemp = "C";
            }
            var iemStatusProbeName = D.device.createVariable("probe_name", "Probe Name", out[probNameOID]);
            var iemStatusProbeCurrentTemp = D.device.createVariable("probe_temperature", "Probe Temperature", out[probeTempOID], unitTemp);
            var iemStatusProbeCurrentHumid = D.device.createVariable("probe_humidity", "Probe Humidity", out[probeHumidityOID], "%");
            variables.push(iemStatusProbeName);
            variables.push(iemStatusProbeCurrentTemp);
            variables.push(iemStatusProbeCurrentHumid);
            D.success(variables);
        }).catch(function(err) {
            console.error("Walk error for OID", err);
            D.failure(D.errorType.PARSING_ERROR);       
        });
}
