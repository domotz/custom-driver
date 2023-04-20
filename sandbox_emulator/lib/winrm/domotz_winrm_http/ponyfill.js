var bigInt = require("big-integer");

function wrtBigUInt64LEBackport(buf, value, offset) {
    offset = offset === undefined ? 0 : offset;
    var lo = Number(bigInt(value) & bigInt(0xffffffff));
    buf[offset++] = lo;
    lo = lo >> 8;
    buf[offset++] = lo;
    lo = lo >> 8;
    buf[offset++] = lo;
    lo = lo >> 8;
    buf[offset++] = lo;
    var hi = Number(bigInt(value).shiftRight(bigInt(32).and(bigInt(0xffffffff))));
    buf[offset++] = hi;
    hi = hi >> 8;
    buf[offset++] = hi;
    hi = hi >> 8;
    buf[offset++] = hi;
    hi = hi >> 8;
    buf[offset++] = hi;
    return offset;
}


exports.wrtBigUInt64LEBackport = wrtBigUInt64LEBackport;