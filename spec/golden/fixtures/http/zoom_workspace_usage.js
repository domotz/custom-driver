// Simulated Zoom API v2 replies. Shape follows the Zoom Server-to-Server OAuth token reply (POST zoom.us/oauth/token),
// "List Zoom Rooms locations" (GET api.zoom.us/v2/rooms/locations: { page_size, next_page_token, locations: [{ id, name, parent_location_id, type }] })
// and the workspace usage reply the driver consumes (GET /v2/workspaces/usage?location_id=...: desk_usage, room_usage and
// total_usage, each { in_use, not_in_use }). The second location has every room in use, so a legitimate 0 must be reported.
const reply = require("../../replies");

const TOKEN = "eyJzdiI6IjAwMDAwMSIsImFsZyI6IkhTNTEyIn0.zoom-token";
const AUTH = { Authorization: "Bearer " + TOKEN };

const LOCATIONS = {
    page_size: 30,
    next_page_token: "",
    locations: [
        { id: "loc_milan", name: "Milan Office", parent_location_id: "loc_italy", type: "campus" },
        { id: "loc_london", name: "London Office", parent_location_id: "loc_uk", type: "campus" }
    ]
};

const usage = (desk, room) => ({
    desk_usage: desk,
    room_usage: room,
    total_usage: { in_use: desk.in_use + room.in_use, not_in_use: desk.not_in_use + room.not_in_use }
});

const token = () => ({
    kind: "http", method: "post", host: "zoom.us", target: "/oauth/token",
    reply: reply.http(200, { access_token: TOKEN, token_type: "bearer", expires_in: 3599, scope: "zoom_rooms:read:list_locations:admin" })
});
const locationsCall = () => ({ kind: "http", method: "get", host: "api.zoom.us", target: "/v2/rooms/locations", headers: AUTH, reply: reply.http(200, LOCATIONS) });
const usageCall = (id, body) => ({ kind: "http", method: "get", host: "api.zoom.us", target: "/v2/workspaces/usage?location_id=" + id, headers: AUTH, reply: reply.http(200, body) });

const caseFor = (name, locationName, id, body) => ({
    name,
    parameters: { accountId: "acc123", clientId: "client-id", clientSecret: "client-secret", locationName },
    entryPoints: {
        validate: { calls: [token(), locationsCall(), usageCall(id, body)] },
        get_status: { calls: [token(), locationsCall(), usageCall(id, body)] }
    }
});

module.exports = {
    cases: [
        caseFor("milan office with free desks", "Milan Office", "loc_milan", usage({ in_use: 12, not_in_use: 28 }, { in_use: 3, not_in_use: 5 })),
        caseFor("london office with no free room", "London Office", "loc_london", usage({ in_use: 7, not_in_use: 3 }, { in_use: 4, not_in_use: 0 }))
    ]
};
