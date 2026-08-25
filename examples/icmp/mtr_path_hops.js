/**
 * Domotz Custom Driver — MTR Path (Hop-by-Hop) to Device
 *
 * Runs MTR to the monitored device (D.device) and reports the full network
 * path as a table, one row per hop:
 *      - TTL, Host, Loss (%), Sent, Avg RTT (ms), Jitter (ms)
 *
 * The path target is the managed device itself (taken from D.device) — there
 * is no host parameter. Unresponsive ("blind") hops show "*" as the host and
 * null RTT/jitter.
 *
 * Requires sandbox version 2.4+ (the release that ships D.device.mtr). No
 * device credentials are required.
 */

// All D.device.mtr options, preset to the tool's defaults. Every field is
// optional — remove any you don't need, or tune it within the range shown.
var MTR_OPTIONS = {
    cycles: 10,        // measurement cycles (probes per hop). Integer 1-100.
    max_hops: 64,      // maximum hops to probe (TTL ceiling). Integer 1-255.
    first_hop: 1,      // first hop (TTL) to probe from. Integer 1-255.
    interval: 1,       // minimum duration of each probe round, in seconds. 0.1-60.
    packet_size: 84,   // probe packet size, in bytes. Integer 28-1500.
    protocol: "ICMP",  // probe protocol: "ICMP", "UDP" or "TCP".
    port: 80,          // target port (UDP/TCP only). Integer 1-65535.
    tos: 0             // IP Type-of-Service / DSCP byte (IPv4 only). Integer 0-255.
};

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation Verifies that MTR to the device works (sandbox 2.4+).
 */
function validate() {
    D.device.mtr({ cycles: 2 }, function (result, error) {
        if (error) {
            console.error("MTR validation failed: " + (error.message || error));
            return D.failure(D.errorType.GENERIC_ERROR);
        }
        D.success();
    });
}

/**
 * @remote_procedure
 * @label Get MTR Path
 * @documentation Runs MTR to the device and reports the per-hop path (loss, latency, jitter) as a table.
 */
function get_status() {
    D.device.mtr(MTR_OPTIONS, function (result, error) {
        if (error) {
            console.error("MTR failed: " + (error.message || error));
            return D.failure(D.errorType.GENERIC_ERROR);
        }
        var table = D.createTable("MTR path to device", [
            { label: "TTL" },
            { label: "Host" },
            { label: "Loss", unit: "%" },
            { label: "Sent" },
            { label: "Avg RTT", unit: "ms" },
            { label: "Jitter", unit: "ms" }
        ]);
        var hops = result.hops || [];
        for (var i = 0; i < hops.length; i++) {
            var hop = hops[i];
            table.insertRecord("hop_" + hop.ttl, [
                hop.ttl,
                hop.host || "*",
                hop.loss_percent,
                hop.sent,
                hop.rtt ? hop.rtt.avg : null,
                hop.jitter ? hop.jitter.avg : null
            ]);
        }
        D.success(table);
    });
}
