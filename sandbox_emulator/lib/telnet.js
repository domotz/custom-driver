/**
 * This file is part of Domotz Agent.
 *
 * @license
 * Domotz Agent is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Domotz Agent is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Domotz Agent.  If not, see <http://www.gnu.org/licenses/>.
 *
 * @copyright Copyright (C) Domotz Inc
 */

/**
 * The Telnet library Options
 * @typedef  {Object}  TelnetOptions
 * @property {string}  command                         - The telnet command to execute against the device
 * @property {int}     [port=23]                       - The telnet port to connect to
 * @property {int}     [timeout=500]                   - The time the telnet session will persist for (in milisenconds)
 * @property {boolean} [negotiationMandatory=false]    - Set this to true if the telnet session requires authentication
 * @property {string}  [shellPrompt=/(?:\/ )?#\s/]     - The expected shell prompt regular expression for the telnet session
 * @property {string}  [loginPrompt=/login[: ]*$/i]    - The expected username prompt regular expression for the telnet session
 * @property {string}  [passwordPrompt=/Password: /i]  - The expected password prompt regular expression for the telnet session
 */

/**
 * The Telnet library callback
 * @typedef  {callback} TelnetCallback
 * @property {string}      output   - The Result from the telnet command execution
 * @property {ErrorResult} [error]  - Will be present if the execution resulted in an error
 */
var telnetClient = require('telnet-client');
var commandUtils = require('./command');
var sandboxConsole;

/**
 * Telnet Library Resource Locator object 
 * @private
 * @readonly
 */
var sandboxResourceLocator = {
	log: {
		decorateLogs: function () {
			return sandboxConsole;
		}
	},
	telnet: telnetClient,
	utils: {
		command: commandUtils
	}
};

/**
 * Sends a command via Telnet
 * @function
 * @private
 * @readonly
 * @param {TelnetOptions} options    - The Telnet Command execution options
*/
function sendTelnetCommand(options, callback) {

	sandboxConsole = console;
	var message = {
		payload: options
	};
	function outputTransformer(result) {
		var error = result.error;
		var output = result.response;
		callback(output, error);
	}
	var telnetSend = require('./telnetSend').command(message, sandboxResourceLocator);
	return telnetSend.execute(outputTransformer);
}

module.exports.sendTelnetCommand = sendTelnetCommand;
