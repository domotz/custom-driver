/**
 * Fixture: dereferences the WinRM outcome without checking for an error (unwrapped callback).
 */
function validate() {
    D.device.sendWinRMCommand({ command: "hostname" }, function (output) {
        const name = output.outcome.stdout.trim();
        D.success([D.createVariable("name", "Name", name)]);
    });
}
