
var dockerInfoCmd = "docker info --format '{{json .}}'";
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 10000,
    command: dockerInfoCmd
};

function getDockerInfo(){
    var d = D.q.defer();

    D.device.sendSSHCommand(sshConfig, function (out, err) {
        if(err){
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(JSON.parse(out));
        
    });

    return d.promise;
}

function createDockerInfoVariables(json){
    console.log(json);
    var vars = [];
    return vars;
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    getDockerInfo()
        .then(function() {
            D.success();
        });
}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    getDockerInfo;
}