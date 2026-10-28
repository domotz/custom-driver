// Simulated BluOS (Bluesound NODE 2i, BluOS 4.x) replies. Shape follows the BluOS Custom Integration API
// (port 11000): GET /Status answers <status etag="..."> with one element per field (state play|pause|stream|stop,
// volume 0-100, db, mute 0|1, canSeek 0|1, repeat 0|1|2, shuffle 0|1, secs, title1-3, image, quality,
// streamFormat, syncStat, ...). Action calls (/Preset, /Volume, /Pause) answer a small XML document with the
// resulting <state>/<volume>; /reboot is a POST to the web server on port 80. The reply bodies of the actions are
// approximate: the driver only logs them.
const reply = require("../../replies");

const xml = (body) => reply.http(200, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + body, { "content-type": "text/xml" });
const get = (target, body) => ({ kind: "http", method: "get", target, reply: xml(body) });

const status = (f) => '<status etag="' + f.etag + '">\n'
    + "<canMovePlayback>" + f.canMove + "</canMovePlayback>\n<canSeek>" + f.canSeek + "</canSeek>\n<cursor>" + f.cursor + "</cursor>\n"
    + "<db>" + f.db + "</db>\n<image>" + f.image + "</image>\n<indexing>0</indexing>\n<mid>1</mid>\n<mode>" + f.mode + "</mode>\n"
    + "<mute>" + f.mute + "</mute>\n<pid>" + f.pid + "</pid>\n<preset_id>" + f.preset + "</preset_id>\n<quality>" + f.quality + "</quality>\n"
    + "<repeat>" + f.repeat + "</repeat>\n<shuffle>" + f.shuffle + "</shuffle>\n<sid>" + f.sid + "</sid>\n<song>" + f.song + "</song>\n"
    + "<state>" + f.state + "</state>\n<stationImage>" + f.stationImage + "</stationImage>\n<streamFormat>" + f.format + "</streamFormat>\n"
    + "<streamUrl>" + f.streamUrl + "</streamUrl>\n<syncStat>" + f.syncStat + "</syncStat>\n<title1>" + f.t1 + "</title1>\n"
    + "<title2>" + f.t2 + "</title2>\n<title3>" + f.t3 + "</title3>\n<volume>" + f.volume + "</volume>\n<secs>" + f.secs + "</secs>\n</status>\n";

const playing = status({
    etag: "a1b2c3", canMove: "true", canSeek: "1", cursor: "4", db: "-28.5", image: "/Artwork?service=Qobuz&songid=123", mode: "1", mute: "0",
    pid: "117", preset: "2", quality: "cd", repeat: "2", shuffle: "1", sid: "6", song: "3", state: "play", stationImage: "", format: "FLAC 44100/16/2",
    streamUrl: "", syncStat: "17", t1: "Kind of Blue", t2: "Miles Davis", t3: "So What", volume: "25", secs: "143"
});
const pausedMuted = status({
    etag: "d4e5f6", canMove: "false", canSeek: "0", cursor: "0", db: "-80", image: "/Artwork?service=TuneIn", mode: "0", mute: "1",
    pid: "118", preset: "", quality: "mp3", repeat: "0", shuffle: "2", sid: "3", song: "0", state: "pause", stationImage: "http://cdn.example.com/s.png", format: "MP3 128",
    streamUrl: "RadioParadise:", syncStat: "21", t1: "Radio Paradise", t2: "", t3: "", volume: "0", secs: "0"
});

const actions = () => ({
    custom_1: { calls: [get("/Preset?id=1", "<state>play</state>")] },
    custom_2: { calls: [get("/Preset?id=2", "<state>play</state>")] },
    custom_3: { calls: [get("/Preset?id=3", "<state>play</state>")] },
    custom_4: { calls: [get("/Volume?db=5", "<state>play</state>")] },
    custom_5: { calls: [get("/Volume?db=-5", "<state>play</state>")] },
    custom_6: { calls: [get("/Pause?toggle=1", "<state>pause</state>")] },
    custom_7: { calls: [{ kind: "http", method: "post", target: "/reboot?yes=yes", reply: xml("<reboot>yes</reboot>") }] }
});

const entryPoints = (body) => Object.assign({
    validate: { calls: [get("/Status", body)] },
    get_status: { calls: [get("/Status", body)] }
}, actions());

module.exports = {
    cases: [
        { name: "playing from a streaming service", entryPoints: entryPoints(playing) },
        { name: "paused and muted on internet radio", entryPoints: entryPoints(pausedMuted) }
    ]
};
