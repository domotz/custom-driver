/** 
 * Domotz Custom Driver 
 * Name: macOS Services Monitoring
 * Description: Monitors the status of services on a Macintoch machine
 *   
 * Communication protocol is SSH
 * 
 * Tested on macOS Version 14.5
 * 
 * Requires:
 *    - PLEASE NOTE: it requires to be run as a user from the sudoers group with the following settings: integration-script ALL=(ALL) NOPASSWD: ALL
 *
 * Creates a Custom Driver table with a list of services and their status.
 *
**/

// Filter for services to include in the command
var servicesFilter  = D.getParameter('sevrices')

// Command to list all services using launchctl
var command = "sudo launchctl list"

if (servicesFilter.length > 0) {
	var services = servicesFilter.join("\|")
	command += " | grep -E '" + services + "'"
}

// SSH options when running the commands
var sshConfig = {
	username: D.device.username(),
	password: D.device.password(),
	timeout: 10000
}

// Map of signal numbers to their descriptive names
var signalMap = {
	'0': 'SIGNULL',
	'1': 'SIGHUP',
	'2': 'SIGINT',
	'3': 'SIGQUIT',
	'4': 'SIGILL',
	'5': 'SIGPOLL',
	'6': 'SIGABRT',
	'7': 'SIGSTOP',
	'8': 'SIGFPE',
	'9': 'SIGKILL',
	'10': 'SIGBUS',
	'11': 'SIGSEGV',
	'12': 'SIGSYS',
	'13': 'SIGPIPE',
	'14': 'SIGALRM',
	'15': 'SIGTERM',
	'16': 'SIGUSR1',
	'17': 'SIGUSR2',
	'18': 'SIGABND',
	'19': 'SIGCONT',
	'20': 'SIGCHLD',
	'21': 'SIGTTIN',
	'22': 'SIGTTOU',
	'23': 'SIGIO',
	'24': 'SIGQUIT',
	'25': 'SIGTSTP',
	'26': 'SIGTRAP',
	'27': 'SIGIOERR',
	'28': 'SIGWINCH',
	'29': 'SIGXCPU',
	'30': 'SIGXFSZ',
	'31': 'SIGVTALRM',
	'32': 'SIGPROF',
	'37': 'SIGTRACE',
	'38': 'SIGDCE',
	'39': 'SIGDUMP'
}

var table = D.createTable(
	"Services List",
	[
		{ label: "Name", valueType: D.valueType.STRING},
		{ label: "Status", valueType: D.valueType.STRING}
	]
)

/**
 * Checks SSH command errors and handles them appropriately
 * @param {Error} err The error object from the SSH command execution
 */
function checkSshError (err) {
  if(err.message) console.error(err.message)
  if(err.code == 5){
    D.failure(D.errorType.AUTHENTICATION_ERROR)
  } else if (err.code == 255 || err.code == 1) {
    D.failure(D.errorType.RESOURCE_UNAVAILABLE)
  } else {
    console.error(err)
    D.failure(D.errorType.GENERIC_ERROR)
  }
}

/**
 * Executes an SSH command using the provided configuration
 * @param {string} command The SSH command to execute
 * @returns {Promise} A promise that resolves with the command output or rejects with an error
 */
function executeCommand (command){
	var d = D.q.defer()
	sshConfig.command = command
	D.device.sendSSHCommand(sshConfig, function (out, err) {
		if (err) {
			checkSsherr(err)
			d.reject(err)
		} else {
			d.resolve(out)
		}
	})
	return d.promise
}

/**
 * @remote_procedure
 * @label Validate SSH connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate () {
  executeCommand(command)
    .then(parseValidateOutput)
    .catch(function (err) {
      console.error(err)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}

function parseValidateOutput (output) {
  if (output && typeof output === 'string' && output.trim() !== '') {
    console.log('Validation successful')
    D.success()
  } else {
    console.error('Output is empty or undefined')
    D.failure(D.errorType.PARSING_ERROR)
  }
}
 
/**
* @remote_procedure
* @label Get the selected services data
* @documentation This procedure retrieves data for the selected services
*/
function get_status() {
	executeCommand(command)
		.then(parseOutput)
		.catch(checkSshError)
}

/**
 * Parses the output of the executed command to extract service information.
 * @param {string} output  The output of the executed command.
 */
function parseOutput(output) {
	if (output) {
		var lines = output.trim().split('\n')
		var parsedOutput = []
		lines.forEach(function(line) {
			line = line.trim()
			if (line === '') return
			var parts = line.split(/\s+/)
			var pid = parts[0]
			var status = parts[1]
			var label = parts.slice(2).join(' ')
			if (status === "0") {
				status = (pid === "-") ? "Not Running" : "Running"
			} else if (signalMap[status]) {
				status = "Terminated (" + signalMap[status] + ")"
			} else if (status.startsWith("-")) {
				var signalNumber = status.substring(1)
				status = signalMap[signalNumber] ? "Terminated (" + signalMap[signalNumber] + ")" : "Terminated (Unknown Signal " + signalNumber + ")"
			} else if (status === "255" || status === "78") {
				status = "Exited with error"
			} else {
				status = "Unknown"
			}
			var parsedLine = {
				PID: pid,
				Label: label,
				Status: status
			}
			parsedOutput.push(parsedLine)
		})
		populateTable(parsedOutput)
	} else {
		console.error('No data found')
		D.failure(D.errorType.PARSING_ERROR)
	}
}

function sanitize (output) {
	var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
	var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
	return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}

/**
 * Populates the table with retrieved data
 * @param {Array} services An array of service objects to be inserted into the table
 */
function populateTable (services) {
	services.forEach(function(service) {
		var recordId = sanitize(service.Label)
		var status = service.Status
		var name = service.Label
		table.insertRecord(recordId, [
			name.replace("com.apple.", ""),
			status || 'N/A'
		])
	})
	D.success(table)
}