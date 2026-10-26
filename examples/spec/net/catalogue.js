/**
 * Driver discovery and parameter synthesis for the robustness net.
 *
 * discoverDrivers(examplesRoot) -> [{ path, source, entryPoints }]
 * parametersFor(driver) -> { [name]: value } fed to the fake D's getParameter.
 */

const fs = require("fs");
const path = require("path");

const DRIVER_DIRS = ["http", "icmp", "snmp", "ssh", "telnet", "winrm"];
// Procedures the platform can invoke (remote_pawn_ng src/sandbox/context.js): validate, get_status and
// custom_N for generic drivers (context.js:308), validate and backup for configuration-management
// drivers (context.js:429), restore for a configuration-management restore (context.js:533-538,
// "should be passed to restore()"; no catalogue driver defines it yet). The sandbox runs whatever
// call the backend appends to the script (sandbox.js:313), so the names are a platform contract.
// A declaration may follow a JSDoc block on the same line ("*/function validate() {").
const ENTRY_POINT_RE = /^\s*(?:\*\/\s*)?function (validate|get_status|backup|restore|custom_\d+)\s*\(/gm;
const ENTRY_POINT_ORDER = ["validate", "get_status", "backup", "restore"];
const PARAM_RE = /D\.getParameter\(\s*(["'])([^"']+)\1\s*\)/g;
const DEFAULT_VALUE = "test";

const JSDOC_DEFAULTS = {
    NUMBER: 1,
    LIST: ["all"],
    SECRET_TEXT: DEFAULT_VALUE,
    STRING: DEFAULT_VALUE
};

function listJs(dir) {
    return fs.readdirSync(dir, { withFileTypes: true })
        .flatMap((e) => {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                return e.name === "node_modules" ? [] : listJs(p);
            }
            return e.name.endsWith(".js") ? [p] : [];
        })
        .sort();
}

function entryPointsOf(source) {
    const found = new Set([...source.matchAll(ENTRY_POINT_RE)].map((m) => m[1]));
    const order = (n) => (ENTRY_POINT_ORDER.includes(n) ? ENTRY_POINT_ORDER.indexOf(n) : ENTRY_POINT_ORDER.length);
    return [...found].sort((a, b) => order(a) - order(b) || Number(a.slice(7)) - Number(b.slice(7)));
}

function discoverDrivers(examplesRoot) {
    return DRIVER_DIRS
        .filter((d) => fs.existsSync(path.join(examplesRoot, d)))
        .flatMap((d) => listJs(path.join(examplesRoot, d)))
        .map((file) => {
            const source = fs.readFileSync(file, "utf8");
            return {
                path: path.relative(examplesRoot, file).split(path.sep).join("/"),
                file,
                source,
                entryPoints: entryPointsOf(source)
            };
        });
}

function companionParameters(driver) {
    const file = driver.file || path.join(driver.root || "", driver.path);
    const companion = file.replace(/\.js$/, ".json");
    if (!fs.existsSync(companion)) {
        return [];
    }
    try {
        return JSON.parse(fs.readFileSync(companion, "utf8")).parameters || [];
    } catch {
        return [];
    }
}

// The @type of the JSDoc block that directly precedes the statement reading `name`.
function jsdocType(source, index) {
    const before = source.slice(0, index);
    const end = before.lastIndexOf("*/");
    if (end < 0) {
        return null;
    }
    const gap = before.slice(end + 2);
    if (gap.length > 200 || /[;}]/.test(gap)) {
        return null;
    }
    const start = before.lastIndexOf("/**", end);
    const types = [...before.slice(start, end).matchAll(/@type\s+\{?([A-Z_]+)\}?/g)];
    return types.length ? types[types.length - 1][1] : null;
}

const hasValue = (e) => e && e.value !== undefined && e.value !== null && e.value !== "";

// The collector hands NUMBER parameters to the driver as numbers; companion files often store "4352".
function typed(entry) {
    if (entry.value_type === "NUMBER" && typeof entry.value === "string" && entry.value.trim() !== "" && !Number.isNaN(Number(entry.value))) {
        return Number(entry.value);
    }
    return entry.value;
}

// Resolves every parameter the driver reads: { name: { value, from: "companion"|"jsdoc"|"default" } }.
function resolveParameters(driver) {
    const resolved = {};
    const fromCompanion = {};
    for (const p of companionParameters(driver)) {
        fromCompanion[p.name] = p;
    }
    const fallback = (entry, jsdoc) => {
        const type = (entry && entry.value_type) || jsdoc;
        if (type in JSDOC_DEFAULTS) {
            return { value: JSDOC_DEFAULTS[type], from: entry && entry.value_type ? "companion-type" : "jsdoc" };
        }
        return { value: DEFAULT_VALUE, from: "default" };
    };
    for (const m of driver.source.matchAll(PARAM_RE)) {
        const name = m[2];
        if (name in resolved) {
            continue;
        }
        const entry = fromCompanion[name];
        resolved[name] = hasValue(entry)
            ? { value: typed(entry), from: "companion" }
            : fallback(entry, jsdocType(driver.source, m.index));
    }
    for (const [name, entry] of Object.entries(fromCompanion)) {
        if (!(name in resolved)) {
            resolved[name] = hasValue(entry) ? { value: typed(entry), from: "companion" } : fallback(entry, null);
        }
    }
    return resolved;
}

function parametersFor(driver) {
    return Object.fromEntries(Object.entries(resolveParameters(driver)).map(([k, v]) => [k, v.value]));
}

module.exports = { discoverDrivers, parametersFor, resolveParameters };
