/**
 * Fixture: calls require(), which the sandbox does not allow.
 */
function validate() {
    // eslint-disable-next-line no-undef -- intentional: require is not a sandbox global
    const fs = require("fs");
    D.success([D.createVariable("fs", "fs", typeof fs)]);
}
