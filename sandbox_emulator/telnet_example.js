var telnet = require("telnet-client");
var connection = new telnet();

var params = {
    host: "cassandra.moome.io",
    port: 6379,
    // shellPrompt: ">",
    timeout: 10000,
    // echoLines: 20
    // removeEcho: 4
};

connection.on("ready", function(prompt) {
    connection.exec("info", function(err, response) {
        console.log(response);
        connection.end();
    });
});

connection.on("timeout", function() {
    console.log("socket timeout!");
    connection.end();
});

connection.on("error", function(err) {
    console.log("socket error!");
    connection.end();
});
connection.on("connect", function() {
    console.log("socket connected!");

    connection.send("auth password\r", function(err, response) {
        console.log(response);
        connection.send("info\r", function(err, response) {
            console.log(response);
            // connection.end();
        });
        // connection.end();
    });
});

connection.on("close", function() {
    console.log("connection closed");
});

connection.connect(params);