/**
 * Copyright (c) 2013 Sam Decrock https://github.com/SamDecrock/
 * All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var ntlmAuth = require('./ntlm_auth');
var basicAuth = require('./basic_auth');


exports.init = function (logger, platform) {
    var ret = {};

    var httpMethodCaller = function (logger, method, options, cb) {

        if (options.username.indexOf("\\") > 0) {
            if (!platform.supportsDomainAccountAuth()) {
                var errorMessage = "Domain account authentication is not supported on this platform";
                logger.warn(errorMessage);
                return cb(errorMessage);
            }
            ntlmAuth.ntlmauth(logger, method, options, cb);
        } else if (options.username.indexOf("\\") <= 0) {
            basicAuth.basicauth(logger, method, options, cb);
        }
    };

    ['get', 'put', 'patch', 'post', 'delete', 'options'].forEach(function (method) {
        ret[method] = httpMethodCaller.bind(null, logger, method);
    });

    return ret;
};
