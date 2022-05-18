var _var = D.device.createVariable;
var command = "mysqld --version; " +
              "service mysql status | head -3| tail -1|cut -d'(' -f 2 | cut -d')' -f 1; "+
              "pmap `cat /var/run/mysqld/mysqld.pid` | tail -1 |  awk '/[0-9]K/{print substr($2, 1, length($2)-1)}'"

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate(){
    D.device.sendSSHCommand(
        {
            command: command,  
            username: D.device.username(),
            password: D.device.password(),
            timeout: 10000
        },
        function(output, error) {
            if (error) {
                console.error(error)
                D.failure()
            }
            else {
              console.info(output)  
              report_success(output)
            }
        }
    )
} 

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status(){
     D.device.sendSSHCommand(
        {
            command: command,
            username: D.device.username(),
            password: D.device.password(),
            timeout: 10000
        },
        function(output, error) {
            if (error) {
                console.error(error)
                D.failure()
            }
            else {
                if (!isRunning(output)) {
                    D.device.sendSSHCommand(
                        {
                            command: "service mysql start",
                            username: D.device.username(),
                            password: D.device.password(),
                            timeout: 10000
                        }, function(){
                             if (error) {
                                console.error(error)
                                D.failure()
                            }else {
                                report_success(output)
                            }
                        })
                }
                else {
                    report_success(output);
                }
            }
        }
    )}

function report_success(output) {
    output = output.split("\n")
    D.success([
        _var("version", "Version", output[0]),
        _var("status", "Status", output[1]),
        _var("used_ram", "Used RAM", output[2])
    ])
}

function isRunning(output) {
    output = output.split("\n");
    return output[0] === "running";
}