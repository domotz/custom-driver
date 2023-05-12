/** This file is part of Domotz Agent.
 * Copyright (C) 2021  Domotz Ltd
 *
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
 * A Remote is a device in the LAN that exposes WinRM and allows Basic Authentication
 * HTTP connections.
 *
 * A Remote object has methods for executing commands on the remote machine and
 * processing the output.
 **/

module.exports.Remote = function (host, port, username, password, resourceLocator) {
    var myConsole = resourceLocator.log.decorateLogs();

    const client = require("./client").factory(resourceLocator);
    const soap = require("./soap").factory(resourceLocator);

    var commonOptions = {
        host: host,
        port: port,
        path: '/wsman',
        username: username,
        password: password
    };

    /**
     * Executes a command on the Remote by opening a Shell, launching the command as a string,
     * collecting the output (stdout, stderr) and the exit code, and finally closing the Shell
     *
     * Returns a promise that, once satisfied, yields the stdout of the command.
     *
     * Options available:
     *
     * - failOnErrors : default true. If true, an exception is raised if the remote command exited with a code != 0.
     *   If 'false', the exit code is ignored.
     * - powershell: default true. If true, the command will be executed as powershell otherwise as cmd.exe
     *
     * @param command
     * @param options
     * @returns {*}
     */
    function executeCommand(command, options) {
        var _shellId = null;
        if (options === undefined) {
            options = {};
        }
        // if command has exit code != 0, raise exception
        options.failOnErrors = options.failOnErrors !== undefined ? options.failOnErrors : true;
        options.powershell = options.powershell !== undefined ? options.powershell : true;

        if (options.powershell) {
            command = 'powershell.exe "' + command.replace(/"/gi, '\\"') + '"';
        }

        function waitForProcessFinish(data) {
            if (data.exitCode === undefined) {
                return client.executeRequest(commonOptions, soap.requests.getCommandOutput(data)).then(waitForProcessFinish);
            }

            if (options.failOnErrors && data.exitCode) {
                myConsole.error("Command %s exited with error code: %s", data.commandId, data.exitCode);
                throw new Error("Command " + command + " failed with exit code: " + data.exitCode + " - " + (data.stdout || "") + " " + (data.stderr || ""));
            }
            data.stdout = data.stdout || "";
            myConsole.debug("Get Output SUCCESS - shellId: %s, commandId %s, output size: %s",
                data.shellId, data.commandId, data.stdout.length);
            // Shell closing is asynchronous to return value
            client.executeRequest(commonOptions, soap.requests.closeSession(data.shellId)).then(function () {
                myConsole.info("Close Shell SUCCESS");
            }).catch(function (error) {
                myConsole.error("Cannot close shell shellId: %s - %s", _shellId, error);
            });
            return data;
        }

        return client.executeRequest(commonOptions, soap.requests.startSession())
            .then(function (shellId) {
                myConsole.debug("Session SUCCESS - shellId: %s", shellId);
                _shellId = shellId;
                return client.executeRequest(commonOptions, soap.requests.executeCommand(command, shellId));
            })
            .then(function (data) {
                myConsole.debug("Command SUCCESS - shellId: %s, commandId %s", data.shellId, data.commandId);
                return client.executeRequest(commonOptions, soap.requests.getCommandOutput(data));
            })
            .then(waitForProcessFinish);
    }

    return {
        executeCommand: executeCommand
    };
};