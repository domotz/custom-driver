/** This file is part of Domotz Agent.
 * Copyright (C) 2016  Domotz UK LLP
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
 **/
/**
 *
 * Created by Iacopo Papalini <iacopo@domotz.com> on 11/04/16.
 */

const DEFAULT_READ_COMMUNITY = "public";


var extractOids = function (oidsMapping) {
    "use strict";
    var oids = [];
    for (var oid in oidsMapping) {
        if (oidsMapping.hasOwnProperty(oid)) {
            oids.push(oid);
        }
    }
    return oids;
};

var isEmpty = function (obj) {
    if (obj === undefined || obj === null || obj === "") {
        return true;
    }
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            return false;
        }
    }
    return JSON.stringify(obj) === JSON.stringify({});
};

var factory = function (snmp) {
    var transformerString = function (o, type) {
        // https://nodejs.org/api/buffer.html#buffer_buffers_and_character_encodings
        try {
            if (isCounter64(type)) {
                return transformerCounter64(o, type);
            }

            var s = "" + o;
            if (s.indexOf("\uFFFD") === -1) {
                return s;
            } else {
                return o.toString("hex").match(/.{1,2}/g).join(" ").toUpperCase();
            }
        } catch (e) {
            return "" + o;
        }
    };

    var transformerMac = function (o) {
        var byteList = [];
        for (var i = 0; i < o.length; i++) {
            var tmpByte = o.readUInt8(i);
            var tmpStr = tmpByte.toString(16);
            if (tmpStr.length < 2) {
                tmpStr = "0" + tmpStr;
            }
            byteList.push(tmpStr);
        }
        return byteList.join(":").toUpperCase();
    };

    var isCounter64 = function (type) {
        return type !== undefined && type === snmp.ObjectType.Counter64;
    };

    var transformerCounter64 = function (value, type) {
        if (isCounter64(type)) {
            var decimalValue = 0;
            var length = value.length;
            for(var j = 0; j < length; j++) {
                var currentValue = value[j] * Math.pow(256, (length - j - 1));
                decimalValue += currentValue;
            }
            return decimalValue;
        }
        return value;
    };

    var transformerInt = function (value, type) {
        if (isCounter64(type)) {
            return transformerCounter64(value, type);
        }
        return value;
    };

    var transformerIntTypeInvariant = function (value, type) {
        if (isCounter64(type)) {
            return transformerCounter64(value, type);
        }
        if (typeof value === "number") {
            return value;
        }
        return value + "";
    };

    var transformer = function (valueType) {
        "use strict";

        var transformingFunctions = {
            "string": transformerString,
            "mac": transformerMac,
            "int": transformerInt
        };

        if (transformingFunctions.hasOwnProperty(valueType)) {
            return transformingFunctions[valueType];
        } else {
            return transformingFunctions["string"];
        }
    };

    var transformerTypeInvariant = function (valueType) {
        "use strict";

        var transformingFunctions = {
            "string": transformerString,
            "mac": transformerMac,
            "int": transformerIntTypeInvariant
        };

        if (transformingFunctions.hasOwnProperty(valueType)) {
            return transformingFunctions[valueType];
        } else {
            return transformingFunctions["string"];
        }
    };

    var SecurityLevelMap = {};
    var AuthProtocolsMap = {};
    var PrivProtocolsMap = {};
    var VersionsMap = {
        "V1": snmp.Version1,
        "V2": snmp.Version2c,
        "V3_NO_AUTH": snmp.Version3,
        "V3_AUTH_NO_PRIV": snmp.Version3,
        "V3_AUTH_PRIV": snmp.Version3
    };

    var V2VersionMap = {
        0: snmp.Version1,
        1: snmp.Version2c,
        3: snmp.Version3
    };

    if (snmp.SecurityLevel) {
        SecurityLevelMap = {
            "V3_NO_AUTH": snmp.SecurityLevel.noAuthNoPriv,
            "V3_AUTH_NO_PRIV": snmp.SecurityLevel.authNoPriv,
            "V3_AUTH_PRIV": snmp.SecurityLevel.authPriv
        };
    }

    function mapLevel (options, authProvider) {
        if (authProvider) {
            return SecurityLevelMap[authProvider.version];
        }
        if (options) {
            return SecurityLevelMap[options.extendedVersion];
        }
        throw new Error("Unspecified or unmappable security level");
    }
    if (snmp.AuthProtocols) {
        AuthProtocolsMap = {
            "MD5": snmp.AuthProtocols.md5,
            "SHA": snmp.AuthProtocols.sha
        };
    }
    function mapAuthProtocol (options, authProvider) {
        if (authProvider) {
            return AuthProtocolsMap[authProvider.authenticationProtocol && authProvider.authenticationProtocol !== null ? authProvider.authenticationProtocol : "none"];
        }
        if (options) {
            return AuthProtocolsMap[options.authenticationProtocol && options.authenticationProtocol !== null ? options.authenticationProtocol : "none"];
        }
    }

    if (snmp.PrivProtocols) {
        PrivProtocolsMap = {
            "DES": snmp.PrivProtocols.des,
            "AES": snmp.PrivProtocols.aes
        };


    }

    function mapPrivProtocol (options, authProvider) {
        if (authProvider) {
            return PrivProtocolsMap[authProvider.encryptionProtocol && authProvider.encryptionProtocol !== null ? authProvider.encryptionProtocol : "none"];
        }
        if (options) {
            return PrivProtocolsMap[options.encryptionProtocol && options.encryptionProtocol !== null ? options.encryptionProtocol : "none"];
        }
    }
    function mapVersion (options, authProvider) {
        if (options && options.extendedVersion) {
            return VersionsMap[options.extendedVersion];
        }
        if (options && (options.version !== undefined && options.version !== null)) {
            return V2VersionMap[options.version];
        } else if (authProvider && authProvider.version) {
            return VersionsMap[authProvider.version];
        } else if (options.version === null) {
            return snmp.Version2c;
        }

        console.error("Cannot understand required snmp version");
        console.error("Options are " + JSON.stringify(options));
        console.error("Auth Provider is " + JSON.stringify(authProvider));
        throw new Error("Cannot understand required snmp version");
    }

    function mapCommunity (options, authProvider) {
        var community = options.community;

        // TODO: maybe check that community is not empty string too
        if (authProvider && authProvider.community) {
            community = authProvider.community;
        }

        return community || DEFAULT_READ_COMMUNITY;
    }

    function mapResource (options, authProvider, resource) {
        if (authProvider) {
            return authProvider[resource];
        }
        if (options) {
            return options[resource];
        }
    }

    function mapUser (options, authProvider) {
        return {
            name: mapResource(options, authProvider, "username"),
            level: mapLevel(options, authProvider),
            authProtocol: mapAuthProtocol(options, authProvider),
            authKey: mapResource(options, authProvider, "authenticationKey"),
            privProtocol: mapPrivProtocol(options, authProvider),
            privKey: mapResource(options, authProvider, "encryptionKey")
        };
    }


    function getSession (host, options, authProvider) {

        var version = mapVersion(options, authProvider);

        if (version === snmp.Version1 || version === snmp.Version2c) {
            options.version = version;
            var community = mapCommunity(options, authProvider);
            return snmp.createSession(host, community, options);
        }

        if (snmp.Version3) {
            if (version === snmp.Version3) {
                var user = mapUser(options, authProvider);
                return snmp.createV3Session(host, user, options);
            }
        }
        throw new Error("Unable to create Snmp Session");
    }

    function getAuthProviderOptions(deviceOptions) {
        return {
            community: deviceOptions && deviceOptions.snmp_read_community,
            version: deviceOptions && deviceOptions.version,
            username: deviceOptions && deviceOptions.username,
            authenticationProtocol: deviceOptions && deviceOptions.authentication_protocol,
            authenticationKey: deviceOptions && deviceOptions.authentication_key,
            encryptionProtocol: deviceOptions && deviceOptions.encryption_protocol,
            encryptionKey: deviceOptions && deviceOptions.encryption_key
        };
    }

    return {
        transformer: transformer,
        transformerTypeInvariant: transformerTypeInvariant,
        extractOids: extractOids,
        isEmpty: isEmpty,
        getSession: getSession,
        getAuthProviderOptions: getAuthProviderOptions,
    };
};


module.exports.factory = factory;