/**
 * Fixture: polls forever with a timer and never reports (work stays pending until the limit).
 */
function poll() {
    setTimeout(poll, 1000);
}

function validate() {
    poll();
}
