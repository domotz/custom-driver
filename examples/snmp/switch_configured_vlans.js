/**
 * Name: Switch Configured VLANs
 * Description: This script show a list of the configured VLANs on a Switch
 * 
 * Communication protocol is SNMP 
 * 
 * Creates a custom driver variable section with:
 *    - VLAN ID
 *    - VLAN NAME
 * 
 * Tested under EdgeSwitch 24 Lite version 1.9.3
 * 
 */

//Get VLAN names and ids
var dot1qVlanStaticName = "1.3.6.1.2.1.17.7.1.4.3.1.1";
                    
function validateAndGetData() {
    var d = D.q.defer();
    D.device.createSNMPSession().walk(dot1qVlanStaticName, function(out, err) {
        if (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        } else if (!out) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }  else {
            d.resolve(out);
        }
    });
    return d.promise;
}

/**
 * @remote_procedure
 * @label Host Device supports VLANs
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
* @label Get Vlan List
* @documentation This procedure collects VLAN information
*/
function get_status() {
    validateAndGetData()
        .then(function(out) {
            var vlanID, vlanName;
            variables = [];
            for (var key in out) {
                var parts = key.split(".");
                vlanID = parts[parts.length - 1];
                vlanName = out[key] || "-";
                variables.push(D.createVariable(vlanID, "Vlan " + vlanID , "", vlanName));
            }
            D.success(variables);
        })
        .catch(function(err) {
            console.error("Walk error for OID", err);
            D.failure(D.errorType.PARSING_ERROR);
        });
}