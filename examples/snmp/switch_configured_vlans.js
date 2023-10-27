/**
 * Name: Switch Configured VLAN List
 * Description: This script retrieves the list of configured VLANs from a switch and stores it in a variable
 * 
 * Communication protocol is SNMP 
 * 
 * Creates a custom driver variable to store the VLAN list.
 * 
 * Tested on:
 *   - Cisco CBS 350 - 28 Port  
 *   - Ubiquiti EdgeSwitch 24 Lite version 1.9.3
 *   - HP Aruba ProCurve 2530-24G
 * 
 */

//Get VLAN ids
var dot1qVlanStaticName = "1.3.6.1.2.1.17.7.1.4.3.1.1";

function validateAndGetData() {
    var d = D.q.defer();
    D.device.createSNMPSession().walk(dot1qVlanStaticName, function(out, err) {
        if (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        } else if (!out) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else {
            d.resolve(out);
        }
    });
    return d.promise;
}

/**
 * @remote_procedure
 * @label Checks if the device supports VLANs
 * @documentation This procedure is used to validate if the device supports VLANs
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
* @label Gets Vlan List
* @documentation This procedure collects VLAN information and stores it in a variable.
*/
function get_status() {
    validateAndGetData()
        .then(function(out) {
            var vlanList = [];
            for (var key in out) {
                var parts = key.split(".");
                var vlanID = parts[parts.length - 1];
                var vlans = "VLAN" + vlanID;
                vlanList.push(vlans);
            }
            var variables = [D.createVariable("vlans", "VLANs", vlanList.join(" | "))];
            D.success(variables);
        })
        .catch(function(err) {
            console.error("Walk error for OID", err);
            D.failure(D.errorType.PARSING_ERROR);
        });
}