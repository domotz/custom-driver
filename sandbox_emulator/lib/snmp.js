/**
 * This file is part of Domotz Collector.
 *
 * @license
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
 * @copyright Copyright (C) Domotz Inc
 */

/**
 * The Created SNMP Session for the device.
 * @namespace snmpSession
*/

/**
 * The SNMP Session Options
 * @typedef  {Object}   snmpSessionOptions
 * @property {integer}  [port=161]            - UDP port to send requests to
 * @property {integer}  [timeout=5000]        - The time the snmp session queries will persist for (in milisenconds).
 * @property {integer}  [maxRepetitions=24]   - How many rows of a table are to be retrieved in a single GetBulk operation. Used in SNMP Walk
 */
/**
 * The SNMP query callback
 * @typedef  {callback}    snmpCallback
 * @property {Object.<string, string>}  output   - The output object from the snmp query execution as a key-value pair for each oid and it corresponding value
 * @property {ErrorResult}              [error]  - Will be present if the snmp query resulted in an error.
 */

var fs = require("fs");
var snmp = require("net-snmp");
var lodash = require("lodash");
var snmpCommon = require("./snmpCommon").factory(snmp);

function getOutputFromVarbinds(varbinds) {
	var output = {};
	for (var i = 0; i < varbinds.length; i++) {
		if (snmp.isVarbindError(varbinds[i])) {
			output[varbinds[i].oid] = { 'error': snmp.varbindError(varbinds[i]) };
		} else if (varbinds[i].type == 4) {
			output[varbinds[i].oid] = varbinds[i].value.toString();
		} else if (Buffer.isBuffer(varbinds[i].value)) {
			output[varbinds[i].oid] = parseInt(varbinds[i].value.toString('hex'), 16);
		} else {
			output[varbinds[i].oid] = varbinds[i].value.toString();
		}
	}
	return output;
}

/**
 * Creates an SNMP session for your device
 * @constructor
 * @private
 * @readonly
 * @param {Object} myConsole           - The Domotz Sandbox console
 * @param {Device} device              - The Device object
 * @param {Object} snmpSessionOptions  - The SNMP Session Options
 */
function createSessionForDevice(myConsole, device, snmpOptions) {
    /** 
     * Session initialization
     * @private
     * @readonly
    */
    var authProviderOptions = snmpCommon.getAuthProviderOptions(device.snmp_authentication);
    var realSession = snmpCommon.getSession(device.ip, snmpOptions, authProviderOptions);
    return {
        /**
         * Executes an SNMP Walk for an OID towards the device
         * @example
         * D.device.createSNMPSession().walk('1.3.6.1.2.1.1', cb)
         * [See SNMP Driver Examples]{@link https://github.com/domotz/custom-driver/tree/master/examples/snmp}
         * @memberof snmpSession
         * @param {string}         oid        - The OID to perform the snmp walk for.
         * @param {snmpCallback}   callback   - The SNMP Walk execution callback function.
         * @readonly
         * @function
         */
        walk: function (oid, callback) {
            myConsole.info("Performing SNMP Walk: %s", oid);
            var output = {};
            function feedCallback(varbinds) {
                var feedOids = getOutputFromVarbinds(varbinds);
                lodash.extend(output, feedOids);
            }
            function doneCallback(error) {
                callback(output, error);
            }
            realSession.subtree(oid, snmpOptions.maxRepetitions, feedCallback, doneCallback);
        },
        /**
         * Executes SNMP Get for a list of OIDs towards the device
         * @example
         * D.device.createSNMPSession().get(['1.3.6.1.2.1.1.5.0', '1.3.6.1.2.1.1.7.0'], cb)
         * [See SNMP Driver Examples]{@link https://github.com/domotz/custom-driver/tree/master/examples/snmp}
         * @memberof snmpSession
         * @param {Array.<string>} oids       - A list of OID strings to execute an SNMP Get towards.
         * @param {snmpCallback}   callback   - The SNMP GET execution callback function.
         * @readonly
         * @function
         */
        get: function (oids, callback) {
            myConsole.info("Performing SNMP Get: %s", oids);
            function outputTransformerSnmpGet(error, varbinds) {
                var output = null;
                if (!error) {
                    output = getOutputFromVarbinds(varbinds);
                }
                callback(output, error);
            }
            realSession.get(oids, outputTransformerSnmpGet);
        },
        /**
         * Executes SNMP Set for an OID with its respective value and OID type defined.
         * @example
         * D.device.createSNMPSession().set('1.3.6.1.2.1.1.5.0', 'new-snmp-name', cb)
         * [See SNMP Driver Examples]{@link https://github.com/domotz/custom-driver/tree/master/examples/snmp}
         * @memberof snmpSession
         * @param {string}         oid               - The OID to perform the snmp set for. Must be writable.
         * @param {string|int}     value             - The new value to set on that OID
         * @param {snmpCallback}   callback          - The SNMP Set execution callback function.
         * @readonly
         * @function
         */
        set: function (oid, value, callback) {
            myConsole.info("Performing SNMP Set: %s --> %s", oid, value);
            realSession.community = device.snmp_authentication && device.snmp_authentication.snmp_write_community;
            function outputTransformerSnmpSet(error, varbinds) {
                var output = {};
                if (!error) {
                    output = getOutputFromVarbinds(varbinds);
                }
                callback(output, error);
            }
            var snmpType;
            if (typeof value === "number") {
                snmpType = snmp.ObjectType.Integer32;
            } else {
                snmpType = snmp.ObjectType.OctetString;
            }
            var oids = [{
                oid: oid,
                value: value,
                type: snmpType
            }];
            realSession.set(oids, outputTransformerSnmpSet);
        }
    };
}

module.exports.createSessionForDevice = createSessionForDevice;