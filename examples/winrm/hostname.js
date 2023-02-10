/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate(){
    D.device.sendWinRMCommand({command:"Test-WSMan"}, callback_validate);
} 

function callback_validate(output){
    if (output.error === null){
        D.success();
    } 
    console.error(output.error);
    D.failure();
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving the device's hostname via WinRM and saving it as a variable
*/
function get_status(){
    D.device.sendWinRMCommand({command:"hostname"}, callback_hostname);
}

function callback_hostname(output) {
    if (output.error === null){
        var variables = [
            D.createVariable("hostnameuid", "hostname", extract_stdout(output))
        ];
        D.success(variables);
    } 
    console.error(output.error);
    D.failure();
}

function extract_stdout(output){
    console.debug("Parsing: %s", JSON.stringify(output));
    return output.outcome.stdout;
}
