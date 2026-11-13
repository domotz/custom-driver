// Simulated Zoom API v2 replies. Shape follows the Zoom Server-to-Server OAuth token reply (POST zoom.us/oauth/token), "List Zoom Rooms"
// (GET /v2/rooms: { page_size, next_page_token, rooms: [{ id, room_id, name, location_id, status }] }), "Get Zoom Rooms details" (GET
// /v2/metrics/zoomrooms/{id}: { id, room_name, ..., live_meeting: { id, meeting_number, topic, start_time } }, live_meeting is an empty object
// while no meeting runs) and "List meeting participants QoS" (GET /v2/metrics/meetings/{id}/participants/qos: { page_size, next_page_token,
// participants: [ { user_id, user_name, device, ip_address, user_qos: [ { date_time, audio_input, audio_output, video_input, video_output,
// as_input, as_output, ... } ] } ] }, each QoS block { bitrate, latency, jitter, avg_loss, max_loss } with values as strings such as "20 ms").
// The *_rwg blocks (Zoom web gateway) only exist for participants that joined through it.
const reply = require("../../replies");

const TOKEN = "eyJzdiI6IjAwMDAwMSIsImFsZyI6IkhTNTEyIn0.zoom-token";
const AUTH = { Authorization: "Bearer " + TOKEN };

const ROOMS = {
    page_size: 300, next_page_token: "",
    rooms: [
        { id: "r1", room_id: "room_001", name: "Boardroom", location_id: "loc_milan", status: "InMeeting" },
        { id: "r2", room_id: "room_002", name: "Huddle 2", location_id: "loc_london", status: "Available" },
        { id: "r3", room_id: "room_003", name: "Training", location_id: "loc_milan", status: "InMeeting" }
    ]
};

const details = (id, name, meeting) => ({
    id, room_name: name, calendar_name: name.toLowerCase() + "@contoso.com", status: meeting ? "InMeeting" : "Available", health: "healthy", location_id: "loc_milan",
    live_meeting: meeting || {}
});
const meeting = (id, topic) => ({ id, meeting_number: 91234567890, topic, start_time: "2026-01-15T09:30:00Z" });

const q = (latency, jitter) => ({ bitrate: "512 kbps", latency, jitter, avg_loss: "0.1%", max_loss: "0.4%" });
const qos = (blocks) => [Object.assign({ date_time: "2026-01-15T09:59:00Z" }, blocks)];
const full = (l, j) => ({ audio_input: q(l + " ms", j + " ms"), audio_output: q(l + " ms", j + " ms"), video_input: q(l + " ms", j + " ms"), video_output: q(l + " ms", j + " ms"), as_input: q(l + " ms", j + " ms"), as_output: q(l + " ms", j + " ms") });

// Boardroom: three participants. The third joined through the web gateway (extra *_rwg blocks) and has no content sharing (as_*) metrics.
const BOARD_QOS = {
    page_size: 300, next_page_token: "",
    participants: [
        { user_id: "u1", user_name: "Boardroom", device: "Zoom Rooms", ip_address: "10.0.0.20", user_qos: qos(full(20, 2)) },
        { user_id: "u2", user_name: "Alice Rossi", device: "Mac", ip_address: "10.0.0.31", user_qos: qos(full(40, 6)) },
        {
            user_id: "u3", user_name: "Bob Verdi", device: "Web", ip_address: "203.0.113.9",
            user_qos: qos({
                audio_input: q("60 ms", "10.5 ms"), audio_output: q("60 ms", "10.5 ms"), video_input: q("80 ms", "12 ms"), video_output: q("80 ms", "12 ms"),
                video_device_from_rwg: q("30 ms", "3 ms"), video_device_to_rwg: q("31 ms", "3.5 ms"), audio_device_from_rwg: q("15 ms", "1 ms"), audio_device_to_rwg: q("16 ms", "1.5 ms")
            })
        }
    ]
};
// Training room: a single audio-only participant.
const TRAIN_QOS = {
    page_size: 300, next_page_token: "",
    participants: [{ user_id: "u9", user_name: "Training", device: "Zoom Rooms", ip_address: "10.0.1.20", user_qos: qos({ audio_input: q("25 ms", "4 ms"), audio_output: q("28 ms", "5 ms") }) }]
};

const token = () => ({
    kind: "http", method: "post", host: "zoom.us", target: "/oauth/token",
    reply: reply.http(200, { access_token: TOKEN, token_type: "bearer", expires_in: 3599, scope: "zoom_rooms:read:list_rooms:admin" })
});
const get = (target, body) => ({ kind: "http", method: "get", host: "api.zoom.us", target, headers: AUTH, reply: reply.http(200, body) });
const calls = () => [
    token(),
    get("/v2/rooms?page_size=300", ROOMS),
    get("/v2/metrics/zoomrooms/room_001", details("room_001", "Boardroom", meeting("mtgBoard123", "Weekly sync"))),
    get("/v2/metrics/zoomrooms/room_002", details("room_002", "Huddle 2", null)),
    get("/v2/metrics/zoomrooms/room_003", details("room_003", "Training", meeting("mtgTrain456", "Onboarding"))),
    get("/v2/metrics/meetings/mtgBoard123/participants/qos?page_size=300", BOARD_QOS),
    get("/v2/metrics/meetings/mtgTrain456/participants/qos?page_size=300", TRAIN_QOS)
];

module.exports = {
    cases: [{
        name: "two rooms in a live meeting and an idle one",
        parameters: { accountId: "acc123", clientId: "client-id", clientSecret: "client-secret", roomIds: ["All"] },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
