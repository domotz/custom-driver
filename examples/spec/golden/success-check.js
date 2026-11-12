/**
 * Checks a golden run's report against what production accepts and against the driver's companion
 * .json. Limits mirror remote_pawn_ng src/sandbox:
 *   - variables: library/metric.js validateMetric (uid 1..50 chars, not a reserved path segment; name
 *     up to 100 chars; value up to 500 chars; valueType from D.valueType) and sandbox.js
 *     validateVariables (a duplicate uid turns the success into PARSING_ERROR);
 *   - table: library/table.js createTable (label 1..50 chars) and validateColumnHeaders (label 1..30
 *     chars and not "Id", unit up to 10 chars, valueType from D.valueType).
 * Production rejects these at creation time; here they are checked on the reported objects.
 *
 * On top of that, two quality rules for a success fixture: a variable without a value and a table
 * without records are reported unless the case allows them (expect.nullValues, expect.allowEmptyTable).
 *
 * A backup (CONFIGURATION_MANAGEMENT drivers) is sent as is by sandbox.js successConfigurationManagement;
 * it must be a D.createBackup object whose running configuration is a non-empty string.
 *
 * checkSuccess(result, { entryPoint, companion, expect }) -> [problem]
 * normalizeReport(report) -> { type, variables, table } or { type, backup } as plain data (what the
 * snapshots store)
 */

const VALID_UID_RE = /^((?!((\/|^)(table|column|history)(\/|$))).)*$/;
const VALUE_TYPES = ["STRING", "NUMBER", "DATETIME", "RATE", "MONOTONE_RATE"];
const MAX_UID_LEN = 50;
const MAX_NAME_LEN = 100;
const MAX_VALUE_LEN = 500;
const MAX_TABLE_LABEL_LEN = 50;
const MAX_COLUMN_LABEL_LEN = 30;
const MAX_COLUMN_UNIT_LEN = 10;

const isEmpty = (v) => v === undefined || v === null;
const isText = (v, max) => typeof v === "string" && v.length >= 1 && v.length <= max;

function checkVariables(variables, expect) {
    const problems = [];
    if (!Array.isArray(variables)) {
        return ["variables is not an array: " + JSON.stringify(variables)];
    }
    const seen = new Set();
    const nullValues = expect.nullValues || [];
    variables.forEach((v, i) => {
        const where = "variable[" + i + "]" + (v && v.uid !== undefined ? " " + JSON.stringify(v.uid) : "");
        if (!v || typeof v !== "object") {
            problems.push(where + " is not a variable object");
            return;
        }
        const uid = typeof v.uid === "number" ? String(v.uid) : v.uid;
        if (!isText(uid, MAX_UID_LEN)) {
            problems.push(where + ": uid must be a string of 1.." + MAX_UID_LEN + " characters");
        } else if (!VALID_UID_RE.test(uid)) {
            problems.push(where + ": uid is a reserved word");
        } else if (seen.has(uid)) {
            problems.push(where + ": duplicate uid (production reports PARSING_ERROR)");
        }
        seen.add(uid);
        if (typeof v.name !== "string" || v.name.length > MAX_NAME_LEN) {
            problems.push(where + ": name must be a string of at most " + MAX_NAME_LEN + " characters");
        }
        if (isEmpty(v.value)) {
            if (!nullValues.includes(uid)) {
                problems.push(where + ": no value (allow it with expect.nullValues)");
            }
        } else if (String(v.value).length > MAX_VALUE_LEN) {
            problems.push(where + ": value longer than " + MAX_VALUE_LEN + " characters");
        }
        if (!isEmpty(v.valueType) && !VALUE_TYPES.includes(v.valueType)) {
            problems.push(where + ": invalid valueType " + JSON.stringify(v.valueType));
        }
    });
    return problems;
}

