// Simulated Shure MXA910 ceiling array microphone replies (this driver speaks the Shure control protocol on
// TCP 2202 through sendTelnetCommand, although it lives in the http folder). Shape follows the Shure MXA command
// strings reference: commands are "< GET <PARAM> >" / "< SET <PARAM> <value> >" and the device answers
// "< REP <PARAM> <value> >", strings in braces ("< REP SERIAL_NUM {2105AB1234} >"), DEVICE_AUDIO_MUTE ON|OFF.
const reply = require("../../replies");

const cmd = (text, answer) => ({ kind: "telnet", method: "sendTelnetCommand", target: "< " + text + " >\r\n", reply: reply.telnet(answer) });
const rep = (param, value) => "< REP " + param + " " + value + " >";

const set = (value, resulting) => cmd("SET DEVICE_AUDIO_MUTE " + value, rep("DEVICE_AUDIO_MUTE", resulting));

const entryPoints = (mute, serial, firmware) => ({
    validate: { calls: [cmd("GET DEVICE_AUDIO_MUTE", rep("DEVICE_AUDIO_MUTE", mute))] },
    get_status: {
        calls: [
            cmd("GET DEVICE_AUDIO_MUTE", rep("DEVICE_AUDIO_MUTE", mute)),
            cmd("GET SERIAL_NUM", rep("SERIAL_NUM", "{" + serial + "}")),
            cmd("GET FW_VER", rep("FW_VER", "{" + firmware + "}"))
        ]
    },
    custom_1: { calls: [set("ON", "ON")] },
    custom_2: { calls: [set("OFF", "OFF")] },
    custom_3: { calls: [set("TOGGLE", mute === "ON" ? "OFF" : "ON")] }
});

module.exports = {
    cases: [
        { name: "unmuted microphone", entryPoints: entryPoints("OFF", "2105AB1234", "5.5.3.2") },
        { name: "muted microphone", entryPoints: entryPoints("ON", "2208CD5678", "5.1.0.9") }
    ]
};
