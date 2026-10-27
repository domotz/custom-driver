/**
 * Fixture: a missing parameter makes the entry point's sync body throw a TypeError.
 */
function validate() {
    const hosts = D.getParameter("missing").split(",");
    D.success([D.createVariable("hosts", "Hosts", hosts.length)]);
}
