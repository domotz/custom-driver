var q = require('q');
var http = require('http');
var utils = require('./utils/uuid');
var winrmRemote = require("./winrm/remote").Remote;


var sandboxConsole;

var sandboxResourceLocator = {
    log: {
        decorateLogs: function () {
            return sandboxConsole;
        }
    },
    q: q,
    http: http,
    utils: utils
};

var winrmExec = function(command, console) {
    sandboxConsole = console;
    remote = winrmRemote("10.53.10.109", "5985", "winrm", "PASSWORD", sandboxResourceLocator);
    promise = remote.executeCommand(command).then(function (value) {
        console.log("STDOUT: %s", value.stdout)
        return value.stdout;
    });
    console.log("PROMISE TEST: %s", promise);
    return promise;
}

module.exports.winrmExec = winrmExec 