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
 * Helper function for creating SOAP Envelopes
 */

function factory() {
    return {
        envelope: function (request) {
            const builder = require('xmlbuilder');
            const env = builder.create("s:Envelope")
                .att("xmlns:s", 'http://www.w3.org/2003/05/soap-envelope')
                .att("xmlns:wsa", 'http://schemas.xmlsoap.org/ws/2004/08/addressing')
                .att("xmlns:wsman", 'http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd')
                .att("xmlns:p", 'http://schemas.microsoft.com/wbem/wsman/1/wsman.xsd')
                .att("xmlns:rsp", 'http://schemas.microsoft.com/wbem/wsman/1/windows/shell');
            header(env, request);
            body(env, request);
            return env.end();
        }
    };
}

module.exports.factory = factory;

function header(env, request) {
    const maxEnvelopeSize = 153600;
    const operationTimeoutSeconds = 60;
    const mustUnderstand = {"mustUnderstand": "true"};
    const header = env.ele("s:Header");
    header
        .ele("wsa:To", "http://windows-host:5985/wsman").up()
        .ele("wsman:ResourceURI", mustUnderstand, "http://schemas.microsoft.com/wbem/wsman/1/windows/shell/cmd").up()
        .ele("wsa:ReplyTo").ele("wsa:Address", mustUnderstand, "http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous").up().up()
        .ele("wsman:MaxEnvelopeSize", mustUnderstand, "" + maxEnvelopeSize).up()
        .ele("wsa:MessageID", "urn:uuid:" + request.uuid).up()
        .ele("wsman:Locale", {"mustUnderstand": "false", "xml:lang": "en-US"}).up()
        .ele("wsman:OperationTimeout", "PT" + operationTimeoutSeconds + "S").up()
        .ele("wsa:Action", mustUnderstand, request.action).up();
    if (request.shellId) {
        const selector = header.ele("wsman:SelectorSet");
        selector.ele("wsman:Selector", {"Name": "ShellId"}, request.shellId);
    }
    if (request.options) {
        const options = header.ele("wsman:OptionSet");
        Object.keys(request.options).forEach(function (key) {
            options.ele("wsman:Option", {"Name": key}, request.options[key]).up();
        });
    }
    return env;
}

function body(env, request) {
    const body = env.ele("s:Body");
    if (request.body) {
        _fillBody(body, request.body);
    }
}

function _fillBody(element, data) {
    if (typeof data !== "object" && typeof data !== "function") {
        element.txt("" + data);
    } else if (typeof data === "object") {
        Object.keys(data).forEach(function (key) {
            if (key === '_') {
                element.txt(data[key]);
            } else if (key[0] === '@') {
                element.att(key.substring(1), data[key]);
            } else {
                const newElement = element.ele(key);
                _fillBody(newElement, data[key]);
            }
        });
    }
}
