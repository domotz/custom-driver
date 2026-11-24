// Simulated Sony Bravia (FW-50BU35J) replies. Shape follows the Bravia Professional Display / BRAVIA Simple IP
// REST API: JSON-RPC style POSTs to /sony/system (getPowerStatus, setPowerStatus) and /sony/avContent
// (getPlayingContentInfo), authenticated with the X-Auth-PSK header. Replies are {"result":[...],"id":1}; an
// error is {"error":[code,"message"],"id":1} (7 "Illegal State" while the panel is in standby).
// The fixed clock is Thursday 2026-01-15 10:00 UTC.
const reply = require("../../replies");

const PSK = "0000";
const post = (url, method, body, params) => ({
    kind: "http", method: "post", target: url, headers: { "X-Auth-PSK": PSK }, body: new RegExp('"method":"' + method + '"' + (params ? ".*" + params : "")), reply: reply.http(200, body)
});
const power = (status) => post("/sony/system", "getPowerStatus", { result: [{ status }], id: 1 });
const setPower = (on) => post("/sony/system", "setPowerStatus", { result: [], id: 1 }, on ? '"status":true' : '"status":false');
const playing = (info) => post("/sony/avContent", "getPlayingContentInfo", info);

const workHours = { sonyPreSharedKey: PSK, startTime: "08:00", endTime: "18:00", weekDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], datesToExclude: ["None"] };

// Every case runs every entry point (the spec requires it); only get_status differs between cases.
const entryPoints = (statusCalls, validateStatus) => ({
    validate: { calls: [power(validateStatus)] },
    get_status: { calls: statusCalls },
    custom_1: { calls: [setPower(true)] },
    custom_2: { calls: [setPower(false)] }
});

module.exports = {
    cases: [
        {
            name: "standby inside working hours, turned on",
            parameters: workHours,
            entryPoints: entryPoints([
                power("standby"), setPower(true), power("active"),
                playing({ result: [{ uri: "extInput:hdmi?port=2", source: "extInput:hdmi", title: "HDMI 2" }], id: 1 })
            ], "standby")
        },
        {
            name: "active outside the schedule, turned off",
            parameters: Object.assign({}, workHours, { weekDays: ["Saturday", "Sunday"] }),
            entryPoints: entryPoints([
                power("active"), setPower(false), power("standby"),
                playing({ error: [7, "Illegal State"], id: 1 })
            ], "active")
        },
        {
            name: "active on a broadcast channel inside the schedule",
            parameters: Object.assign({}, workHours, { datesToExclude: ["12/25/2026"] }),
            entryPoints: entryPoints([
                power("active"), power("active"),
                playing({ result: [{ uri: "tv:dvbt?trip=1.2.3&srvName=BBC One", source: "tv:dvbt", title: "BBC One", programTitle: "News" }], id: 1 })
            ], "active")
        }
    ]
};
