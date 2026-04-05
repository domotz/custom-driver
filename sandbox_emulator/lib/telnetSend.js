/** This file is part of Domotz Collector.
  * Copyright (C) 2016  Domotz Ltd
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
  **/
/**
 * Created by Tommaso Latini <tommaso@domotz.com> on 31/03/15.
 *
 */

var telnetSend = function (message, resourceLocator) {
    var myConsole = resourceLocator.log.decorateLogs();

    var telnet = resourceLocator.telnet;
    var cmdUtils = resourceLocator.utils.command;

    var responseOut = "";
    var responseErr = "";

    var payload = message.payload;

    var host = payload.host;
    var port = payload.port;
    var command = payload.cmd;
    var onConnectCommand = payload.onConnectCommand;

    delete payload.onConnectCommand;
    delete payload.cmd;

    return {
        execute: function (callback) {

            var connection = new telnet();

            connection.connect(payload)
                .then(function() {
                    myConsole.debug("Connection successful to %s:%d", host, port);
                    connection.exec(command);
                });

            connection.on("timeout", function() {
                connection.end();
            });

            connection.on("error", function(error) {
                responseErr = error;
                connection.end();
            });

            connection.telnetSocket.on("data", function(data) {
                responseOut += data.toString();
            });

            connection.on("connect", function() {
                if (onConnectCommand!==null && onConnectCommand!==undefined) {
                    connection.telnetSocket.write(onConnectCommand);
                }
            });

            connection.on("close", function() {
                myConsole.debug("Received telnet response " + responseOut);
                callback(cmdUtils.getResponse(responseOut, responseErr));
            });

        },
        describe: function () {
            return message.correlationId + " - telnetSend - " + host +
              ":" + port + " - " + command.length + " bytes";
        }
    };
};

module.exports.command = telnetSend;