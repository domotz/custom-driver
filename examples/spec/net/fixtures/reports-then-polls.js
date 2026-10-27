/**
 * Fixture: reports, then keeps a harmless timer loop going (still pending at the limit).
 */
function poll() {
    setTimeout(poll, 1000);
}

function validate() {
    D.success();
    poll();
}
