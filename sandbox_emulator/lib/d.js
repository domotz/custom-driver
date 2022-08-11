// var snmp = require("net-snmp");
require("dotenv").config();
var createDevice = require("../lib/device").device;
var createTable = require("../lib/table").createTable;

var device = {
    ip: process.env.DEVICE_IP,
    snmp_authentication: {
        snmp_read_community: process.env.DEVICE_SNMP_READ_COMMUNITY,
        snmp_write_community: process.env.DEVICE_SNMP_WRITE_COMMUNITY,
        snmp_authentication: process.env.DEVICE_SNMP_WRITE_COMMUNITY == null ? true : process.env.DEVICE_SNMP_WRITE_COMMUNITY,
        username: process.env.DEVICE_SNMP_USERNAME,
        version: process.env.DEVICE_SNMP_VERSION,
        authentication_protocol: process.env.DEVICE_SNMP_AUTHENTICATION_PROTOCOL,
        authentication_key: process.env.DEVICE_SNMP_AUTHENTICATION_KEY,
        encryption_protocol: process.env.DEVICE_SNMP_ENCRYPTION_PROTOCOL,
        encryption_key: process.env.DEVICE_SNMP_ENCRYPTION_KEY,
    }
};
if (process.env.DEVICE_USERNAME) {
    device.credentials = {
        username: process.env.DEVICE_USERNAME,
        password: new Buffer(process.env.DEVICE_PASSWORD).toString("base64")
    };
}

function format(str, charcount) {
    var result = str + " ".repeat(charcount);
    return result.substring(0, charcount);
}

console.log("\n############################ LOGS ############################\n")

global.D = { /**
* Mathematical Utilities library
* @example D.math
* @namespace D.math
* @memberof D
*/
    math: {
        /**
         * Percentage Calculating Function
         * @function
         * @example 
         * // returns 70
         * D.math.percent(7, 10)
         * @param {number} actual   - The actual number
         * @param {number} maximum  - The maximum number
         * @returns {number}        - The Percentage
        */
        percent: function (actual, maximum) {
            return Math.round(10000.0 * parseInt(actual, 10) / parseInt(maximum, 10)) / 100;
        }
    },
    /**
    * NodeJS Lodash Module 
    * Javascript utility library that delivers modularity, performance and some extra features.
    * @example D._
    * @memberof D
    * @external _
    * @see {@link https://lodash.com/docs/4.17.15}
    */
    _: require('lodash'),
    /**
    * Nodejs q Module
    * @private
    * @example  D.q
    * @memberof D
    * @external q 
    * @see {@link https://devdocs.io/q/}
    */
    q: require('q'),
    htmlParse: require('cheerio').load,
    success: function (...args) {
        if (!args || !args.length) return;
        args = [args[0], args[1]]
        args.forEach(function (vars, index) {
            if (!vars) return;
            if (vars && vars.getResult) {
                var result = vars.getResult();
                var maxLengths = new Array(result.columnHeaders.length).fill(0)
                for (var i = 0; i < result.rows.length; i++) {
                    for (var j = 0; j < result.columnHeaders.length; j++) {
                        maxLengths[j] = Math.max(Math.max(maxLengths[j], result.rows[i][j] ? result.rows[i][j].toString().length : 0), result.columnHeaders[j].label.length)
                    }
                }
                var tableHeader = result.columnHeaders.map(function (header, index) {
                    return format(header.label, maxLengths[index])
                }).join("|")
                var splitter = "-".repeat(tableHeader.length)
                var tableBody = result.rows.map(function (row) {
                    return row.map(function (col, index) {
                        return format(col, maxLengths[index])
                    }).join("|")
                }).join('\n')
                console.log("\n######################## TABLE RESULT ########################\n")
                console.log(result.label)
                console.log(tableHeader);
                console.log(splitter);
                console.log(tableBody)
            } else {
                var maxLength = 0;
                vars.forEach(function (v) {
                    var label = v.label + (v.unit ? " (" + v.unit + ")" : "")
                    v.l = label
                    maxLength = Math.max(maxLength, label.length)
                })
                console.log("\n####################### VARIABLE RESULT ######################\n")
                vars.forEach(function (v) {
                    console.log(format(v.l, maxLength), "=", v.value);
                });
            }

        })
    },
    failure: function (msg) {
        console.error(msg);
        process.exit(1);
    },
    errorType: {
        MISSING_DEVICE_ERROR: "No device was found for execution",
        RESOURCE_UNAVAILABLE: "The Resource you are trying to access is not available",
        AUTHENTICATION_ERROR: "Authentication with the device has failed",
        PARSING_ERROR: "Failed to parse the response",
        TIMEOUT_ERROR: "The remote call has resulted in a timeout",
        IMPORT_NOT_ALLOWED: "Import statements are not allowed in the sandbox enviroment",
        REQUIRE_NOT_ALLOWED: "Require statements are not allowed in the sandbox enviroment",
        GENERIC_ERROR: "Generic/Unknown error has occurred",
    },
    device: createDevice(device, { max_var_id_len: 50 }, console),
    createTable: function (label, headers) {
        return createTable(label, headers, console)
    },

    /**
     * Creates an External IP device object
     * @example D.createExternalDevice("1.1.1.1", {"username": "root", "password": D.device.password()})
     * @param {string}                    deviceHost          - The IP or Hostname of the external device
     * @param {DeviceCredentials}         [deviceCredentials] - The credentials for the external device
     * @memberof D
     * @readonly
     * @return {device}                                       - The External Device object
     */
    createExternalDevice: function (deviceHost, deviceCredentials) {
        var externalDevice = {
            ip: deviceHost,
            credentials: deviceCredentials
        }
        return createDevice(externalDevice, { max_var_id_len: 50 }, console);
    },
};