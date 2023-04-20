/**
 * Copyright (c) 2013 Sam Decrock https://github.com/SamDecrock/
 * All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

var ntlm = require('./ntlm');
var _ = require('lodash');
var http = require('http');

exports.ntlmauth = function (logger, method, options, cb) {

    options.method = method;

    var ntlmOptions = {};

    if (!options.workstation) {
        ntlmOptions.workstation = '';
    }

    var splitUsername = options.username.split('\\');

    if (!options.domain) {
        ntlmOptions.domain = splitUsername[0];
    }

    ntlmOptions.username = splitUsername[1];
    ntlmOptions.password = options.password;

    // extract non-ntlm-options:
    var httpreqOptions = _.omit(options, 'url', 'username', 'password', 'workstation', 'domain');

    var keepaliveAgent;

    keepaliveAgent = new http.Agent({keepAlive: true});

    function sendType1Message(callback) {
        var type1msg = ntlm.createType1Message(ntlmOptions);

        var type1options = {
            headers: {
                'Connection': 'keep-alive',
                'Authorization': type1msg,
                'Content-Length': 0
            },
            timeout: options.timeout || 0,
            agent: keepaliveAgent,
            allowRedirects: false,
            method: method,
            host: options.host,
            port: options.port,
            path: options.path
        };

        var callbackCalled = false;

        logger.debug("Sending type 1 message %s", type1msg);

        var request = http.request(type1options, function (res) {
            res.on('close', function () {
                if (!callbackCalled) {
                    callbackCalled = true;
                    callback(null, res);
                }
            });

            res.on('end', function () {
                if (!callbackCalled) {
                    callbackCalled = true;
                    callback(null, res);
                }
            });

            res.on('data', function () {
                //listening on data is required to complete the request
            });
        });

        request.on('error', function (err) {
            logger.warn("sendType1Message error %s", err.toString());
            callback(err);
        });
        request.end();
    }

    function sendType3Message(res, callback) {
        // catch redirect here:
        if (res.headers.location) {
            options.url = res.headers.location;
            return exports[method](options, cb);
        }

        if (!res.headers['www-authenticate']) {
            var errorMessage = 'www-authenticate not found on response of second request';
            logger.warn(errorMessage);
            return callback(new Error(errorMessage));
        }

        logger.debug("Parsing type 2 message");
        var type2Info = ntlm.parseType2Message(res.headers['www-authenticate'], callback);
        var type2authType = type2Info[0];
        var type2msg = type2Info[1];
        logger.debug("type 2 auth type=%s, message=%s", type2authType, JSON.stringify(type2msg));
        if (!type2msg) {
            return;
        }

        var type3msg = ntlm.createType3Message(type2msg, ntlmOptions, type2authType);

        var type3options = {
            headers: {
                'Connection': 'Close',
                'Authorization': type3msg,
                'Content-Type': 'application/soap+xml;charset=UTF-8',
                'User-Agent': 'Domotz WinRM Client',
            },
            allowRedirects: false,
            agent: keepaliveAgent,

        };

        type3options.headers = _.extend(type3options.headers, httpreqOptions.headers);

        type3options = _.extend(type3options, _.omit(httpreqOptions, 'headers'));

        type3options.headers['Content-Length'] = options.body.length;

        var callbackCalled = false;
        var request = http.request(type3options, function (response) {

            var responsePayload = '';

            response.on('data', function (chunk) {
                responsePayload += chunk;
            });

            response.on('end', function () {
                if (response.statusCode < 200 || response.statusCode > 299) {
                    if (!callbackCalled) {
                        callbackCalled = true;
                        callback(response.statusCode, responsePayload);
                    }
                    return;
                }
                if (!callbackCalled) {
                    callbackCalled = true;
                    callback(null, responsePayload);
                }

            });

            if (response.statusCode < 200 || response.statusCode > 299) {
                response.on('end', function () {
                    if (!callbackCalled) {
                        callbackCalled = true;
                        callback(response.statusCode, responsePayload);
                    }
                });
            } else {
                response.on('close', function () {
                    if (!callbackCalled) {
                        callbackCalled = true;
                        callback(null, responsePayload);
                    }
                });
            }
        });
        request.write(new Buffer(options.body, 'utf8'));
        request.end();
    }

    sendType1Message(function (err, res) {
        if (err) {
            logger.warn("Error %s %s", err, res);
            return cb(err);
        }
        setImmediate(function () {
            sendType3Message(res, cb);
        });
    });
};
