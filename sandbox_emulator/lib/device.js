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
 * @requires module:sandbox/library/ssh
 * @requires module:sandbox/library/snmp
 * @requires module:sandbox/library/telnet
 * @requires module:request
//  * @requires module:util
 * @copyright Copyright (C)  Domotz Inc
 */
/**
 * The Domotz Device object.
 * Exposes device related libraries for ssh, telnet, http remote call executions.
 * Contains device information such as its Custom Driver Management credentials and IP address
 * @example D.device
 * @namespace device
 * @memberof D
*/
var request = require("request");
// require("request-debug")(request)
// request.debug = true;
var ssh = require("./ssh");
var telnet = require("./telnet");
var winrm = require('./winrm');
var snmp = require("./snmp");
var {valueTypes} = require("./constants")
// const util = require("util");

/**
 * The Http Library Options
 * @typedef  {object}        HttpOptions
 * @property {string}        url             - The url suffix of the request target
 * @property {object}        [headers]       - The Request HTTP Headers defined as key value pairs. Eg {'Accept': 'text/html'}
 * @property {string}        [body]          - The Request HTTP Body
 * @property {integer}       [port=80]       - The port to use for the request. If protocol is set to https the default is 443
 * @property {string|object} [auth]          - The authentication to use. Eg 'basic' / {'bearer': 'the token'}
 * @property {string}        [username]      - The device username. If not set the custom driver management purpose one is used
 * @property {string}        [password]      - The device password. If not set the custom driver management purpose one is used
 * @property {boolean}       [jar=false]     - if true, remember cookies for future use
 * @property {http|https}    [protocol=http] - The protocol to use in the request
 */
 
/**
 * The Http library callback
 * @typedef  {callback} HttpCallback
 * @property {string} [error]      - The HTTP response error
 * @property {object} response     - The HTTP response object
 * @property {string} [body]       - The HTTP response body
 */

