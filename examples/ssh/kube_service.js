
var getPodsCommand = "kubectl get service -o json";
var params = {
    username: D.device.username(),
    password: D.device.password(),
    port: 22,
    timeout: 5000,
};



function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function executeCommand(command) {
    params.command = command;
    var d = D.q.defer();
    D.device.sendSSHCommand(params, function (out, err) {
        if (err) checkSshError(err);
        d.resolve(out);
    });
    return d.promise;
}

function toObject(jsonString) {
    return JSON.parse(jsonString);
}

function createTableResult(result) {
    var table = D.createTable("Pods", [
        { label: "Ready" },
        { label: "Status" },
        { label: "Start time" },
        { label: "Pod IP" }
    ]);
    result.items.forEach(function (r) {
        table.insertRecord(r.metadata.name,
            [
                r.status.containerStatuses.filter(function(cs){return cs.ready;}).length +"/"+ r.status.containerStatuses.length,
                r.status.phase,
                r.status.startTime,
                r.status.podIP
            ]
        );
    });
    return table;
}



/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    executeCommand(getPodsCommand)
        .then(function(){
            D.success();
        });
}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    executeCommand(getPodsCommand)
        .then(toObject)
        .then(createTableResult)
        .then(D.success)
        .catch(console.error);
}