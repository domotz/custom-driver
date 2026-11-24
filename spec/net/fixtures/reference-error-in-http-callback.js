/**
 * Fixture: an implicit global assigned on the error path of a wrapped HTTP callback
 * (ReferenceError under SES strict mode).
 *
 * Note: under SES a *call* to an undeclared function (e.g. a `checkSsherr` typo) is a TypeError
 * ("checkSsherr is not a function"), because free-variable reads yield undefined in a Compartment;
 * only assignments to undeclared names throw ReferenceError. Call typos are caught by eslint no-undef.
 */
function validate() {
    D.device.http.get({ url: "/status" }, function (error, response, body) {
        if (error) {
            // eslint-disable-next-line no-undef -- intentional: implicit global, a ReferenceError under SES strict mode
            lastError = error;
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        D.success();
    });
}
