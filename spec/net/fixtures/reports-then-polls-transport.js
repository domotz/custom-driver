/**
 * Fixture: reports, then keeps polling over HTTP on a 60 s timer (harmless after the report).
 */
function poll() {
    D.device.http.get({ url: "/status" }, function () {
        setTimeout(poll, 60000);
    });
}

function validate() {
    D.success();
    poll();
}
