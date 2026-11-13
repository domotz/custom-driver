// Simulated Microsoft Graph replies. Shape follows the Microsoft identity platform v2.0 client-credentials token response
// ({ token_type, expires_in, ext_expires_in, access_token }), the Graph v1.0 "List rooms" reply (GET /places/microsoft.graph.room ->
// { "@odata.context", value: [ room { id, displayName, emailAddress, address, geoCoordinates, phone, capacity, building, floorNumber,
// isWheelChairAccessible } ] }) and the Graph v1.0 calendar "getSchedule" reply (POST /users/{id}/calendar/getSchedule with schedules[],
// startTime, endTime -> { "@odata.context", value: [ scheduleInformation { scheduleId, availabilityView, scheduleItems, workingHours } ] },
// one availabilityView character per 30 minute slot: 0 free, 1 tentative, 2 busy, 3 out of office, 4 working elsewhere).
// The 30 minute window starting at the fixed clock gives one slot per room.
const reply = require("../../replies");

const TENANT = "11111111-2222-3333-4444-555555555555";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.graph-token";

const room = (id, name, email, capacity) => ({
    id, displayName: name, emailAddress: email, geoCoordinates: null, phone: "", nickname: name, building: "HQ", floorNumber: 2, capacity,
    isWheelChairAccessible: true, address: { street: "1 Main St", city: "Milan", countryOrRegion: "IT" }
});
const ROOMS = {
    "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#places/microsoft.graph.room",
    value: [
        room("a1b2c3d4-0001-4000-8000-000000000001", "Boardroom", "boardroom@contoso.com", 12),
        room("a1b2c3d4-0002-4000-8000-000000000002", "Huddle 7", "huddle7@contoso.com", 4),
        room("a1b2c3d4-0003-4000-8000-000000000003", "Training Lab", "training@contoso.com", 30)
    ]
};
const item = (email, view) => ({ scheduleId: email, availabilityView: view, scheduleItems: [], workingHours: { daysOfWeek: ["monday", "tuesday"], timeZone: { name: "UTC" } } });
const SCHEDULE = {
    "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#Collection(microsoft.graph.scheduleInformation)",
    value: [item("boardroom@contoso.com", "0"), item("huddle7@contoso.com", "2"), item("training@contoso.com", "1")]
};

const auth = { Authorization: "Bearer " + TOKEN };
const calls = () => [
    {
        kind: "http", method: "post", host: "login.microsoftonline.com", target: "/" + TENANT + "/oauth2/v2.0/token",
        reply: reply.http(200, { token_type: "Bearer", expires_in: 3599, ext_expires_in: 3599, access_token: TOKEN })
    },
    { kind: "http", method: "get", host: "graph.microsoft.com", target: "/v1.0/places/microsoft.graph.room", headers: auth, reply: reply.http(200, ROOMS) },
    {
        kind: "http", method: "post", host: "graph.microsoft.com", target: "/v1.0/users/boardroom@contoso.com/calendar/getSchedule", headers: auth,
        body: /"schedules":\["boardroom@contoso.com","huddle7@contoso.com","training@contoso.com"\].*"dateTime":"2026-01-15T10:00:00".*"dateTime":"2026-01-15T10:30:00"/,
        reply: reply.http(200, SCHEDULE)
    }
];

module.exports = {
    cases: [{
        name: "three rooms free, busy and tentative",
        parameters: { tenantId: TENANT, clientId: "client-id-1", clientSecret: "client-secret-1" },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
