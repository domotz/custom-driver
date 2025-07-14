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
 * The Custom Driver Table object.
 * Exposes Table related libraries.
 * Contains Column definition related information for the Table object
 * @namespace driverTable
*/

var MAX_RECORD_ID_LEN = 50;
var MAX_TABLE_LABEL_LEN = 50;
var MAX_COLUMN_HEADER_LEN = 30;
var MAX_COLUMN_UNIT_LEN = 10;
var RESERVED_COLUMN_LABEL = "Id";
var lodash = require("lodash");

function isNotEmptyString(val, maxLen){
    return typeof val === "string" && val.length && val.length <= maxLen;
}

function validateColumnHeaders(columnHeaders) {
    if (!columnHeaders) {
        throw Error("Column Headers must be defined");
    }
    columnHeaders.forEach(function (columnHeader) {
        if (!isNotEmptyString(columnHeader.label, MAX_COLUMN_HEADER_LEN)){
            throw Error("Defined column header label must be a string with max length: " + MAX_COLUMN_HEADER_LEN);
        }
        if (columnHeader.label == RESERVED_COLUMN_LABEL){
            throw Error("Defined column header label " + RESERVED_COLUMN_LABEL + " is reseverd");
        }
        if (columnHeader.unit && !isNotEmptyString(columnHeader.unit, MAX_COLUMN_UNIT_LEN)){
            throw Error("Defined column header unit must be a string with max length: " + MAX_COLUMN_UNIT_LEN);
        }
    });
}
function validateInsertRecord(id, values, columnHeadersLength) {
    if (!isNotEmptyString(id, MAX_RECORD_ID_LEN)){
        throw Error("Defined record id must be a string with max length: " + MAX_RECORD_ID_LEN);
    }
    if (columnHeadersLength !== values.length) {
        throw Error("Defined column header size is different than inserted values size: " + columnHeadersLength + " != " + values.length);
    }
}

/**
 * Custom Driver table Column Header
 * @typedef {Object} ColumnHeader
 * @readonly
 * @property {string} label      - The table column label. Max 30 Characters
 * @property {string} [unit]     - The Unit of measurement of the column values (eg %). Max 10 characters
 */
/**
 * Custom Driver table Result
 * @typedef {Object} DriverTableResult
 * @readonly
 * @property {string}                label          - The table Label. Max 50 characters
 * @property {Array.<ColumnHeader>}  columnHeaders  - The column headers list
 * @property {Array.<Array.<any>>}   rows           - The table rows 
 */
/**
 * Creates a custom driver variable Table
 * @constructor
 * @private
 * @readonly
 * @param {string} label                           - The table label. Max 50 Characters
 * @param {Array.<ColumnHeader>}  [columnHeaders]  - The List of column header definitions
 * @param {Object} myConsole                       - The Domotz Sandbox console
 */
function createTable(label, columnHeaders, myConsole) {
    if (!isNotEmptyString(label, MAX_TABLE_LABEL_LEN)) {
        throw Error("Invalid table Label: " + label);
    }
    validateColumnHeaders(columnHeaders);
    var tableLabel = label;
    var tableColumnHeaders = columnHeaders;
    var rows = [];
    var recordIds = [];
    return {
        /**
         * Inserts a record inside the Custom Driver table object. 
         * The final table and values will be send to the cloud with the D.success() callback implicitly
         * @example driverTable.insertRecord("myId", ["val 1", "val 2"])
         * @param {string}                  id                         - The unique identifier for the table record. Added as value for column "Id". Max 50 characters
         * @param {Array.<any>}             values                     - A list of values to be added in the table for that record
         * @memberof driverTable
         * @readonly
         */
        insertRecord: function (id, values) {
            myConsole.debug("Adding record %s to table %s with values %s", id, tableLabel, values);
            validateInsertRecord(id, values, columnHeaders.length);
            var recordIdIndex = recordIds.indexOf(id);
            if (recordIdIndex !== -1) {
                throw Error("Duplicate record id. Cannot insert record: " + id);
            } else {
                recordIds.push(id);
                rows.push([id].concat(values));
            }
        },
        /**
         * Inserts or Updates a record inside the Custom Driver table object. 
         * The final table and values will be send to the cloud with the D.success() callback implicitly
         * @example driverTable.insertRecord("myId", ["val 1", "val 2"])
         * @param {string}                  id                         - The unique identifier for the table record. Added as value for column "Id". Max 50 characters
         * @param {Array.<any>}             values                     - A list of values to be added in the table for that record
         * @memberof driverTable
         * @readonly
         */
        upsertRecord: function (id, values) {
            myConsole.debug("Adding record %s to table %s with values %s", id, tableLabel, values);
            validateInsertRecord(id, values, columnHeaders.length);
            var row = [id].concat(values);
            var recordIdIndex = recordIds.indexOf(id);
            if (recordIdIndex !== -1){
                myConsole.warning("A Record with this id exists " + id + " --> Updating");
                rows[recordIdIndex] = row;
            } else {
                recordIds.push(id);
                rows.push(row);
            }
        },        
        /**
         * Returns the prepared table definition and values in the current driver execution
         * @example driverTable.getResult()
         * @readonly
         * @memberof driverTable 
         * @return  {DriverTableResult}
         */
        getResult: function() {
            return {
                label: label,
                columnHeaders: [{"label": RESERVED_COLUMN_LABEL}].concat(tableColumnHeaders),
                rows: lodash.clone(rows)
            };
        },
        /**
         * Returns true to indicate the object is a table
         * @private
         * @example driverTable.isTable
         * @readonly
         * @memberof driverTable 
         */        
        isTable: true,
        type:"table"
    };
}

module.exports.createTable = createTable;