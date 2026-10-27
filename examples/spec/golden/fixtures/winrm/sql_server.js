// Simulated Windows Server 2022 / SQL Server 2022 / PowerShell 5.1 replies. Shape follows the default console output
// of the three commands the driver runs: `Get-Service 'MSSQLSERVER' | Select-Object Status` (a one-column table:
// Status header, dashes, "Running"), `$Connection.State` (the SqlConnection state name, "Open") and
// `Invoke-Sqlcmd -Query "SELECT GETDATE() AS TimeOfQuery"` (a DataRow table: TimeOfQuery header, dashes, the
// en-US date time). validate only checks the service.
const reply = require("../../replies");

const SERVICE_STATUS = "Get-Service 'MSSQLSERVER' | Select-Object Status";
const TEST_CONNECTION = '$Connection = New-Object System.Data.SqlClient.SqlConnection("Server=localhost;Database=master;User ID=user;Password=pass;Integrated Security=true;"); $Connection.Open(); $Connection.State;';
const SQL_QUERY = 'Invoke-Sqlcmd -Query "SELECT GETDATE() AS TimeOfQuery" -ServerInstance "localhost"';

const STATUS_OUTPUT = ["", "Status", "------", "Running", "", ""].join("\r\n");
const STATE_OUTPUT = "Open\r\n";
const QUERY_OUTPUT = ["", "TimeOfQuery", "-----------", "1/15/2026 10:00:03 AM", "", ""].join("\r\n");

const winrm = (target, stdout) => ({ kind: "winrm", method: "sendWinRMCommand", target, reply: reply.winrm(stdout) });

module.exports = {
    cases: [{
        name: "sql server running, connection open",
        parameters: { databaseName: "master" },
        entryPoints: {
            validate: { calls: [winrm(SERVICE_STATUS, STATUS_OUTPUT)] },
            get_status: { calls: [winrm(SERVICE_STATUS, STATUS_OUTPUT), winrm(TEST_CONNECTION, STATE_OUTPUT), winrm(SQL_QUERY, QUERY_OUTPUT)] }
        }
    }]
};
