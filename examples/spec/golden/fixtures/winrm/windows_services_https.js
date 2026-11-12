// Same replies as windows_services.js: the HTTPS copy of the driver runs the same PowerShell commands, only the WinRM
// transport options (port 5986, scheme https) differ, and the replay does not see the transport.
// Shape: see the sibling fixture's header.
module.exports = require("./windows_services.js");
