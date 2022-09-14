/**
 * This driver extracts monitoring information for redis server
 * Communication using telnet over redis port (default 6379)
 * This driver is tested under redis 4.0.9 and 5.0.7
 * The sections monitored by this driver are:
 * - Server info: General information about the Redis server
 *       %redis_version: Version of the Redis server
 *       %redis_git_sha1: Git SHA1
 *       %redis_git_dirty: Git dirty flag
 *       %redis_build_id: The build id
 *       %redis_mode: The server's mode ("standalone", "sentinel" or "cluster")
 *       %os: Operating system hosting the Redis server
 *       %arch_bits: Architecture (32 or 64 bits)
 *       %multiplexing_api: Event loop mechanism used by Redis
 *       %atomicvar_api: Atomicvar API used by Redis
 *       %gcc_version: Version of the GCC compiler used to compile the Redis server
 *       %process_id: PID of the server process
 *       %process_supervised: Supervised system ("upstart", "systemd", "unknown" or "no")
 *       %run_id: Random value identifying the Redis server (to be used by Sentinel and Cluster)
 *       %tcp_port: TCP/IP listen port
 *       %server_time_usec: Epoch-based system time with microsecond precision
 *       %uptime_in_seconds: Number of seconds since Redis server start
 *       %uptime_in_days: Same value expressed in days
 *       %hz: The server's current frequency setting
 *       %configured_hz: The server's configured frequency setting
 *       %lru_clock: Clock incrementing every minute, for LRU management
 *       %executable: The path to the server's executable
 *       %config_file: The path to the config file
 *       %io_threads_active: Flag indicating if I/O threads are active
 *       %shutdown_in_milliseconds: The maximum time remaining for replicas to catch up the replication before completing the shutdown sequence. This field is only present during shutdown.
 * - Replication: Master/replica replication information
 *       %role: Value is "master" if the instance is replica of no one, or "slave" if the instance is a replica of some master instance. Note that a replica can be master of another replica (chained replication).
 *       %master_failover_state: The state of an ongoing failover, if any.
 *       %master_replid: The replication ID of the Redis server.
 *       %master_replid2: The secondary replication ID, used for PSYNC after a failover.
 *       %master_repl_offset: The server's current replication offset
 *       %second_repl_offset: The offset up to which replication IDs are accepted
 *       %repl_backlog_active: Flag indicating replication backlog is active
 *       %repl_backlog_size: Total size in bytes of the replication backlog buffer
 *       %repl_backlog_first_byte_offset: The master offset of the replication backlog buffer
 *       %repl_backlog_histlen: Size in bytes of the data in the replication backlog buffer
 *    If the instance is a replica, these additional fields are provided:
 *       %master_host: Host or IP address of the master
 *       %master_port: Master listening TCP port
 *       %master_link_status: Status of the link (up/down)
 *       %master_last_io_seconds_ago: Number of seconds since the last interaction with master
 *       %master_sync_in_progress: Indicate the master is syncing to the replica
 *       %slave_read_repl_offset: The read replication offset of the replica instance.
 *       %slave_repl_offset: The replication offset of the replica instance
 *       %slave_priority: The priority of the instance as a candidate for failover
 *       %slave_read_only: Flag indicating if the replica is read-only
 *       %replica_announced: Flag indicating if the replica is announced by Sentinel.
 *    If a SYNC operation is on-going, these additional fields are provided:
 *       %master_sync_total_bytes: Total number of bytes that need to be transferred. this may be 0 when the size is unknown (for example, when the repl-diskless-sync configuration directive is used)
 *       %master_sync_read_bytes: Number of bytes already transferred
 *       %master_sync_left_bytes: Number of bytes left before syncing is complete (may be negative when master_sync_total_bytes is 0)
 *       %master_sync_perc: The percentage master_sync_read_bytes from master_sync_total_bytes, or an approximation that uses loading_rdb_used_mem when master_sync_total_bytes is 0
 *       %master_sync_last_io_seconds_ago: Number of seconds since last transfer I/O during a SYNC operation
 *    If the link between master and replica is down, an additional field is provided:
 *       %master_link_down_since_seconds: Number of seconds since the link is down
 *    The following field is always provided:
 *       %connected_slaves: Number of connected replicas
 *    If the server is configured with the min-slaves-to-write (or starting with Redis 5 with the min-replicas-to-write) directive, an additional field is provided:
 *       %min_slaves_good_slaves: Number of replicas currently considered good
 *    For each replica, the following line is added:
 *       %slaveXXX: id, IP address, port, state, offset, lag
 * - Cluster
 *       %cluster_enabled: Indicate Redis cluster is enabled
 * - Keyspace: Database related statistics
 *       %dbXXX: keys=XXX,expires=XXX
 */

var _var = D.device.createVariable;
var telnet = D.device.sendTelnetCommand;
var redisInfoSelectedSections = ["server", "replication", "cluster", "keyspace"];

var devicePassword = D.device.password();

var redisTelnetParams = {
    port: 6379,
    negotiationMandatory: false,
    timeout: 10000,
    command: "info",
    onConnectCommand: devicePassword ? "auth " + devicePassword + "\n" : null
};

/**
 * 
 * @returns Promise wait for redis information
 */
function getRedisInfo() {
    var d = D.q.defer();
    telnet(redisTelnetParams, function (out, err) {
        if (err) {
            console.error("error while executing command: " + redisTelnetParams.command);
            failure(err);
        }
        if (!out) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        if (out.indexOf("-NOAUTH") >= 0) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        d.resolve(out.split("\n"));
    });

    return d.promise;
}

/**
 * 
 * @param {[string]} results redis info result
 * @returns redis info result grouped by sections
 */
function splitToSections(results) {
    var section = "";
    var groupedResult = {};
    for (var i = 0; i < results.length; i++) {
        var line = results[i];
        if (line.indexOf("#") == 0) {
            section = line.split(" ")[1].toLowerCase().trim();
            groupedResult[section] = [];
        } else if (section) {
            groupedResult[section].push(section + ">" + line);
        }
    }
    return groupedResult;
}

/**
 * 
 * @param {{[key]: [string]}} groupedResult list of information returned by redis server
 * @returns monitoring variables
 */
function parseInfo(groupedResult) {

    return redisInfoSelectedSections
        .map(function (key) {
            return groupedResult[key];
        }).reduce(function (a, b) {
            b.forEach(function (e) { a.push(e); });
            return a;
        }, []).map(function (line) {
            return line.split(":");
        }).filter(function (info) {
            return info.length == 2;
        }).filter(function (info) {
            return !info[0].match(/.*_human$/);
        }).map(function (info) {
            var key = info[0];
            var value = info[1].trim();
            return _var(key, key.split("_").join(" "), value);
        });
}


function failure(err) {
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the connection to redis is working and if the command is running
*/
function validate() {
    getRedisInfo()
        .then(function () { D.success(); })
        .catch(failure);

}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used to show redis server information
*/
function get_status() {
    getRedisInfo()
        .then(splitToSections)
        .then(parseInfo)
        .then(D.success)
        .catch(failure);
}