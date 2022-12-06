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
    const soap = require("./soap").factory(resourceLocator);
    const myConsole = resourceLocator.log.decorateLogs();

    function _executeRequest(optionsFactory, request) {
        const payload = soap.envelope(request);
        const options = optionsFactory(Buffer.byteLength(payload));
        const defer = resourceLocator.q.defer();
        const handler = responseHandler(defer, request.parse, myConsole);

        myConsole.debug("Performing SOAP request to %s:%s%s for action %s with ID %s",
            options.host, options.port, options.path, request.action, request.uuid);
        myConsole.debug(payload);
        const httpRequest = resourceLocator.http.request(options, handler.handle);
        httpRequest.write(payload);
        httpRequest.on('error', handler.error);
        return defer.promise;
    }

    return _executeRequest;
}

module.exports.factory = client;


function responseHandler(defer, parser, myConsole) {
    const extract = require("./soap/extractor").extract;
    var dataBuffer = "";

    function addChunk(chunk) {
        dataBuffer += chunk;
    }

    if (parser === undefined) {
        parser = function (data) {
            return data;
        };
    }

    function finalize() {
        const parseString = require('xml2js').parseString;
        const stripNS = require("xml2js").processors.stripPrefix;
        parseString(dataBuffer, {tagNameProcessors: [stripNS]}, function (error, data) {
            if (error) {
                myConsole.debug("Error converting %s bytes of XML to JSON: " + error, dataBuffer.length);
                defer.reject(error);
                return;
            }
            myConsole.debug("Successfully converted %s bytes of XML to JSON, responding to: %s", dataBuffer.length,
                extract(data, 'Envelope/Header/0/RelatesTo/0')
                );
            if (extract(data, 'Envelope/Body/0').Fault !== undefined) {
                defer.reject(Error("Server responded SOAP Fault: " + JSON.stringify(extract(data, 'Envelope/Body/0').Fault)));
                return;
            }
            try {
                data = parser(data);
                defer.resolve(data);
            } catch (e) {
                defer.reject(Error("Malformed Server response, " + e.message + " in " + dataBuffer));
            }
        });
    }

    function _finalizeErr(errorCode) {
        const finalizeErr = function () {
            const error = new Error('Failed to process the request, status Code: ' + errorCode + " - response body: " + dataBuffer);
            error.code = errorCode;
            defer.reject(error);
        };
        return finalizeErr;
    }

    return {
        handle: function (response) {
            response.setEncoding('utf8');
            response.on('data', addChunk);
            if (response.statusCode < 200 || response.statusCode > 299) {
                response.on('end', _finalizeErr(response.statusCode));
            } else {
                response.on('end', finalize);
            }
        },
        error: function (err) {
            defer.reject(err);
        }
    };
}

// For testing purposes only
module.exports._responseHandler = responseHandler;
