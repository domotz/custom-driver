/**
 * Fixture: reports, then a timer callback throws (uncaught in production).
 */
function validate() {
    D.success();
    setTimeout(function () {
        throw new Error("late crash");
    }, 50);
}
