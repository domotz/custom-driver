/**
 * Fixture: JSON.parse of an empty config at load time (a runtime SyntaxError on bad input).
 */
var config = JSON.parse(D.getParameter("cfg") || "");

function validate() {
    D.success([D.createVariable("mode", "Mode", config.mode)]);
}
