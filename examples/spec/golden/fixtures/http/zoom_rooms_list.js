// Simulated Zoom API v2 replies. Shape follows the Zoom Server-to-Server OAuth token reply (POST zoom.us/oauth/token),
// "List Zoom Rooms" (GET api.zoom.us/v2/rooms: { page_size, next_page_token, rooms: [{ id, room_id, name,
// location_id, status }] }, status Available / Offline / InMeeting / UnderConstruction) and "Get location profile"
// (GET /v2/rooms/locations/{locationId}: { id, name, ..., basic: { name, address, timezone, ... } }).
const reply = require("../../replies");

const TOKEN = "eyJzdiI6IjAwMDAwMSIsImFsZyI6IkhTNTEyIn0.zoom-token";
const AUTH = { Authorization: "Bearer " + TOKEN };

const rooms = {
    page_size: 30,
    next_page_token: "",
    rooms: [
        { id: "r1", room_id: "room_001", name: "Boardroom", location_id: "loc_milan", status: "Available" },
        { id: "r2", room_id: "room_002", name: "Huddle 2", location_id: "loc_london", status: "Offline" },
        { id: "r3", room_id: "room_003", name: "Training", location_id: "loc_milan", status: "InMeeting" }
    ]
};

const location = (id, name, timezone) => ({
    kind: "http", method: "get", host: "api.zoom.us", target: "/v2/rooms/locations/" + id, headers: AUTH,
    reply: reply.http(200, { id, name, type: "campus", basic: { name, address: "1 Main Street", timezone } })
});

const token = () => ({
    kind: "http", method: "post", host: "zoom.us", target: "/oauth/token",
    reply: reply.http(200, { access_token: TOKEN, token_type: "bearer", expires_in: 3599, scope: "zoom_rooms:read:list_rooms:admin" })
});

const roomsCall = () => ({
    kind: "http", method: "get", host: "api.zoom.us", target: "/v2/rooms?page_size=30", headers: AUTH, reply: reply.http(200, rooms)
});

module.exports = {
    cases: [{
        name: "three rooms in two locations",
        parameters: { accountId: "acc123", clientId: "client-id", clientSecret: "client-secret", roomId: ["all"] },
        entryPoints: {
            validate: { calls: [token(), roomsCall()] },
            get_status: {
                calls: [
                    token(), roomsCall(),
                    // the driver asks for the location of every room, so Milan is requested twice
                    location("loc_milan", "Milan Office", "Europe/Rome"),
                    location("loc_london", "London Office", "Europe/London"),
                    location("loc_milan", "Milan Office", "Europe/Rome")
                ]
            }
        }
    }]
};
