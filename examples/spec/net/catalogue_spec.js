const fs = require("fs");
const path = require("path");
const { discoverDrivers, parametersFor } = require("./catalogue");

const ROOT = path.resolve(__dirname, "..", "..");
const DIRS = ["http", "icmp", "snmp", "ssh", "telnet", "winrm"];

function countJs(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            return n + countJs(p);
        }
        return n + (e.name.endsWith(".js") ? 1 : 0);
    }, 0);
}

describe("driver catalogue", () => {
    const drivers = discoverDrivers(ROOT);
    const byPath = (p) => drivers.find((d) => d.path === p);

    it("finds every driver and none of the specs", () => {
        const expected = DIRS.reduce((n, d) => n + countJs(path.join(ROOT, d)), 0);
        expect(drivers.length).toBe(expected);
        expect(drivers.some((d) => d.path.startsWith("spec/") || d.path.includes("node_modules"))).toBe(false);
    });

    it("finds validate, get_status and custom entry points", () => {
        expect(byPath("http/apache2_status.js").entryPoints).toEqual(["validate", "get_status"]);
        expect(byPath("ssh/crestron_touch_screen.js").entryPoints).toContain("custom_1");
        expect(typeof byPath("http/apache2_status.js").source).toBe("string");
    });

    it("takes parameter defaults from the companion json", () => {
        expect(parametersFor(byPath("winrm/failed_login.js")).hours).toBe(24);
    });

    it("coerces companion NUMBER strings and keeps SECRET_TEXT defaults", () => {
        const params = parametersFor(byPath("telnet/epson_projector_via_pj_link.js"));
        expect(params.defaultTcpPort).toBe(4352);
        expect(params.pwd).toBe("test");
    });

    it("falls back to JSDoc @type when there is no companion value", () => {
        const source = [
            "/**", " * @type NUMBER", " */", "var port = D.getParameter(\"port\");",
            "/**", " * @type LIST", " */", "const hosts = D.getParameter('hosts');",
            "/**", " * @type SECRET_TEXT", " */", "var pwd = D.getParameter(\"pwd\");",
            "var other = D.getParameter(\"other\");"
        ].join("\n");
        const params = parametersFor({ path: "ssh/nonexistent_driver.js", source, entryPoints: [] });
        expect(params).toEqual({ port: 1, hosts: ["all"], pwd: "test", other: "test" });
    });

    it("gives every parameter of every driver a non-null value", () => {
        for (const d of drivers) {
            for (const [name, value] of Object.entries(parametersFor(d))) {
                expect(value).withContext(`${d.path} ${name}`).not.toBeNull();
                expect(value).withContext(`${d.path} ${name}`).not.toBeUndefined();
            }
        }
    });
});
