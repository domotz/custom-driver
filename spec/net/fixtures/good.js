/**
 * Fixture: well-behaved driver, reports from its HTTP callback.
 */
function validate() {
    D.device.http.get({ url: "/status" }, function (error, response, body) {
        if (error || !response || response.statusCode !== 200) {
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        D.success();
    });
}
