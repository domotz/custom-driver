/**
 * Fixture: JSON.parse of the body inside a (wrapped) HTTP callback.
 */
function validate() {
    D.device.http.get({ url: "/status" }, function (error, response, body) {
        const data = JSON.parse(body);
        D.success([D.createVariable("status", "Status", data.status)]);
    });
}
