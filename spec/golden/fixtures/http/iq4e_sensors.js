// Simulated Trend IQ4E controller replies. The IQ4E web UI is not publicly documented; the shape follows the
// page the driver was written against: GET /S.htm?ovrideStart=0&count=1000 is an HTML page whose sensor list is
// body > #wrapper > #main > #mainData > #mainContent > table > tbody > tr.data, one <tr class="data "> per
// sensor with one cell per line (id, name, value, unit). Rows with a different class (header, group) carry no
// sensor. Digital sensors have an empty unit. There is no companion expected_variables to compare.
const reply = require("../../replies");

const sensor = (id, name, value, unit) => '<tr class="data ">\n<td>' + id + "</td>\n<td>" + name + "</td>\n<td>" + value + "</td>\n<td>" + unit + "</td>\n</tr>";

const PAGE = [
    "<!DOCTYPE html>",
    "<html><head><title>IQ4E Sensors</title></head><body>",
    '<div id="wrapper"><div id="header"><h1>IQ4E/230</h1></div>',
    '<div id="main"><div id="mainData"><div id="mainContent">',
    "<table><tbody>",
    '<tr class="header"><th>No</th><th>Name</th><th>Value</th><th>Unit</th></tr>',
    sensor("1", "Room temperature", "21.5", "&deg;C"),
    sensor("2", "Supply humidity", "47", "%"),
    sensor("3", "Boiler enable", "Off", ""),
    sensor("4", "Fire alarm", "Alarm", ""),
    "</tbody></table>",
    "</div></div></div></div></body></html>"
].join("\n");

const call = () => [{ kind: "http", method: "get", target: "/S.htm?ovrideStart=0&count=1000", reply: reply.http(200, PAGE, { "content-type": "text/html" }) }];

module.exports = {
    cases: [{ name: "four sensors, one in alarm", entryPoints: { validate: { calls: call() }, get_status: { calls: call() } } }]
};
