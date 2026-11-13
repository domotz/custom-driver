/**
 * Fixture: raw socket that arms an inactivity timer and reports when it fires.
 */
function validate() {
    const client = net.createConnection({ host: D.device.ip(), port: 4352 }, function () {
        client.write("%1POWR ?\r");
    });
    client.setTimeout(5000);
    client.on("timeout", function () {
        client.end();
        D.failure(D.errorType.TIMEOUT_ERROR);
    });
    client.on("error", function () {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    });
    client.on("close", function () {
        D.failure(D.errorType.GENERIC_ERROR);
    });
    client.on("data", function (data) {
        D.success([D.createVariable("reply", "Reply", data.toString())]);
        client.end();
    });
}
