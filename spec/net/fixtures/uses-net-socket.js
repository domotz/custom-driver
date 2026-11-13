/**
 * Fixture: Epson-style raw socket with no "error" listener; writes after ending the socket.
 */
function validate() {
    const client = net.createConnection({ host: D.device.ip(), port: 4352 });
    client.on("data", function () {
        client.end();
        client.write("%1POWR ?\r");
    });
}
