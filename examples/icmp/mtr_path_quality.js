/**
 * Domotz Custom Driver — MTR Path Quality to Device
 *
 * Measures the network path quality from the collector to the monitored
 * device (D.device) using MTR, and publishes the destination-side metrics
 * as custom driver variables:
 *      - Destination packet loss (%)
 *      - Destination average round-trip time (ms)
 *      - Destination jitter (ms)
 *      - Hop count (number of hops on the path)
 *
 * The path target is the managed device itself (taken from D.device) — there
 * is no host parameter. A blind destination (no replies) reports null RTT and
 * jitter, so a real 0 ms is distinguishable from "no measurement".
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
 * @label Get MTR Path Quality
 * @documentation Runs MTR to the device and publishes destination loss, latency, jitter and hop count.
 */
function get_status() {
    D.device.mtr(MTR_OPTIONS, function (result, error) {
        if (error) {
            console.error("MTR failed: " + (error.message || error));
            return D.failure(D.errorType.GENERIC_ERROR);
        }
        var hops = result.hops || [];
        var dst = hops.length ? hops[hops.length - 1] : null;
        var rtt = dst && dst.rtt ? dst.rtt.avg : null;
        var jitter = dst && dst.jitter ? dst.jitter.avg : null;
        D.success([
            D.device.createVariable("dst_loss", "Destination packet loss", dst ? dst.loss_percent : null, "%"),
            D.device.createVariable("dst_rtt_avg", "Destination average RTT", rtt, "ms"),
            D.device.createVariable("dst_jitter_avg", "Destination jitter", jitter, "ms"),
            D.device.createVariable("hop_count", "Number of hops", result.hop_count)
        ]);
    });
}
