// Epson projector over PJLink (class 1/2, TCP 4352), driven through a raw net.createConnection socket.
// The PJLink conversation is two steps: the projector greets ("PJLINK 0\r", or "PJLINK 1 <8 char seed>\r" when a
// password is set), and only after the driver writes its command does it answer ("%1LAMP=1200 1\r", "%1POWR=OK\r",
// "%1INF2=...\r"). The golden harness replays a raw socket as ONE reply per connection (spec/net/sandbox-io.js
// playConnection: connect, a single "data" event, end, close), so it cannot deliver the answer after the write.
// Putting both in one chunk makes the driver read "PJLINK" with the whole text as arguments and reject the greeting
// ("Unsupported PJLINK greeting"). The driver is covered by spec/epson_projector_via_pj_link_spec.js with a fake socket.
module.exports = {
    cases: [{ name: "epson pj-link projector", entryPoints: {} }],
    skipEntryPoints: {
        validate: "raw socket needs greeting then reply after the driver writes; golden harness replays one data event per connection",
        get_status: "raw socket needs greeting then reply after the driver writes; golden harness replays one data event per connection",
        custom_1: "raw socket needs greeting then reply after the driver writes; golden harness replays one data event per connection",
        custom_2: "raw socket needs greeting then reply after the driver writes; golden harness replays one data event per connection"
    }
};
