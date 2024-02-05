/**
 * Domotz Custom Driver 
 * Name: HPE MSA SAN Overall Unit Status
 * Description: 
 * 
 * Communication protocol is ssh 
 *
 * Creates a Custom Driver table 
 * 
 */

var command = "show sensor-status";

var sshCommandOptions = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 5000
};

function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function executeCommand() {
    var d = D.q.defer(); 
    sshCommandOptions.command = command;
    D.device.sendSSHCommand(sshCommandOptions, function (output, error) {
        if (error) {
            checkSshError(error);
            d.reject(error);
        } else {  
            if (output.indexOf("The command is missing at least one parameter") !== -1 || output.indexOf("The command was not recognized") !== -1) {
                console.error("The command was not recognized");
                D.failure(D.errorType.PARSING_ERROR);
            } else {
                d.resolve(output);       
            }         
        }
    });
    return d.promise;
}

var table = D.createTable(
    "Overall Unit Status",
    [
        { label: "Value", valueType: D.valueType.STRING},
        { label: "Status", valueType: D.valueType.STRING}   
    ]
);

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

function parseData(output) {
    var sensors = output.match(/<OBJECT basetype="sensors" name="sensor" oid="\d+" format="rows">([\s\S]*?)<\/OBJECT>/g);
    var overallSensors = sensors.filter(function(sensor) { 
        return sensor.match(/<PROPERTY name="sensor-name".*?>Overall Unit Status/);
    });
    if (overallSensors.length === 0) {
        console.log("Overall Unit Status sensors not found");        
        D.failure(D.errorType.PARSING_ERROR);
    }

    for(i = 0; i < overallSensors.length; i++){
        var sensorNameMatch = overallSensors[i].match(/<PROPERTY\s+name="sensor-name"\s+[^>]*>(.*?)<\/PROPERTY>/);
        var valueMatch = overallSensors[i].match(/<PROPERTY\s+name="value"\s+[^>]*>(.*?)<\/PROPERTY>/);
        var statusMatch = overallSensors[i].match(/<PROPERTY\s+name="status"\s+[^>]*>(.*?)<\/PROPERTY>/);
        var sensorName = sensorNameMatch ? sensorNameMatch[1] : "";
        var value = valueMatch ? valueMatch[1] : "";
        var status = statusMatch ? statusMatch[1] : "";
        var recordId = sanitize(sensorName);
        table.insertRecord(recordId, [
            value,
            status
        ]);
    }
    D.success(table);
}

function validate() {
    executeCommand()
        .then(function (){
            D.success();
        })
        .catch(checkSshError);
}

function get_status() {
    executeCommand()
        .then(parseData)
        .then(checkSshError);
}