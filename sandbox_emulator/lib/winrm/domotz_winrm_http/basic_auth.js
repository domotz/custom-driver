/**
 * Copyright (c) 2013 Sam Decrock https://github.com/SamDecrock/
 * All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

var http = require('http');


exports.basicauth = function (logger, method, options, cb) {
    var auth = 'Basic ' + new Buffer(options.username + ':' + options.password, 'utf8').toString('base64');

    var basicAuthOptions = {
        host: options.host,
        port: options.port,
        path: '/wsman',
        method: method,
        headers: {
            'Authorization': auth,
            'Content-Type': 'application/soap+xml;charset=UTF-8',
            'User-Agent': 'Domotz WinRM Client',
            'Content-Length': Buffer.byteLength(options.body)
        }
    };

    var request = http.request(basicAuthOptions, function (response) {

        var responsePayload = '';

        response.on('data', function (chunk) {
            responsePayload += chunk;
        });

        if (response.statusCode < 200 || response.statusCode > 299) {
            response.on('end', function () {
                cb(response.statusCode, responsePayload);
            });
        } else {
            response.on('end', function () {
                cb(null, responsePayload);
            });
        }
    });

    request.write(options.body);
};

