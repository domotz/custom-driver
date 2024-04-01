/**
 * Domotz Custom Driver 
 * Name: SQLServer Status Monitoring
 * Description: This script is used to monitor the status of a SQL Server database to check if it is able to serve requests
 * 
 * Communication protocol is WinRM
 * 
 * Tested on Windows Version
 *  - Windows 11
 * 
 * Powershell Version:
 *  - 5.1.21996.1
 * 
 * Creates a Custom Driver Variable with the status of the SQLServer database
 * 
 * Privilege required: Administrator
 * 
**/

//The name of the SQL server instance
var serverName = D.getParameter('serverName');
//The name of the database
var databaseName = D.getParameter('databaseName');

// Commands to be executed
var serviceStatus = "Get-Service 'MSSQL$SQLEXPRESS' | Select-Object Status";
var testConnection = '$Connection = New-Object System.Data.SqlClient.SqlConnection("Server=' + serverName + ';Database=' + databaseName + ';Integrated Security=True;"); $Connection.Open(); $Connection.State';
var sqlQuery = 'Invoke-Sqlcmd -Query "SELECT GETDATE() AS TimeOfQuery" -ServerInstance "' + serverName + '"';

// Define the WinRM options when running the commands
var winrmConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "port": 35700
};

// Function to handle WinRM errors
function checkWinRmError(err) { 
    if (err.message) console.error(err.message);
    if (err.code == 401){
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (err.code == 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        console.error(err);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

// Function to execute WinRM command
function executeWinrmCommand(command) {
    var d = D.q.defer();
    winrmConfig.command = command;
    D.device.sendWinRMCommand(winrmConfig, function (output) {
        if (output.error === null) {
            d.resolve(output);
        } else {
            if (output.error){
                if (output.error.message.indexOf("Cannot find any service") !== -1){
                    console.error("Error getting service status");
                    D.failure(D.errorType.RESOURCE_UNAVAILABLE);
                } else {
                    checkWinRmError(output.error);
                }
            }  
        }            
    });
    return d.promise;
}

// Function to get SQL Server service status
function getServiceStatus(){
    return executeWinrmCommand(serviceStatus)
        .then(function (output) {
            if (output.error === null) {
                var serviceInfo = output.outcome.stdout.trim().split(/\r?\n/);
                var status = serviceInfo[2];
                if(status == "Running"){
                    console.log("SQL Server service is " + status);
                } else {
                    console.error("SQL Server service is " + status);
                    D.failure(D.errorType.RESOURCE_UNAVAILABLE);
                }
            } 
        });
}

// Function to test database connection
function testDatabaseConnection() {
    return (executeWinrmCommand(testConnection))
        .then(function (output) {
            if (output.error === null) {
                var connectionState = output.outcome.stdout.trim();
                if(connectionState == "Open"){
                    console.log("Database connection successful");
                } else {
                    console.error("Database connection failed: Connection " + connectionState);
                    D.failure(D.errorType.AUTHENTICATION_ERROR);
                }
            }
        });
}

// Function to execute SQL query
function executeSQLQuery (){
    return (executeWinrmCommand(sqlQuery))
        .then(function (output) {
            if (output.error === null) {
                var sqlServerStatus;
                var query = output.outcome.stdout.trim().split(/\r/);
                if(query.indexOf("TimeOfQuery")){
                    console.log("SQL query executin successful");
                    sqlServerStatus = "OK"; 
                } else {
                    sqlServerStatus = "NOT OK"; 
                    console.error("SQL query executin failed");
                }
                D.success([D.device.createVariable("server", "Status", sqlServerStatus, null, D.valueType.STRING)]);
            } 
        });
}

/**
 * @remote_procedure
 * @label Validate WinRM connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association and check if the SQLServer Srvice is running or encountring any issues.
 */
function validate() { 
    getServiceStatus()
        .then(D.success)
        .catch(checkWinRmError);
}

/**
 * @remote_procedure
 * @label Get SQLServer Database status 
 * @documentation This procedure retrieves the status of the SQLServer database to check if it is able to serve requests.
 */
function get_status() {
    getServiceStatus()
        .then(testDatabaseConnection)
        .then(executeSQLQuery)
        .catch(checkWinRmError);
}