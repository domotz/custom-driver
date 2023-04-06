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
 * @ignore
 * @namespace driverVariable
 * The Custom Driver Variable object.
 * Exposes Variable related libraries.
*/

/**
* Creates a custom driver variable.
* @constructor
* @private
* @readonly
* @param {string} uid   - The identifier of the variable. Must be Unique. Max 50 characters
* <br> cannot be one of the following reserved words: "table", "column", "history"
* @param {string} name  - The Name/Label of the variable. Max 100 characters
* @param {string} value - The Value of the variable. Max 500 characters
* @param {string} unit  - The Unit of measurement of the variable (eg %). Max 10 characters
* @param {ValueType} valueType  - The value type of the variable (used for display purposes)
* @param {object} agentDriverSettings - The agent driver configuration that holds various settings 
* @return {Variable}
*/

const validUidRegex = require('./constants').validUidRegex;
const valueTypes = require('./constants').valueTypes;

function createVariable (uid, name, value, unit, valueType, agentDriverSettings) {
    if (uid === null || uid === undefined || uid.length < 1 || uid.length > agentDriverSettings.max_var_id_len) {
        throw Error("Invalid variable uid: " + uid);
    }
    if (typeof(uid) === "number") {
        uid = uid.toString();
    }
    if (uid.match(validUidRegex) === null) {
        throw Error("uid '"+uid+"' is a reserved word");
    }
    if (unit) {
        unit = unit.substr(0, agentDriverSettings.max_var_unit_len);
    } else {
        unit = null;
    }
    if (valueType && !(valueType in valueTypes)) {
        throw Error("Invalid variable value type: " + valueType);
    }
    if (value !== undefined && value !== null) {
        value = String(value);
    } else {
        value = null;
    }
    return {
        "uid": uid,
        "unit": unit,
        "valueType": valueType,
        "value": value,
        "label": name
    };
}

module.exports.createVariable = createVariable;
