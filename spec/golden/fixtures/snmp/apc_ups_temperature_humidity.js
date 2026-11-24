// Source: PowerNet-MIB iemStatusProbesTable (1.3.6.1.4.1.318.1.1.10.2.3.2.1) on a Smart-UPS with two
// environmental probes. Columns: 1 index, 2 name, 3 status (2 = connected), 4 current temp,
// 5 temp units (1 = celsius), 6 current humidity, 7/8 high/low temp threshold, 9/10 high/low humidity
// threshold. The sandbox walk returns every value as a string, column by column.
const reply = require("../../replies");

const TABLE = "1.3.6.1.4.1.318.1.1.10.2.3.2";
const COLUMNS = {
    1: ["1", "2"],
    2: ["Server Room", "Rack 4 Rear"],
    3: ["2", "2"],
    4: ["23", "31"],
    5: ["1", "1"],
    6: ["41", "35"],
    7: ["40", "40"],
    8: ["10", "10"],
    9: ["80", "80"],
    10: ["10", "10"]
};

const walk = {};
Object.keys(COLUMNS).forEach((column) => {
    COLUMNS[column].forEach((value, i) => {
        walk[TABLE + ".1." + column + "." + (i + 1)] = value;
    });
});

module.exports = {
    cases: [{
        name: "two probes, celsius",
        entryPoints: {
            validate: {
                calls: [{ kind: "snmp", method: "walk", target: TABLE, reply: reply.snmp(walk) }]
            },
            get_status: {
                calls: [{ kind: "snmp", method: "walk", target: TABLE, reply: reply.snmp(walk) }]
            }
        }
    }]
};
