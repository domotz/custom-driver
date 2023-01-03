/**
 * This driver collects and displays various data using SNMP OiDs in an GPS Antenna. It is used to re-format numerical 
 * values to geo coordinates (longitude/latitude - headning degrees, etc.).  
 */

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate(){
    // if SysDescr is available
    var tsMsgSendOid = "1.3.6.1.2.1.1.1.0";
    function getCallback(output, error){
        if (error || output[tsMsgSendOid].error){
            console.error("Received an error during the SNMP Get ", error || output[tsMsgSendOid].error);
            D.failure(D.errorType.PARSING_ERROR);
        } else {
            D.success();
        }
    }
    // Creating the SNMP session
    var snmpSession = D.device.createSNMPSession();
    // Executing an SNMP get towards set status needed OID
    snmpSession.get([tsMsgSendOid], getCallback);
}  

function get_status(){
    // add math funct
    function round(value, precision) {
        var multiplier = Math.pow(10, precision || 0);
        return Math.round(value * multiplier) / multiplier;
    }
    var variables = [];
    var antennaStatusOid= "1.3.6.1.4.1.33721.3.2.2.1.7090.2.15.0";
    // Define here all the Oids that you want to re-format
    var headingOid = "1.3.6.1.4.1.33721.3.1.3.3.1.4.0"; 
    var latitudeOid = "1.3.6.1.4.1.33721.3.1.3.1.1.2.0"; 
    var longitudeOid = "1.3.6.1.4.1.33721.3.1.3.1.1.3.0";
    function getCallback(output, error){
        if (error || output[latitudeOid].error || output[longitudeOid].error || output[antennaStatusOid].error || output[headingOid].error){
            console.error("Received an error during the SNMP Get ", error || output[latitudeOid].error || output[longitudeOid].error || output[antennaStatusOid].error || output[headingOid].error);
            D.failure(D.errorType.PARSING_ERROR);
        } else {
            // Getting unformatted values
            var antennaStatusRaw =  output[antennaStatusOid];
            var headingRaw= output[headingOid];
            var latitudeDefault = output[latitudeOid]; // getting raw value for Latitude
            var longitudeDefault = output[longitudeOid];

            // These have to be recalculated: do we have an Oid for Cardinal Points? or instead the raw value is signed?
            // in case of signed -3723132 means 37°23" S - and -1323123 means 13°23" O?
            // The following are just set to N and E since we do not know how to calculate them
            var cardinalNorS= "N";
            var cardinalEorO= "E";     
            // Formatting raw values
            if (antennaStatusRaw == 1) antennaStatus = D.device.createVariable("1", "Antenna Status", "Active", " ");
            if (antennaStatusRaw == 0) antennaStatus = D.device.createVariable("1", "Antenna Status", "Idle", " ");
            var headingFormatted = round((headingRaw / 1000), 1) + "°";
            var latitudeFormatted = latitudeDefault.slice(0,2) + "° " + latitudeDefault.slice(3,5)+ "\"";
            var longitudeFormatted = longitudeDefault.slice(0,2) + "° " + longitudeDefault.slice(3,5)+ "\"";

            // Creating variables to be pushed 
            var latitude = D.device.createVariable("2", "Latitude", latitudeFormatted, cardinalNorS);
            var longitude = D.device.createVariable("3", "Longitude", longitudeFormatted, cardinalEorO);
            var heading = D.device.createVariable("4", "Heading", headingFormatted, " ");
            
            // Pushing the variables in the list to be displayed
            variables.push(antennaStatus);
            variables.push(latitude);
            variables.push(longitude);
            variables.push(heading);
            D.success(variables);
        }
    }
    // Creating the SNMP session
    var snmpSession = D.device.createSNMPSession();
    // Executing an SNMP get towards the OIDs 
    snmpSession.get([latitudeOid,longitudeOid,antennaStatusOid,headingOid], getCallback);
}