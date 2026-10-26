/**
 * Fixture: issues an HTTP call while the script loads; the entry point only reports from its result.
 */
var loaded = new Promise(function (resolve) {
    D.device.http.get({ url: "/load-time" }, function (error, response, body) {
        resolve({ error: error, response: response, body: body });
    });
});

function validate() {
    loaded.then(function (result) {
        D.success([D.createVariable("status", "Status", String(result.response.statusCode))]);
    });
}
