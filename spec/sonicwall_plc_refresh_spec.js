// resources/sonicwall-plc-refresh.js against a synthetic copy of SonicWall's lifecycle page: a Next.js page whose
// data travels in self.__next_f.push([1, "..."]) string chunks, one flight line holding [[series, { type: rows }]].
const { extractTables, mergeTables } = require("../resources/sonicwall-plc-refresh");

const hardware = (sortid, model, lod, eos) => ({
    sorting_id: sortid, model, last_order_day: lod, arm_begin: "", arm_end: "", one_year_ldo: "", lrm_begin: "",
    lrm_end: "", end_of_support: eos
});

const firmware = (sortid, release, releaseDate) => ({
    sorting_id: sortid, release, model: "TZ270, TZ470", type_label: "GA", release_date: releaseDate, status: "Active",
    recommended_upgrade: "", end_of_support: ""
});

// The flight line is split across two pushes, as the real page does.
function page(tables) {
    const flight = "1:{\"theme\":\"light\"}\n2:" + JSON.stringify(tables) + "\n3:null\n";
    const half = Math.floor(flight.length / 2);
    return [flight.slice(0, half), flight.slice(half)]
        .map((chunk) => "<script>self.__next_f.push([1," + JSON.stringify(chunk) + "])</script>").join("");
}

const LIVE = [
    ["TZ Series", {
        Firmware: [firmware("SWTZ-F-90", "7.1.1", "2024-03-05")],
        Hardware: [hardware("SWTZ-H-20", "TZ 350", "2023-09-30", "2026-10-01"), hardware("SWTZ-H-65", "TZ470", "2026-06-30", "")]
    }],
    ["SuperMassive Series", { Hardware: [hardware("SWSM-H-5", "9200", "2020-01-31", "2025-01-31")] }]
];

const CURRENT = {
    "SonicWall TZ Series": {
        Firmware: { 0: { release: "6.5.4.13", model: "TZ350", type: "GA", rd: "01/01/2023", status: "Active", upgrade: null, eos: null, sortid: "SWTZ-F-02" } },
        Hardware: {
            0: { model: "TZ 350 Wireless", lod: "2023-09-30", armb: null, arme: null, oneyldo: null, lrmb: null, lrme: null, eos: "2026-04-16", sortid: "SWTZ-H-21" },
            1: { model: "TZ 350", lod: "2023-09-30", armb: null, arme: null, oneyldo: null, lrmb: null, lrme: null, eos: "2026-04-16", sortid: "SWTZ-H-20" }
        }
    },
    "SonicWall SuperMassive 9000 Series": { Hardware: {} },
    "SonicWall NSM On-Prem": { Software: { 0: { release: "2.3", sortid: "SWNSM-S-1" } } }
};

describe("SonicWall PLC refresh", function () {
    it("reads the series out of the flight payload, across chunks", function () {
        const tables = extractTables(page(LIVE));
        expect(tables.map((series) => series[0])).toEqual(["TZ Series", "SuperMassive Series"]);
        expect(tables[0][1].Hardware[1].model).toBe("TZ470");
    });

    it("refuses a page without lifecycle rows", function () {
        expect(() => extractTables("<html>challenge</html>")).toThrowError(/No lifecycle rows/);
    });

    it("refuses a table type it does not know", function () {
        expect(() => extractTables(page([["TZ Series", { Accessory: [{ sorting_id: "X-1" }] }]]))).toThrowError(/unknown table type/);
    });

    it("refuses a date that is not YYYY-MM-DD, before writing anything", function () {
        const bad = [["TZ Series", { Hardware: [hardware("SWTZ-H-65", "TZ470", "30/06/2026", "")] }]];
        expect(() => mergeTables(CURRENT, extractTables(page(bad)))).toThrowError(/SWTZ-H-65: last_order_day is not a YYYY-MM-DD date/);
    });

    describe("merging into the file", function () {
        let result;
        beforeEach(function () {
            result = mergeTables(JSON.parse(JSON.stringify(CURRENT)), extractTables(page(LIVE)));
        });

        it("updates listed rows, adds new ones and keeps rows the page no longer lists", function () {
            const rows = Object.values(result.table["SonicWall TZ Series"].Hardware);
            expect(rows.map((r) => r.sortid).sort()).toEqual(["SWTZ-H-20", "SWTZ-H-21", "SWTZ-H-65"]);
            expect(rows.find((r) => r.sortid === "SWTZ-H-20").eos).toBe("2026-10-01");
            expect(rows.find((r) => r.sortid === "SWTZ-H-21").model).toBe("TZ 350 Wireless");
            expect(rows.find((r) => r.sortid === "SWTZ-H-65")).toEqual({
                model: "TZ470", lod: "2026-06-30", armb: null, arme: null, oneyldo: null, lrmb: null, lrme: null, eos: null, sortid: "SWTZ-H-65"
            });
            expect(result.changes).toContain("SonicWall TZ Series Hardware: added SWTZ-H-65 TZ470");
            expect(result.changes).toContain("SonicWall TZ Series Hardware: updated SWTZ-H-20 TZ 350");
        });

        it("stores Hardware rows shortest model first, renumbered from 0", function () {
            const table = result.table["SonicWall TZ Series"].Hardware;
            expect(Object.keys(table)).toEqual(["0", "1", "2"]);
            expect([table[0].model, table[1].model, table[2].model]).toEqual(["TZ470", "TZ 350", "TZ 350 Wireless"]);
        });

        it("puts Hardware before Firmware", function () {
            expect(Object.keys(result.table["SonicWall TZ Series"])).toEqual(["Hardware", "Firmware"]);
        });

        it("keeps firmware release dates as MM/DD/YYYY", function () {
            const added = Object.values(result.table["SonicWall TZ Series"].Firmware).find((r) => r.sortid === "SWTZ-F-90");
            expect(added.rd).toBe("03/05/2024");
            expect(added.release).toBe("7.1.1");
        });

        it("files the page's SuperMassive Series under SuperMassive 9000 Series", function () {
            expect(result.table["SonicWall SuperMassive 9000 Series"].Hardware[0].sortid).toBe("SWSM-H-5");
            expect(result.table["SonicWall SuperMassive Series"]).toBeUndefined();
        });

        it("leaves series and Software tables the page does not refresh as they are", function () {
            expect(result.table["SonicWall NSM On-Prem"]).toEqual(CURRENT["SonicWall NSM On-Prem"]);
        });
    });
});
