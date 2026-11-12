/**
 * Fixture: legacy octal literal (SyntaxError in strict mode).
 */
// eslint-disable-next-line no-octal -- intentional: legacy octal literal, a SyntaxError under SES strict mode
var mode = 010;

function validate() {
    D.success([D.createVariable("mode", "Mode", mode)]);
}
