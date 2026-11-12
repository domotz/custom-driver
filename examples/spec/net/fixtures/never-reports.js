/**
 * Fixture: the callback does nothing, so the driver never reports.
 */
function validate() {
    D.device.http.get({ url: "/status" }, function (error, response, body) {
        console.info("got a reply, forgot to report");
    });
}
