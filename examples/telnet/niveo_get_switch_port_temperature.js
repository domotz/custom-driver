/**
 * This Driver Extracts temperature readings for the ports of a Niveo Switch 
 * Communication protocol is Telnet with negotiation.
 * Creates multiple custom driver variables for each of the switch's ports.
 */

/**
 * The Telnet Command Options
 * @property {bool}   [negotiationMandatory] - Needs to be 'true' if the telnet session requires login
 * @property {int}    [timeout]              - The command wait time in miliseconds.
 * @property {string} [shellPrompt]          - The expected shell prompt regular expression for the telnet session
 * @property {string} [loginPrompt]          - The expected username prompt regular expression for the telnet session
 * @property {string} [passwordPrompt]       - The expected password prompt regular expression for the telnet session
*/
var telnetOptions = {
    timeout: 5000,
    negotiationMandatory: true,
    shellPrompt: ':/>',
    loginPrompt: 'Username:',
    passwordPrompt: 'Password:',
    // Carriage return is needed to indicate the prompt inputs are entered
    username: D.device.username() + "\r",
    password: D.device.password() + "\r",
}

/**
* Used to check if the authentication has not been successful basd on the output string.
*/
function validateLoggedIn(output) {
    var loginInProgress = "Login in progress";
    var welcomeMessage = "Welcome to";
    if (output && output.indexOf(loginInProgress) !== -1 && output.indexOf(welcomeMessage) === -1) {
        D.failure(D.errorType.AUTHENTICATION_ERROR)
    };
};


/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    function validationCallback(output, error) {
        validateLoggedIn(output);
        if (output && output.indexOf("chip temperature") === -1) {
            D.failure(D.errorType.PARSING_ERROR);
        } else {
            D.success();
        };
    };
    telnetOptions.command = "thermal status ?";
    D.device.sendTelnetCommand(telnetOptions, validationCallback);
};

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure collects the port temperature readings and sends them to the domotz cloud as custom driver variables
*/
function get_status() {
    var indexUID = 1;
    var indexValue = 2;
    var indexUnit = 3;
    var portTemperatureRegex = new RegExp('([\\d]+) +([\\d]+) +(C|F).*.*');
    function thermalStatusParserCallback(output, error) {
        validateLoggedIn(output)
        var variables = [];
        var lines = output.split('\n\r');
        lines.forEach(function (line) {
            var match = line.match(portTemperatureRegex);
            if (match) {
                var uid = match[indexUID];
                var portVariable = D.device.createVariable(
                    uid, "Port " + uid, match[indexValue], match[indexUnit]
                );
                variables.push(portVariable);
            };
        });
        D.success(variables);
    }
    telnetOptions.command = "thermal status";
    D.device.sendTelnetCommand(telnetOptions, thermalStatusParserCallback);
};