function createDevice(device, agentDriverSettings, myConsole) {
    function buildSnmpOptions(options) {
        if (!options) {
            options = {};
        }
        options.maxRepetitions = options.maxRepetitions || 24;
        options.timeout = options.timeout || 5000;
        // myConsole.debug(util.inspect(options));
        return options;
    }
    function buildTelnetOptions(options) {
        options.host = device.ip;
        if (options.command !== undefined) {
            options.cmd = options.command + "\r";
            delete options.command;
        } else {
            throw Error("D.sendTelnetCommand requires a 'command' in its options parameter");
        }
        // myConsole.debug(util.inspect(options));
        return options;
    }
    function buildSSHOptions(options) {
        options.host = device.ip;
        if (!options.username && device.credentials) {
            options.username = device.credentials.username;
            options.password = new Buffer(device.credentials.password, "base64").toString();
        }
        return options;
    }
    function buildRequest(options) {
        if (typeof options !== "object") {
            options = { url: "http://" + device.ip + options };
        } else {
            var protocol = "http";
            var port = "";
            var password = "";
            if (options.port) {
                port = ":" + options.port;
                delete options.port;
            }
            if( options.protocol === "https") {
                protocol = options.protocol;
                port = port || ":443";
                delete options.protocol;
            }
            if (device.credentials) {
                password = new Buffer(device.credentials.password, "base64").toString();
                options.url = options.url.replace("${username}", device.credentials.username);
                options.url = options.url.replace("${password}", password);
            }

            if (options.auth === "basic" && device.credentials) {
                options.auth = {
                    "user": device.credentials.username,
                    "pass": password,
                    "sendImmediately": true
                };
            } else {
                options.auth = undefined;
            }
            if (protocol !== "http" && protocol !== "https") {
                throw Error("Invalid protocol: " + protocol);
            }
            options.url = protocol + "://" + device.ip + port + options.url;
        }
        // myConsole.debug(util.inspect(options));
        return options;
    }
    function buildWinRMOptions(options) {
        options.host = device.ip;
        assertCommandInOptions(options, "D.sendWinRMCommand");
        addDefaultCredentials(options);
        return {payload: options};
    }
    function assertCommandInOptions(options, name) {
        if (!options.command) {
            throw Error(name + " requires a 'command' in its options parameter");
        }
    }
    function addDefaultCredentials(options) {
        if (!options.username && device.credentials) {
            options.username = device.credentials.username;
            options.password = new Buffer(device.credentials.password, 'base64').toString();
        }
    }

    return {
        /**
         * Returns stored username of a device.
         * @example 
         * // returns 'the device username'
         * D.device.username()
         * @memberof D.device
         * @readonly
         * @function
         * @return    {string}
         */
        username: function () {
            return device.credentials.username;
        },
        /**
         * Returns the stored password of a device.
         * @example 
         * // returns 'the device password'
         * D.device.password()
         * @memberof D.device
         * @readonly
         * @function
         * @return    {string}
         */
        password: function () {
            return new Buffer(device.credentials.password, "base64").toString();
        },        
        /**
         * Returns the IP address of the device object.
         * @example 
         * // returns '192.168.1.1' for a device with this local IP address
         * D.device.ip()
         * @memberof D.device
         * @readonly
         * @function
         * @return    {string}
         */
        ip: function () {
            return device.ip;
        },
        /**
         * Starts an SNMP session with the device.
         * @example 
         * // returns an snmpSession object to use for snmp related queries
         * D.device.createSNMPSession()
         * [See SNMP Driver Examples]{@link https://github.com/domotz/custom-driver/tree/master/examples/snmp}
         * @memberof D.device
         * @param {snmpSessionOptions}  options    - The SNMP Session Options
         * @readonly
         * @function
         * @return    {snmpSession}
         */
        createSNMPSession: function (options) {
            myConsole.info("Creating SNMP session for device: %s", device.ip);
            options = buildSnmpOptions(options);
            return snmp.createSessionForDevice(myConsole, device, options);
        },
        /**
         * Sends a command to the device via Telnet.
         * @example  
         * D.device.sendTelnetCommand(options, callback)
         * [See Telnet Driver Examples]{@link https://github.com/domotz/custom-driver/tree/master/examples/telnet}
         * @memberof D.device
         * @readonly
         * @param {TelnetOptions}  options    - The Telnet Command execution options
         * @param {TelnetCallback} callback   - The Telnet Command execution callback function
         * @function
         */
        sendTelnetCommand: function (options, callback) {
            myConsole.info("Performing Telnet Command: %s", options.command);
            options = buildTelnetOptions(options);
            telnet.sendTelnetCommand(myConsole, options, callback);
        },
        /**        
        * Sends a command to the device via SSH.
        * @example D.device.sendSSHCommand(options, callback)
        * @example 
        * [See SSH Driver Examples]{@link https://github.com/domotz/custom-driver/tree/master/examples/ssh}
        * @memberof D.device
        * @readonly
        * @param {SshOptions}  options    - The SSH Command execution options
        * @param {SshCallback}  callback  - The SSH Command execution callback function
        * @function
        */
        sendSSHCommand: function (options, callback) {
            options = buildSSHOptions(options);
            return ssh.sendSSHCommand(myConsole, options, callback);
        },               
        /**
         * Sends a sequence of commands to the device via SSH.
         * @private
         * @example D.device.sendSSHCommands(options, callback)
         * @memberof D.device
         * @readonly
         * @param {SshShellSequenceOptions}   options   - The SSH Commands execution options
         * @param {SshShellSequenceCallback}  callback  - The SSH Commands execution callback function
         * @function
         */
        sendSSHCommands: function (options, callback) {
            options = buildSSHOptions(options);
            ssh.sendSSHShellSequence(myConsole, options, callback);
        },
        /**
         * The Device HTTP library.
         * Allows drivers to execute HTTP(s) requests towards the device.
         * @example D.device.http
         * [See HTTP Driver Examples]{@link https://github.com/domotz/custom-driver/tree/master/examples/http}
         * @memberof D.device
         * @namespace http
        */
        /**        
        * Sends a command to the device via WinRM. Only basic authentication is supported. 
        * [WinRM setup instructions]{@link https://help.domotz.com/user-guide/os-monitoring-feature/#htoc-installing-using-domotz-powershell-script1}
        * @example D.device.sendWinRMCommand(options, callback)
        * @example 
        * [See WinRM Driver Examples]{@link https://github.com/domotz/custom-driver/tree/master/examples/winrm}
        * @memberof D.device
        * @readonly
        * @param {WinRMOptions}   options   - The WinRM Command execution options
        * @param {WinRMCallback}  callback  - The WinRM Command execution callback function
        * @function
        */
        sendWinRMCommand: function (options, callback) {
            options = buildWinRMOptions(options);
            return winrm.sendWinRMCommand(myConsole, options, callback);
        }, 
        http: {
            /**
             * Executes an HTTP GET request towards the device.
             * @example  D.device.http.get(options, callback)
             * @memberof D.device.http
             * @readonly
             * @param {HttpOptions}  options   - The HTTP request execution options
             * @param {HttpCallback} callback  - The HTTP request execution callback
             * @function
             */
            get: function (options, callback) {
                myConsole.info("Performing GET towards:" + options.url);
                options = buildRequest(options);
                request.get(options, callback);
            },
            /**
             * Executes an HTTP POST request towards the device.
             * @example D.device.http.post(options, callback)
             * @memberof D.device.http
             * @readonly
             * @param {HttpOptions}  options   - The HTTP request execution options
             * @param {HttpCallback} callback  - The HTTP request execution callback
             * @function
             */            
            post: function (options, callback) {
                myConsole.info("Performing POST towards:" + options.url);
                options = buildRequest(options);
                request.post(options, callback);
            },
            /**
             * Executes an HTTP PUT request towards the device.
             * @example D.device.http.put(options, callback)
             * @memberof D.device.http
             * @readonly
             * @param {HttpOptions}  options   - The HTTP request execution options
             * @param {HttpCallback} callback  - The HTTP request execution callback
             * @function
             */            
            put: function (options, callback) {
                myConsole.info("Performing PUT towards:" + options.url);
                options = buildRequest(options);
                request.put(options, callback);
            },
            /**
             * Executes an HTTP DELETE request towards the device.
             * @example D.device.http.delete(options, callback)
             * @memberof D.device.http
             * @readonly
             * @param {HttpOptions}  options   - The HTTP request execution options
             * @param {HttpCallback} callback  - The HTTP request execution callback
             * @function
             */            
            delete: function (options, callback) {
                myConsole.info("Performing DELETE towards:" + options.url);
                options = buildRequest(options);
                request.delete(options, callback);
            }            
        },
        /**
         * Creates a custom driver variable to be sent in the D.success callback.
         * @example 
         * // returns {"uid": "1a", "unit": "C", "value": 60, "label": "CPU Temperature"}
         * D.device.createVariable('1a', 'CPU Temperature', 60, 'C')
         * @memberof D.device
         * @function
         * @readonly
         * @param {string} uid   - The identifier of the variable. Must be Unique. Max 50 characters
         * @param {string} name  - The Name/Label of the variable
         * @param {string} value - The Value of the variable
         * @param {string} unit  - The Unit of measurement of the variable (eg %). Max 10 characters
         * @return {Variable}
         */        
        createVariable: function (uid, name, value, unit, valueType) {
            if (uid === null || uid === undefined || uid.length < 1 || uid.length > agentDriverSettings.max_var_id_len) {
                throw Error("Invalid variable uid: " + uid);
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
    };
}

module.exports.device = createDevice;