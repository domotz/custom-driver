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

    it("finds validate in every driver", () => {
        for (const d of drivers) {
            expect(d.entryPoints).withContext(d.path).toContain("validate");
        }
    });

    it("finds every top-level function documented as a @remote_procedure", () => {
        // A JSDoc block, then (on the same or the next lines) a top-level function declaration.
        const documented = /^\s*\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*(?:async\s+)?function\s+(\w+)\s*\(/gm;
        // winrm/windows_host_users.js: the "Validate WinRM" @remote_procedure block sits above the
        // helper parseValidateOutput(); the validate() it describes follows right after it.
        const misplacedJsdoc = new Set(["winrm/windows_host_users.js parseValidateOutput"]);
        let checked = 0;
        for (const d of drivers) {
            for (const m of d.source.matchAll(documented)) {
                if (!/@remote_procedure\b/.test(m[1]) || misplacedJsdoc.has(`${d.path} ${m[2]}`)) {
                    continue;
                }
                checked += 1;
                expect(d.entryPoints).withContext(d.path).toContain(m[2]);
            }
        }
        expect(checked).toBeGreaterThan(drivers.length);
        for (const key of misplacedJsdoc) {
            const [file, name] = key.split(" ");
            expect(byPath(file).source).withContext(key).toMatch(new RegExp(`function ${name}\\s*\\(`));
        }
    });

    it("finds backup in configuration-management drivers", () => {
        const withBackup = drivers.filter((d) => /^function backup\s*\(/m.test(d.source));
        expect(withBackup.length).toBeGreaterThan(0);
        for (const d of withBackup) {
            expect(d.entryPoints).withContext(d.path).toEqual(jasmine.arrayContaining(["validate", "backup"]));
        }
        expect(byPath("ssh/huawei_switch_configuration_backup.js").entryPoints).toEqual(["validate", "backup"]);
    });

    it("finds declarations written right after a JSDoc block (*/function validate)", () => {
        expect(byPath("telnet/epson_projector_via_pj_link.js").entryPoints)
            .toEqual(["validate", "get_status", "custom_1", "custom_2"]);
        expect(byPath("http/neat_pulse_monitoring.js").entryPoints).toEqual(["validate", "get_status", "custom_1"]);
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
