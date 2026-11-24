/**
 * Fixture: a rejected promise nobody catches.
 */
function validate() {
    new Promise(function (_, reject) {
        reject(Error("x"));
    }).then(D.success);
}
