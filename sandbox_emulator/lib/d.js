// var snmp = require("net-snmp");
require("dotenv").config();
var dbManager = require("../lib/db");
var {valueTypes, errorTypes} = require("../lib/constants");
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
    },
    credentials:{
        username: "",
        password: ""
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
    success: async function (...args) {
        await dbManager.init();
        if (!args || !args.length) return;
        let dataToShow = [args[0]]//, args[1]]
        if(args[1]) dataToShow.push(args[1])
        await Promise.all(dataToShow.map(async function (vars, index) {
            if (!vars) return;
            if (vars && vars.getResult) {
                var result = vars.getResult();
                // saving table data
                await Promise.all(result.rows.map(function(row){
                    var row_id = row[0];
                    return Promise.all(row.map(async function(col, i){
                        if(index == 0) return null;
                        return dbManager.addVar({
                            host: device.ip,
                            row_id,
                            uid:result.columnHeaders[i].label,
                            label: result.columnHeaders[i].label,
                            unit: result.columnHeaders[i].unit,
                            value: col,
                            valueType: result.columnHeaders[i].valueType
                        }).then(function(res){
                            row[i] = res;
                        })
                    }))
                })).catch(function(err){
                    console.error("--------add table error----------")
                    console.error(err)
                })
                var maxLengths = result.columnHeaders.map(function(header) {return header.label.length}); //new Array(result.columnHeaders.length).fill(0)
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
                await Promise.all(vars.map(function(v){
                    return dbManager.addVar({
                        host:device.ip,
                        ...v
                    }).then(function(res){
                        v.value = res
                    })
                })).catch(function(err){
                    console.error("--------add variable error----------")
                    console.error(err)
                })
                vars.forEach(function (v) {
                    console.log(format(v.l, maxLength), "=", v.value);
                });
            }

        })).catch(function(err){
            console.error("--------exec error----------")
            console.error(err)
        })
    },
    failure: function (msg) {
        console.error(msg);
        process.exit(1);
    },
    errorTypes: errorTypes,
    valueType: valueTypes,
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