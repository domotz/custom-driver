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
 * SOAP Client
 */

function client(resourceLocator) {
    const extract = require("./soap/extractor").extract;
    const soap = require("./soap").factory(resourceLocator);
    const myConsole = resourceLocator.log.decorateLogs();
    const winrmHttp = require("./domotz_winrm_http/winrm_http").init(myConsole, resourceLocator.utils.platform);

    function finalize(defer, parser, responsePayload) {
        const parseString = require('xml2js').parseString;
        const stripNS = require("xml2js").processors.stripPrefix;
        parseString(responsePayload, {tagNameProcessors: [stripNS]}, function (error, data) {
            if (error) {
                myConsole.debug("Error converting %s bytes of XML to JSON: " + error, responsePayload.length);
                defer.reject(error);
                return;
            }
            myConsole.debug("Successfully converted %s bytes of XML to JSON, responding to: %s", responsePayload.length,
                extract(data, 'Envelope/Header/0/RelatesTo/0')
            );
            if (extract(data, 'Envelope/Body/0').Fault !== undefined) {
                defer.reject(Error("Server responded SOAP Fault: " + JSON.stringify(extract(data, 'Envelope/Body/0').Fault)));
                return;
            }
            try {
                if (parser) {
                    data = parser(data);
                    defer.resolve(data);
                } else {
                    defer.resolve();
                }
            } catch (e) {
                defer.reject(Error("Malformed Server response, " + e.message + " in " + responsePayload));
            }
        });
    }

    function executeRequest(commonOptions, request) {
        const payload = soap.envelope(request);
        const options = commonOptions;
        options.body = payload;

        const defer = resourceLocator.q.defer();
        winrmHttp.post(options, function (err, res) {
            if (err) {
                const error = new Error('Failed to process the request, status Code: ' + err + " - response body: " + res);
                error.code = err;
                defer.reject(error);
                return;
            }
            finalize(defer, request.parse, res);
        });
        return defer.promise;
    }

    return {
        executeRequest: executeRequest,
        _finalize: finalize
    };
}

module.exports.factory = client;
