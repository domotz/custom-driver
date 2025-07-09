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
 * Helper functions for creating SOAP Envelopes
 */

function factory(resourceLocator) {
    const extract = require('./extractor').extract;
    const myConsole = resourceLocator.log.decorateLogs();
    const uuid4 = resourceLocator.utils.uuid4;

    function createRequest(action, shellId, options, body, parse) {
        return {
            uuid: uuid4(),
            shellId: shellId,
            action: action,
            options: options,
            body: body,
            parse: parse,

        };
    }

    function parseStartSession(response) {
        const shell = extract(response, 'Envelope/Body/0/Shell/0');
        const shellId = extract(shell, 'ShellId/0');
        myConsole.info("Shell created for user %s on host %s; shellId: %s",
            extract(shell, 'Owner/0'),
            extract(shell, 'ClientIP/0'),
            shellId);
        return shellId;
    }

    function parseExecuteCommand(shellId) {
        return function (response) {
            const command = extract(response, 'Envelope/Body/0/CommandResponse/0');
            const commandId = extract(command, 'CommandId/0');
            myConsole.info("command %s executed on shellId %s", commandId, shellId);
            return {commandId: commandId, shellId: shellId};
        };
    }

    function parseGetCommandOutput(returned) {
        return function (response) {
            const receivedResponse = extract(response, 'Envelope/Body/0/ReceiveResponse/0');
            const streams = extract(receivedResponse, 'Stream');
            streams.forEach(function (streamChunk) {
                const name = streamChunk.$.Name;
                const end = streamChunk.$.End === "true";
                if (end) {
                    returned[name] = returned[name] || null;
                    return;
                }
                const data = new Buffer(streamChunk._, 'base64').toString('utf-8');
                returned[name] = (returned[name] || "") + data;
            });
            try {
                returned.exitCode = parseInt(extract(receivedResponse, 'CommandState/0/ExitCode/0'), 10);
            } catch(e) {
                // Process still running
            }
            return returned;
        };
    }

    return {
        startSession: function () {
            return createRequest("http://schemas.xmlsoap.org/ws/2004/09/transfer/Create",
                null,
                {
                    "WINRS_NOPROFILE": "FALSE",
                    "WINRS_CODEPAGE": 437
                },
                {
                    "rsp:Shell": {
                        "rsp:InputStreams": "stdin",
                        "rsp:OutputStreams": "stderr stdout",
                    }
                },
                parseStartSession);
        },
        executeCommand: function (command, shellId) {
            return createRequest("http://schemas.microsoft.com/wbem/wsman/1/windows/shell/Command",
                shellId,
                {"WINRS_CONSOLEMODE_STDIN": "TRUE", "WINRS_SKIP_CMD_SHELL": "TRUE"},
                {
                    "rsp:CommandLine": {
                        "rsp:Command": command
                    }
                },
                parseExecuteCommand(shellId)
            );
        },
        getCommandOutput: function (data) {
            return createRequest("http://schemas.microsoft.com/wbem/wsman/1/windows/shell/Receive",
                data.shellId,
                undefined,
                {
                    "rsp:Receive": {
                        "rsp:DesiredStream": {
                            "_": "stdout stderr",
                            "@CommandId": data.commandId
                        }
                    }
                },
                parseGetCommandOutput(data)
            );
        },
        closeSession: function (shellId) {
            return createRequest("http://schemas.xmlsoap.org/ws/2004/09/transfer/Delete", shellId);
        }
    };

}


module.exports.factory = factory;