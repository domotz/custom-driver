/**
 * This driver extracts monitoring information for redis server
 * Communication using telnet over redis port (default 6379)
 * This driver is tested under redis 4.0.9 and 5.0.7
 * The sections monitored by this driver are:
 * - Clients: Client connections section
 *       %connected_clients: Number of client connections (excluding connections from replicas)
 *       %cluster_connections: An approximation of the number of sockets used by the cluster's bus
 *       %maxclients: The value of the maxclients configuration directive. This is the upper limit for the sum of connected_clients, connected_slaves and cluster_connections.
 *       %client_recent_max_input_buffer: Biggest input buffer among current client connections
 *       %client_recent_max_output_buffer: Biggest output buffer among current client connections
 *       %blocked_clients: Number of clients pending on a blocking call (BLPOP, BRPOP, BRPOPLPUSH, BLMOVE, BZPOPMIN, BZPOPMAX)
 *       %tracking_clients: Number of clients being tracked (CLIENT TRACKING)
 *       %clients_in_timeout_table: Number of clients in the clients timeout table
 * - Persistence: RDB and AOF related information
 *       %loading: Flag indicating if the load of a dump file is on-going
 *       %async_loading: Currently loading replication data-set asynchronously while serving old data. This means repl-diskless-load is enabled and set to swapdb. Added in Redis 7.0.
 *       %current_cow_peak: The peak size in bytes of copy-on-write memory while a child fork is running
 *       %current_cow_size: The size in bytes of copy-on-write memory while a child fork is running
 *       %current_cow_size_age: The age, in seconds, of the current_cow_size value.
 *       %current_fork_perc: The percentage of progress of the current fork process. For AOF and RDB forks it is the percentage of current_save_keys_processed out of current_save_keys_total.
 *       %current_save_keys_processed: Number of keys processed by the current save operation
 *       %current_save_keys_total: Number of keys at the beginning of the current save operation
 *       %rdb_changes_since_last_save: Number of changes since the last dump
 *       %rdb_bgsave_in_progress: Flag indicating a RDB save is on-going
 *       %rdb_last_save_time: Epoch-based timestamp of last successful RDB save
 *       %rdb_last_bgsave_status: Status of the last RDB save operation
 *       %rdb_last_bgsave_time_sec: Duration of the last RDB save operation in seconds
 *       %rdb_current_bgsave_time_sec: Duration of the on-going RDB save operation if any
 *       %rdb_last_cow_size: The size in bytes of copy-on-write memory during the last RDB save operation
 *       %rdb_last_load_keys_expired: Number volatile keys deleted during the last RDB loading. Added in Redis 7.0.
 *       %rdb_last_load_keys_loaded: Number of keys loaded during the last RDB loading. Added in Redis 7.0.
 *       %aof_enabled: Flag indicating AOF logging is activated
 *       %aof_rewrite_in_progress: Flag indicating a AOF rewrite operation is on-going
 *       %aof_rewrite_scheduled: Flag indicating an AOF rewrite operation will be scheduled once the on-going RDB save is complete.
 *       %aof_last_rewrite_time_sec: Duration of the last AOF rewrite operation in seconds
 *       %aof_current_rewrite_time_sec: Duration of the on-going AOF rewrite operation if any
 *       %aof_last_bgrewrite_status: Status of the last AOF rewrite operation
 *       %aof_last_write_status: Status of the last write operation to the AOF
 *       %aof_last_cow_size: The size in bytes of copy-on-write memory during the last AOF rewrite operation
 *       %module_fork_in_progress: Flag indicating a module fork is on-going
 *       %module_fork_last_cow_size: The size in bytes of copy-on-write memory during the last module fork operation
 *       %aof_rewrites: Number of AOF rewrites performed since startup
 *       %rdb_saves: Number of RDB snapshots performed since startup
 *     If AOF is activated, these additional fields will be added:
 *       %aof_current_size: AOF current file size
 *       %aof_base_size: AOF file size on latest startup or rewrite
 *       %aof_pending_rewrite: Flag indicating an AOF rewrite operation will be scheduled once the on-going RDB save is complete.
 *       %aof_buffer_length: Size of the AOF buffer
 *       %aof_rewrite_buffer_length: Size of the AOF rewrite buffer. Note this field was removed in Redis 7.0
 *       %aof_pending_bio_fsync: Number of fsync pending jobs in background I/O queue
 *       %aof_delayed_fsync: Delayed fsync counter
 *     If a load operation is on-going, these additional fields will be added:
 *       %loading_start_time: Epoch-based timestamp of the start of the load operation
 *       %loading_total_bytes: Total file size
 *       %loading_rdb_used_mem: The memory usage of the server that had generated the RDB file at the time of the file's creation
 *       %loading_loaded_bytes: Number of bytes already loaded
 *       %loading_loaded_perc: Same value expressed as a percentage
 *       %loading_eta_seconds: ETA in seconds for the load to be complete
 * - Stats: General statistics
 *       %total_connections_received: Total number of connections accepted by the server
 *       %total_commands_processed: Total number of commands processed by the server
 *       %instantaneous_ops_per_sec: Number of commands processed per second
 *       %total_net_input_bytes: The total number of bytes read from the network
 *       %total_net_output_bytes: The total number of bytes written to the network
 *       %total_net_repl_input_bytes: The total number of bytes read from the network for replication purposes
 *       %total_net_repl_output_bytes: The total number of bytes written to the network for replication purposes
 *       %instantaneous_input_kbps: The network's read rate per second in KB/sec
 *       %instantaneous_output_kbps: The network's write rate per second in KB/sec
 *       %instantaneous_input_repl_kbps: The network's read rate per second in KB/sec for replication purposes
 *       %instantaneous_output_repl_kbps: The network's write rate per second in KB/sec for replication purposes
 *       %rejected_connections: Number of connections rejected because of maxclients limit
 *       %sync_full: The number of full resyncs with replicas
 *       %sync_partial_ok: The number of accepted partial resync requests
 *       %sync_partial_err: The number of denied partial resync requests
 *       %expired_keys: Total number of key expiration events
 *       %expired_stale_perc: The percentage of keys probably expired
 *       %expired_time_cap_reached_count: The count of times that active expiry cycles have stopped early
 *       %expire_cycle_cpu_milliseconds: The cumulative amount of time spend on active expiry cycles
 *       %evicted_keys: Number of evicted keys due to maxmemory limit
 *       %evicted_clients: Number of evicted clients due to maxmemory-clients limit. Added in Redis 7.0.
 *       %total_eviction_exceeded_time: Total time used_memory was greater than maxmemory since server startup, in milliseconds
 *       %current_eviction_exceeded_time: The time passed since used_memory last rose above maxmemory, in milliseconds
 *       %keyspace_hits: Number of successful lookup of keys in the main dictionary
 *       %keyspace_misses: Number of failed lookup of keys in the main dictionary
 *       %pubsub_channels: Global number of pub/sub channels with client subscriptions
 *       %pubsub_patterns: Global number of pub/sub pattern with client subscriptions
 *       %pubsubshard_channels: Global number of pub/sub shard channels with client subscriptions. Added in Redis 7.0.3
 *       %latest_fork_usec: Duration of the latest fork operation in microseconds
 *       %total_forks: Total number of fork operations since the server start
 *       %migrate_cached_sockets: The number of sockets open for MIGRATE purposes
 *       %slave_expires_tracked_keys: The number of keys tracked for expiry purposes (applicable only to writable replicas)
 *       %active_defrag_hits: Number of value reallocations performed by active the defragmentation process
 *       %active_defrag_misses: Number of aborted value reallocations started by the active defragmentation process
 *       %active_defrag_key_hits: Number of keys that were actively defragmented
 *       %active_defrag_key_misses: Number of keys that were skipped by the active defragmentation process
 *       %total_active_defrag_time: Total time memory fragmentation was over the limit, in milliseconds
 *       %current_active_defrag_time: The time passed since memory fragmentation last was over the limit, in milliseconds
 *       %tracking_total_keys: Number of keys being tracked by the server
 *       %tracking_total_items: Number of items, that is the sum of clients number for each key, that are being tracked
 *       %tracking_total_prefixes: Number of tracked prefixes in server's prefix table (only applicable for broadcast mode)
 *       %unexpected_error_replies: Number of unexpected error replies, that are types of errors from an AOF load or replication
 *       %total_error_replies: Total number of issued error replies, that is the sum of rejected commands (errors prior command execution) and failed commands (errors within the command execution)
 *       %dump_payload_sanitizations: Total number of dump payload deep integrity validations (see sanitize-dump-payload config).
 *       %total_reads_processed: Total number of read events processed
 *       %total_writes_processed: Total number of write events processed
 *       %io_threaded_reads_processed: Number of read events processed by the main and I/O threads
 *       %io_threaded_writes_processed: Number of write events processed by the main and I/O threads
 */

var _var = D.device.createVariable;
var telnet = D.device.sendTelnetCommand;
var redisInfoSelectedSections = ["clients", "persistence", "stats"];

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