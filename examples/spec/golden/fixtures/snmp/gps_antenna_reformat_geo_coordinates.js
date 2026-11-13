// Simulated GPS antenna replies. The vendor MIB (enterprise 33721) is not published; the shape follows the driver's own
// comments: latitude/longitude are integer strings of degrees, minutes and decimal minutes ("3723132" = 37 deg 23.132'),
// heading is in thousandths of a degree, antenna status 1 = active, 0 = idle. validate reads sysDescr (SNMPv2-MIB).
// The snmp get answers OID -> string, one entry per requested OID.
const reply = require("../../replies");

const SYS_DESCR = "1.3.6.1.2.1.1.1.0";
const STATUS = "1.3.6.1.4.1.33721.3.2.2.1.7090.2.15.0";
const HEADING = "1.3.6.1.4.1.33721.3.1.3.3.1.4.0";
const LATITUDE = "1.3.6.1.4.1.33721.3.1.3.1.1.2.0";
const LONGITUDE = "1.3.6.1.4.1.33721.3.1.3.1.1.3.0";

const status = (value, lat, lon, heading) => [{
    kind: "snmp", method: "get", target: [LATITUDE, LONGITUDE, STATUS, HEADING].join(","),
    reply: reply.snmp({ [LATITUDE]: lat, [LONGITUDE]: lon, [STATUS]: value, [HEADING]: heading })
}];

const validate = [{ kind: "snmp", method: "get", target: SYS_DESCR, reply: reply.snmp({ [SYS_DESCR]: "GPS Antenna Controller v2.1" }) }];

module.exports = {
    cases: [{
        name: "active antenna",
        entryPoints: { validate: { calls: validate }, get_status: { calls: status("1", "3723132", "1323123", "123456") } }
    }, {
        name: "idle antenna",
        entryPoints: { validate: { calls: validate }, get_status: { calls: status("0", "4512345", "0912345", "270000") } }
    }]
};
