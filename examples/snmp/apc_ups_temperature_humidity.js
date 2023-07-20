/**
 * This script can monitor the UPS Temperatury and Humidity.
 * Communication protocol is SNMP V2
 * Creates a table with the following columns:
 *      - Probe Index: The index of the prob
 *      - Room Temperature: The current temperature reading from the probe
 *      - Room Humidity: The current humidity reading from the probe in percent
 */

var iemStatusProbesTableOID = "1.3.6.1.4.1.318.1.1.10.2.3.2";
var probeIndexOID = "1.3.6.1.4.1.318.1.1.10.2.3.2.1.1.1";
var probeTempOID = "1.3.6.1.4.1.318.1.1.10.2.3.2.1.4.1";
var probeTempUnitsOID = "1.3.6.1.4.1.318.1.1.10.2.3.2.1.5.1";
var probeHumidityOID = "1.3.6.1.4.1.318.1.1.10.2.3.2.1.6.1";

function validateAndGetData() {
    var d = D.q.defer();
    D.device.createSNMPSession().walk(iemStatusProbesTableOID, function(out, err) {
        if (err) {
            console.error(err);
            d.failure(D.errorType.GENERIC_ERROR);
        } else if (!out) {
            d.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else {
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
        .then(function(){
            D.success();
        })
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
            var probeNumber = out[probeIndexOID];
            var recordId = D.crypto.hash(probeNumber, "sha256", null, "hex").slice(0, 50);
            var iemStatusProbeNumber = "probe_" + probeNumber;
            var iemStatusProbeCurrentTemp = out[probeTempOID];
            var iemStatusProbeTempUnits = out[probeTempUnitsOID];
            var iemStatusProbeCurrentHumid = out[probeHumidityOID];
            var unitTemp;
            if (iemStatusProbeTempUnits == 2) {
                unitTemp = "F";
            } else {
                unitTemp = "C";
            }
            var table = D.createTable("UPS Temperature and Humidity", [
                {label: "Probe Index"},
                {label: "Room Temperature", unit: unitTemp},
                {label: "Room Humidity", unit: "%"}
            ]);
            table.insertRecord(recordId, [iemStatusProbeNumber, iemStatusProbeCurrentTemp, iemStatusProbeCurrentHumid]);
            D.success(table);
        }).catch(function(err) {
            console.error("Walk error for OID", err);
            D.failure(D.errorType.PARSING_ERROR);       
        });
}