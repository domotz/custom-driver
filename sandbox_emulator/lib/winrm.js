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
 * The WinRM Library Options
 * @typedef  {Object}  WinRMOptions
 * @property {string}  command                       - The winrm command to execute against the device
 * @property {string}  [username]                    - The device username. If not set the custom driver management purpose one is used
 * @property {string}  [password]                    - The device password. If not set the custom driver management purpose one is used
 * @property {string}  [port=5985]                   - The WinRM port
 */
/**
 * The WinRM Command Execution Result
 * @typedef  {callback} WinRMCallback
 * @property {WinRMOutput} [output]  - Output of the execution, present if no error has occurred
 * @property {ErrorResult} [error]   - Will be present if the execution resulted in an error
 */
/**
 * The WinRM Command Execution Result output
 * @typedef  {Object} WinRMOutput
 * @property {string} commandId  - Id of the WinRM command 
 * @property {string} shellId    - Id of the remote shell that executed the command
 * @property {string} stdout     - standard output produced by the command
 * @property {string} [stderr]   - standard error produced by the command (should always be null)
 * @property {int}    exitCode   - exit code of the command (should always be 0)
 */

var q = require('q');
var http = require('http');
var uuid4 = require('./winrm/utils/uuid').uuid4;
var winrmExecute=require("./winrm/commands/device/winrm/cli").command;

var sandboxConsole;

var sandboxResourceLocator = {
    log: {
        decorateLogs: function () {
            return sandboxConsole;
        }
    },
    q: q,
    http: http,
    utils: {
        uuid4: uuid4,
        platform: {
            supportsDomainAccountAuth: function () {
                return process.version.charAt(1) !== '0';
            }
        }
    },
};
sandboxResourceLocator.winrm = require('./winrm/index').factory(sandboxResourceLocator);


/**
 * Sends a WinRM command
 * @function
 * @private
 * @readonly
 * @param {Object} myConsole        - The Domotz Sandbox console
 * @param {WinRMOptions} options    - The WinRM Command execution options
*/
function sendWinRMCommand(myConsole, options, callback) {
    sandboxConsole = myConsole;

    winrmExecute(options, sandboxResourceLocator).execute(callback);
}

module.exports.sendWinRMCommand = sendWinRMCommand;