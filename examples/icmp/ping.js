/**
 * Domotz Custom Driver — ICMP Ping to Device
 *
 * Pings the monitored device (D.device) over ICMP and publishes round-trip
 * time and loss statistics as custom driver variables:
 *      - Jitter (ms)
 *      - Average RTT (ms)
 *      - Packet loss (%)
 *      - Min / Max RTT (ms)
 *      - Standard deviation (ms)
 *
 * The ping target is the managed device itself (taken from D.device) — there
 * is no host parameter. No device credentials are required.
 */

var pingOptions = {
    count: 10,
    interval: 100,
    timeout: 1000,
    packet_size: 16,
    ttl: 64
};

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate(){
    D.success();
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used for retrieving device variables data
 */
function get_status() {
    D.device.ping(pingOptions, function(pingResults, error) {
        if (error) {
            console.error("Ping failed: " + (error.message || error));
            return D.failure(D.errorType.GENERIC_ERROR);
        }
        D.success([
            D.device.createVariable('jitter', 'Jitter', pingResults.jitter, 'ms'),
            D.device.createVariable('avg', 'Average', pingResults.avg, 'ms'),
            D.device.createVariable('packet_loss', 'Packet Loss', pingResults.packet_loss, '%'),
            D.device.createVariable('min', 'Min', pingResults.min, 'ms'),
            D.device.createVariable('max', 'Max', pingResults.max, 'ms'),
            D.device.createVariable('std', 'Std', pingResults.std, 'ms')
        ]);
    });
}
