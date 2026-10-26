/**
 * Fixture: implicit global at top level (ReferenceError in strict mode).
 */
// eslint-disable-next-line no-undef -- intentional: implicit global, a ReferenceError under SES strict mode
x = 1;

function validate() {
    D.success();
}
