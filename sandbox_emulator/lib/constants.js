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
 * Custom Driver variable
 * Created via D.createVariable
 * @typedef {Object} Variable
 * @readonly
 * @property {string} uid   - The identifier of the variable. Must be Unique. Max 50 characters
 * <br> cannot be one of the following reserved words: "table", "column", "history"
 * @property {string} name  - The Name/Label of the variable. Max 100 characters
 * @property {string} value - The Value of the variable. Max 500 characters
 * @property {string} unit  - The Unit of measurement of the variable (eg %). Max 10 characters
 * @property {ValueType} valueType  - The type of the variable value (used for visualization purposes).
 */
/**
 * Known Domotz Context Error types
 * @example D.errorType.TIMEOUT_ERROR
 * @typedef ErrorType
 * @property {string} TOO_MANY_VARIABLES_ERROR  - Too many variables have been defined in this driver execution
 * @property {string} MISSING_DEVICE_ERROR      - No device was found for execution
 * @property {string} RESOURCE_UNAVAILABLE      - The Resource you are trying to access is not available
 * @property {string} AUTHENTICATION_ERROR      - Authentication with the device has failed
 * @property {string} PARSING_ERROR             - Failed to parse the response
 * @property {string} TIMEOUT_ERROR             - The remote call has resulted in a timeout
 * @property {string} IMPORT_NOT_ALLOWED        - Import statements are not allowed in the sandbox environment
 * @property {string} REQUIRE_NOT_ALLOWED       - Require statements are not allowed in the sandbox environment
 * @property {string} GENERIC_ERROR             - A Generic/Unknown error has occurred
 */
/**
 * Domotz variable value types
 * @example D.valueType.RATE
 * @typedef ValueType
 * @property {string} STRING         - String value
 * @property {string} NUMBER         - Numerical value
 * @property {string} DATETIME       - Datetime value
 * @property {string} RATE           - A numeric value that changes over time in an increasing manner. 
 * Only the rate of change is calculated and stored
 * @property {string} MONOTONE_RATE  - A numeric value similar to the RATE type but ignoring values lower 
 * than the previous collected value in the rate of change comparison
*/


const errorTypes = {
    MISSING_DEVICE_ERROR: "MISSING_DEVICE_ERROR",
    RESOURCE_UNAVAILABLE: "RESOURCE_UNAVAILABLE",
    AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
    PARSING_ERROR: "PARSING_ERROR",
    TIMEOUT_ERROR: "TIMEOUT_ERROR",
    IMPORT_NOT_ALLOWED: "IMPORT_NOT_ALLOWED",
    REQUIRE_NOT_ALLOWED: "REQUIRE_NOT_ALLOWED",
    GENERIC_ERROR: "GENERIC_ERROR"
};

const valueTypes = {
    STRING: "STRING",
    NUMBER: "NUMBER",
    DATETIME: "DATETIME",
    RATE: "RATE",
    MONOTONE_RATE: "MONOTONE_RATE"
};

const validUidRegex = new RegExp('^((?!((/|^)(table|column|history)(/|$))).)*$');

module.exports.errorTypes = errorTypes;
module.exports.valueTypes = valueTypes;
module.exports.validUidRegex = validUidRegex;