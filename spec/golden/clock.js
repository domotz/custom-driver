/**
 * Deterministic Date and Math endowments for golden runs, so snapshots do not change between runs.
 * `new Date()`, `Date.now()` and `Date()` read FIXED_NOW; `new Date(x)` behaves normally.
 * Math.random is a seeded generator (mulberry32), reset for every run.
 */

const RealDate = Date;
const FIXED_NOW = RealDate.UTC(2026, 0, 15, 10, 0, 0);

function createDate() {
    function FixedDate(...args) {
        if (!new.target) {
            return new RealDate(FIXED_NOW).toString();
        }
        return args.length === 0 ? new RealDate(FIXED_NOW) : new RealDate(...args);
    }
    FixedDate.prototype = RealDate.prototype;
    FixedDate.now = () => FIXED_NOW;
    FixedDate.parse = RealDate.parse;
    FixedDate.UTC = RealDate.UTC;
    return FixedDate;
}

function createMath(seed) {
    let state = seed >>> 0;
    const math = Object.create(Math);
    math.random = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return math;
}

const deterministicGlobals = () => ({ Date: createDate(), Math: createMath(42) });

module.exports = { deterministicGlobals, FIXED_NOW };
