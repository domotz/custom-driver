/** This file is part of Domotz Collector.
 * Copyright (C) 2021  Domotz Ltd
 *
 * Domotz Collector is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Domotz Collector is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Domotz Collector.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Command for executing Winrm commands on devices
 */
'use strict';

var winrmExecute = function (message, resourceLocator) {
    var winrm = resourceLocator.winrm;
    var command = message.payload.command;
    var data = {
        username: message.payload.username,
        password: message.payload.password,
        port: message.payload.port || 5985,
        mac_address: message.payload.hw_address,
        host: message.payload.host,
        command: command,
        parserCode: message.payload.parser
    };
    var myConsole = console

    var executeWinrmCommand = function (callback) {
        // var myConsole = baseConsole.decorate('EXECUTE');
        var ipAddress = data.host || resourceLocator.interfacesBindingStorage.getIpsFromMac(data.mac_address.toUpperCase())[0];
        var remote = winrm.createRemote(ipAddress, data.port, data.username, data.password);
        var parser = function (x) {
            return x;
        };
        if (data.parserCode !== undefined) {
            parser = new Function('output', data.parserCode);
        }

        myConsole.info('Executing command `%s`on %s:%s with username %s', data.command, ipAddress, data.port, data.username);
        remote.executeCommand(data.command).then(
            function (output) {
                callback({'outcome': parser(output), 'error': null});
            }
        ).catch(
            function (err) {
                callback({'outcome': null, 'error': err});
            }
        );
    };

    return {
        execute: function (callback) {
            return executeWinrmCommand(callback);
        },
        describe: function () {
            return 'winrmExecute' + JSON.stringify(require('../../device').removePassword(data));
        }
    };
};

module.exports.command = winrmExecute;

