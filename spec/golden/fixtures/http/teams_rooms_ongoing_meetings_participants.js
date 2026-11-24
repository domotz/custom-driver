// Simulated Microsoft Graph replies. Shape follows the Microsoft identity platform v2.0 client-credentials token response, the Graph
// v1.0 "List rooms" reply (GET /places/microsoft.graph.room -> { value: [ room { id, displayName, emailAddress, ... } ] }) and the
// Graph v1.0 calendarView reply (GET /users/{id}/calendarView?startDateTime=&endDateTime= -> { "@odata.context", value: [ event { id,
// subject, start, end, organizer, attendees[] { type: required | optional | resource, status { response: none | organizer | tentativelyAccepted |
// accepted | declined | notResponded, time }, emailAddress { name, address } } } ] }). Only events overlapping the next 30 minutes are
// returned; a room with nothing booked gets an empty value array.
const reply = require("../../replies");

const TENANT = "11111111-2222-3333-4444-555555555555";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.graph-token";

const room = (id, name, email) => ({ id, displayName: name, emailAddress: email, capacity: 8, building: "HQ", floorNumber: 2, address: { city: "Milan" } });
const ROOMS = {
    "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#places/microsoft.graph.room",
    value: [
        room("a1b2c3d4-0001-4000-8000-000000000001", "Boardroom", "boardroom@contoso.com"),
        room("a1b2c3d4-0002-4000-8000-000000000002", "Huddle 7", "huddle7@contoso.com"),
        room("a1b2c3d4-0003-4000-8000-000000000003", "Training Lab", "training@contoso.com")
    ]
};

const att = (type, response, name) => ({ type, status: { response, time: "2026-01-14T15:00:00Z" }, emailAddress: { name, address: name.toLowerCase().replace(/ /g, ".") + "@contoso.com" } });
const event = (id, subject, attendees) => ({
    id, subject, start: { dateTime: "2026-01-15T09:30:00.0000000", timeZone: "UTC" }, end: { dateTime: "2026-01-15T10:30:00.0000000", timeZone: "UTC" },
    organizer: { emailAddress: { name: "Alice Rossi", address: "alice.rossi@contoso.com" } }, attendees
});

const BOARDROOM = {
    "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#users('boardroom%40contoso.com')/calendarView",
    value: [
        event("AAMkAD-board-1", "Quarterly review", [
            att("required", "organizer", "Alice Rossi"),
            att("required", "accepted", "Bob Verdi"),
            att("required", "tentativelyAccepted", "Carla Neri"),
            att("optional", "declined", "Dario Gialli"),
            att("optional", "none", "Elena Blu"),
            att("resource", "accepted", "Boardroom")
        ]),
        event("AAMkAD-board-2", "Overrun planning", [att("required", "accepted", "Alice Rossi"), att("resource", "accepted", "Boardroom")])
    ]
};
const HUDDLE = { "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#users('huddle7%40contoso.com')/calendarView", value: [] };
const TRAINING = {
    "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#users('training%40contoso.com')/calendarView",
    value: [event("AAMkAD-train-1", "Onboarding", [att("required", "accepted", "Fabio Rosa"), att("required", "declined", "Gina Viola"), att("resource", "accepted", "Training Lab")])]
};

const auth = { Authorization: "Bearer " + TOKEN };
const view = (email) => "/v1.0/users/" + email + "/calendarView?startDateTime=2026-01-15T10:00:00&endDateTime=2026-01-15T10:30:00";
const calls = () => [
    {
        kind: "http", method: "post", host: "login.microsoftonline.com", target: "/" + TENANT + "/oauth2/v2.0/token",
        reply: reply.http(200, { token_type: "Bearer", expires_in: 3599, ext_expires_in: 3599, access_token: TOKEN })
    },
    { kind: "http", method: "get", host: "graph.microsoft.com", target: "/v1.0/places/microsoft.graph.room", headers: auth, reply: reply.http(200, ROOMS) },
    { kind: "http", method: "get", host: "graph.microsoft.com", target: view("boardroom@contoso.com"), headers: auth, reply: reply.http(200, BOARDROOM) },
    { kind: "http", method: "get", host: "graph.microsoft.com", target: view("huddle7@contoso.com"), headers: auth, reply: reply.http(200, HUDDLE) },
    { kind: "http", method: "get", host: "graph.microsoft.com", target: view("training@contoso.com"), headers: auth, reply: reply.http(200, TRAINING) }
];

module.exports = {
    cases: [{
        name: "busy boardroom with two events, empty huddle room, training room",
        parameters: { tenantId: TENANT, clientId: "client-id-1", clientSecret: "client-secret-1" },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
