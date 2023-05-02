/**
 * Domotz Custom Driver 
 * Name: Windows Security events monitoring
 * Description: monitors the instances of Windows security events, some events are only raised if the related audit setting is enabled.
 *    
 * More info   
 *  - https://learn.microsoft.com/en-us/windows/security/threat-protection/auditing/advanced-security-auditing-faq
 *  
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Microsoft Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates a Custom Driver Table with event IDs, Description, Instances count for the choosen period of time
 * 
 * Required permissions: 
 *  - Read permissions on HKLM\System\CurrentControlSet\Services\eventlog\Security
 *  - Must be a member of Built-in group "Event Log Readers"
 * 
**/

/**
 * Number of hours to set a time-window starting from present
 * @var number hours 
 **/
 var hours = 1;

 // Define the WinRM options when running the commands
 var winrmConfig = {
     "command": "",
     "username": D.device.username(),
     "password": D.device.password()
 };
 
 /**
  * Events to monitor
  * @var object auditedEvents
  **/
 var auditedEvents = {
     4720: "A user account was created.",
     4722: "A user account was enabled.",
     4731: "A security-enabled local group was created.",
     4732: "A member was added to a security-enabled local group.",
     4649: "A replay attack was detected.",
     4741: "A computer account was created.",
     4625: "An account failed to log on.",
     4817: "Auditing settings on object were changed.",
     4947: "A change has been made to Windows Firewall exception list. A rule was modified.",
     4948: "A change has been made to Windows Firewall exception list. A rule was deleted."
 };
 
 var idArray = Object.keys(auditedEvents);
 
 var eventTable = D.createTable(
     "Security events ",
     [
         { label: "Description" },
         { label: "last " + hours + " hour(s) instances" }
     ]
 );
 
 // Check for Errors on the WinRM command response
 function checkWinRmError(err) {
     if (err.message) console.error(err.message);
     if (err.code == 401) D.failure(D.errorType.AUTHENTICATION_ERROR);
     if (err.code == 404) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
     console.error(err);
     D.failure(D.errorType.GENERIC_ERROR);
 }
 
 /**
 * @remote_procedure
 * @label Validate WinRM is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
 function validate() {
     winrmConfig.command = "Get-winevent -Logname \"Security\" -Maxevents 1;";
     D.device.sendWinRMCommand(winrmConfig, function (output) {
         if (output.error === null) {
             D.success();
         } else {
             checkWinRmError(output.error);
         }
     });
 }
 
 /**
  * @remote_procedure
  * @label Get Windows Security Events Instances
  * @documentation This procedure Retrieves the instances count of selected Windows security events in the last hour.
  */
 function get_status() {
     winrmConfig.command = "$Hours=" + hours + ";$events=Get-WinEvent -FilterHashTable @{LogName=\"Security\";ID=" + idArray + ";StartTime=((Get-Date).AddHours(-($Hours)).Date);EndTime=(Get-Date)} -ErrorAction SilentlyContinue |group id|select name,count;if ($events){$events | ConvertTo-Json} else {@{name=\"\";count=\"0\"}|ConvertTo-Json};";
     D.device.sendWinRMCommand(winrmConfig, parseOutput);
 }
 
 // Parses the output of the WinRM command and fills the eventTable with the retrieved events.
 function parseOutput(output) {
     if (output.error === null) {
         var k = 0;
         var eventId;
         var count;
         var eventsInOutput = [];
         var jsonOutput = JSON.parse(JSON.stringify(output));
         jsonOutput = JSON.parse(jsonOutput.outcome.stdout);
         if (Array.isArray(jsonOutput)) {
             while (k < jsonOutput.length) {
                 eventId = jsonOutput[k].Name;
                 count = jsonOutput[k].Count;
                 //eventTable.insertRecord(eventId, [auditedEvents[eventId], count]);
                 eventsInOutput.push(eventId);
                 k++;
             }
         } else {
             eventId = jsonOutput.Name;
             if (eventId) {
                 eventTable.insertRecord(eventId, [audited, count]);
                 eventsInOutput.push(jsonOutput.Name);
             }
         }
         // events with no instances will appear in the table with a 0 value
         for (var key in auditedEvents) {
             if (eventsInOutput.indexOf(key) === -1) {
                 eventTable.insertRecord(key, [auditedEvents[key], 0]);
             }
         }
         D.success(eventTable);
     } else {
         console.error(output.error);
         D.failure();
     }
 }