/**
 * Fixture: raw socket that handles errors and reports from the data it receives.
 */
function validate() {
    const client = net.createConnection({ host: D.device.ip(), port: 4352 }, function () {
        client.write("%1POWR ?\r");
    });
    client.on("error", function () {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    });
    client.on("data", function (data) {
        D.success([D.createVariable("reply", "Reply", data.toString())]);
        client.end();
    });
}