function checkTable(table, expect) {
    const problems = [];
    if (!isText(table.label, MAX_TABLE_LABEL_LEN)) {
        problems.push("table label must be a string of 1.." + MAX_TABLE_LABEL_LEN + " characters");
    }
    if (!Array.isArray(table.columnHeaders) || table.columnHeaders.length === 0) {
        return problems.concat("table has no column headers");
    }
    table.columnHeaders.forEach((h, i) => {
        const where = "column[" + i + "]" + (h && h.label ? " " + JSON.stringify(h.label) : "");
        if (!h || !isText(h.label, MAX_COLUMN_LABEL_LEN)) {
            problems.push(where + ": label must be a string of 1.." + MAX_COLUMN_LABEL_LEN + " characters");
        } else if (h.label === "Id") {
            problems.push(where + ": label \"Id\" is reserved");
        }
        if (h && h.unit !== undefined && !(typeof h.unit === "string" && h.unit.length <= MAX_COLUMN_UNIT_LEN)) {
            problems.push(where + ": unit must be a string of at most " + MAX_COLUMN_UNIT_LEN + " characters");
        }
        if (h && !isEmpty(h.valueType) && !VALUE_TYPES.includes(h.valueType)) {
            problems.push(where + ": invalid valueType " + JSON.stringify(h.valueType));
        }
    });
    if (table.records.length === 0 && !expect.allowEmptyTable) {
        problems.push("table has no records (allow it with expect.allowEmptyTable)");
    }
    return problems;
}

// expected_variables values are "[N]" (exactly N) or "[N,M]" (N to M): the number of independent
// variables, or the number of table columns besides the record id.
function parseRange(text) {
    const m = /^\[\s*(\d+)\s*(?:,\s*(\d+)\s*)?\]$/.exec(String(text));
    if (!m) {
        return null;
    }
    return { min: Number(m[1]), max: m[2] === undefined ? Number(m[1]) : Number(m[2]) };
}

function checkExpectedVariables(report, companion) {
    const declared = (companion && companion.expected_variables) || {};
    const problems = [];
    const counts = {
        independent: Array.isArray(report.variables) ? report.variables.length : 0,
        table: report.table ? report.table.columnHeaders.length : 0
    };
    Object.keys(declared).forEach((kind) => {
        const range = parseRange(declared[kind]);
        if (!range || !(kind in counts)) {
            problems.push("companion expected_variables." + kind + " = " + JSON.stringify(declared[kind]) + " is not understood");
            return;
        }
        if (counts[kind] < range.min || counts[kind] > range.max) {
            problems.push("companion expected_variables." + kind + " = " + declared[kind] + " but the driver reported " + counts[kind]);
        }
    });
    return problems;
}

// The reported success as plain data (the fake D has already moved a table passed first into table).
function normalizeReport(report) {
    if (!report || report.type !== "success") {
        return report ? { type: report.type, errorType: report.originalErrorType } : null;
    }
    const variables = report.variables;
    if (variables && typeof variables === "object" && !Array.isArray(variables) && !variables.isTable) {
        return { type: "success", backup: variables };
    }
    const table = report.table && report.table.isTable ? report.table : null;
    return {
        type: "success",
        variables: isEmpty(report.variables) ? null : report.variables,
        table: table ? { label: table.label, columnHeaders: table.columnHeaders, records: table.records } : null
    };
}

function checkSuccess(result, { entryPoint, companion, expect }) {
    const options = expect || {};
    const report = normalizeReport(result.firstReport);
    if (!report || report.type !== "success") {
        return ["expected D.success, got " + (report ? "D.failure(" + report.errorType + ")" : "no report")];
    }
    const problems = [];
    if (result.reports.length > 1) {
        problems.push("reported " + result.reports.length + " times: " + result.reports.map((r) => r.type + (r.errorType ? "(" + r.errorType + ")" : "")).join(", "));
    }
    if (entryPoint === "backup") {
        if (!report.backup || typeof report.backup.running !== "string" || report.backup.running.length === 0) {
            problems.push("backup must report D.createBackup({ running: <non-empty string> }), got " + JSON.stringify(report.backup || report.variables || null));
        }
        return problems;
    }
    if (report.backup) {
        problems.push("reported a backup object from " + entryPoint + ": " + JSON.stringify(report.backup).slice(0, 200));
    }
    if (!isEmpty(report.variables)) {
        problems.push(...checkVariables(report.variables, options));
    }
    if (report.table) {
        problems.push(...checkTable(report.table, options));
    }
    if (entryPoint === "get_status" && !options.skipExpectedVariables) {
        problems.push(...checkExpectedVariables(report, companion));
    }
    return problems;
}

module.exports = { checkSuccess, normalizeReport, parseRange };
