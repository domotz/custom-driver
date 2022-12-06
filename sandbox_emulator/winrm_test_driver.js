/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    D.success();
}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    var variables = [];

    D.winrmTest("hostname").then(function (res){
        console.log("RES: %s", res);

        var variable = D.device.createVariable(
            "atable",
            "label",
            res,
            "string"
        );
        variables.push(variable);
        D.success(variables);
    });
}