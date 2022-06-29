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
 * @requires module:async
 * @requires module:events
 * @requires module:ssh2
 * @requires module:q
 * @requires module:lodash
 * @requires module:network_tools/sshNode
 * @copyright Copyright (C) Domotz Inc
 */

/**
 * The SSH authentication algorithm parameters
 * @typedef  {Object} SshAlgorithms
 * @example {
    cipher: [
        'aes128-gcm',
        'aes128-gcm@openssh.com',
        'aes256-gcm',
        'aes256-gcm@openssh.com'
    ],
    kex: [
        'diffie-hellman-group-exchange-sha1',
        'diffie-hellman-group-exchange-sha256',
        'ecdh-sha2-nistp256',
        'ecdh-sha2-nistp384',
        'ecdh-sha2-nistp521'
    ]

}
 * @property {Array.<string>} kex               - A List of SSH key exchange methods to use
 * @property {Array.<string>} cipher            - A List of SSH ciphers to use
 */

/**
 * The SSH Library Options
 * @typedef  {Object} SshOptions
 * @property {string} command             - The ssh command to execute against the device
 * @property {int}    [timeout]           - The time to wait for the command execution
 * @property {string} [username]          - The device username. If not set the custom driver management purpose one is used
 * @property {string} [password]          - The device password. If not set the custom driver management purpose one is used
 * @property {SshAlgorithms} [algorithms] - The SSH Kex and Ciphers to use
 */

/**
 * The SSH Command Execution Result
 * @typedef  {callback} SshCallback
 * @property {string}      output    - The stdout from the SSH Command execution
 * @property {ErrorResult} [error]   - Will be present if the execution resulted in an error
 */

/**
 * The SSH Shell Sequence Options
 * @typedef  {Object} SshShellSequenceOptions
 * @private
 * @property {Array.<string>} commands             - The ssh commands to execute against the device
 * @property {string} [username]                   - The device username. If not set the custom driver management purpose one is used
 * @property {string} [password]                   - The device password. If not set the custom driver management purpose one is used
 * @property {string} [prompt=#]                   - The device ssh prompt expected. If not set correctly it may result in a timeout
 * @property {string} [prompt_regex]               - The device ssh prompt regular expression expected. Used if a device prompt changes during ssh sequence execution
 * @property {string} [error_prompt]               - The device error prompt expected. Used when there is an expected error prompt string to halt the execution
 * @property {int} [inter_command_timeout_ms=1000] - Timeout to wait between ssh sequence commands executions
 * @property {int} [global_timeout_ms=30000]       - The global ssh shell sequence execution timeout. When expired results in TIMEOUT_ERROR
 * @property {SshAlgorithms} [algorithms]          - The SSH Kex and Ciphers to use
 */

/**
 * The SSH Shell Sequence callback
 * @typedef  {callback} SshShellSequenceCallback
 * @private
 * @property {Array.<string>} outputs   - The output list of the SSH Commands executions
 * @property {ErrorResult}    [error]   - Will be present if the execution resulted in an error
 */
var async = require('async');
var events = require('events');
var ssh2 = require('ssh2');
var q = require('q');
var lodash = require('lodash');

var sandboxConsole;

/**
 * SSH Library Resource Locator object 
 * @private
 * @readonly
 */
var sandboxResourceLocator = {
	log: {
		decorateLogs: function () {
			return sandboxConsole;
		}
	},
	ssh2: ssh2,
	q: q,
	async: async,
	lodash: lodash,
	events: events,
};

/**
 * Sends a sequence of SSH commands
 * @function
 * @private
 * @readonly
 * @param {Object} myConsole                   - The Domotz Sandbox console
 * @param {SshShellSequenceOptions} options    - The SSH Commands execution options
*/
function sendSSHShellSequence(options, callback) {
	sandboxConsole = console;
	function outputTransformer(result) {
		var error = result.error;
		var outputs = [];
		if (result.output) {
			result.output.forEach(function (item) {
				outputs.push(Buffer(item, 'base64').toString());
			});
		}
		callback(outputs, error);
	}
	var sshNode = require('./sshNode').factory(sandboxResourceLocator);
	return sshNode.sshShellSequence(options, outputTransformer);
}
/**
 * Sends an SSH command
 * @function
 * @private
 * @readonly
 * @param {Object} myConsole      - The Domotz Sandbox console
 * @param {SshOptions} options    - The SSH Command execution options
*/
function sendSSHCommand(options, callback) {
	sandboxConsole = console;
	var command = options.command;
	if (options.command) {
		delete options.command;
	} else {
		throw Error('D.sendSSHCommand requires a \'command\' in its options parameter');
	}
	var sshNode = require('./sshNode').factory(sandboxResourceLocator);
	var promise = sshNode.exec(command, options, '');
	return promise.then(function (stdout) {
		callback(stdout, null);
	}).catch(function (stderr) {
		sandboxConsole.error('SSH Command execution Error: ' + JSON.stringify(stderr));
		callback(null, stderr);
	});
}

module.exports.sendSSHCommand = sendSSHCommand;
module.exports.sendSSHShellSequence = sendSSHShellSequence;
