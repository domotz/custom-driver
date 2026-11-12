/**
 * This driver extracts monitoring information for redis server
 * Communication using telnet over redis port (default 6379)
 * This driver is tested under redis 4.0.9 and 5.0.7
 * The sections monitored by this driver are:
 * - CPU: CPU consumption statistics
 *       %used_cpu_sys: System CPU consumed by the Redis server, which is the sum of system CPU consumed by all threads of the server process (main thread and background threads)
 *       %used_cpu_user: User CPU consumed by the Redis server, which is the sum of user CPU consumed by all threads of the server process (main thread and background threads)
 *       %used_cpu_sys_children: System CPU consumed by the background processes
 *       %used_cpu_user_children: User CPU consumed by the background processes
 *       %used_cpu_sys_main_thread: System CPU consumed by the Redis server main thread
 *       %used_cpu_user_main_thread: User CPU consumed by the Redis server main thread
 * - Memory: Memory consumption related information
 *       %used_memory: Total number of bytes allocated by Redis using its allocator (either standard libc, jemalloc, or an alternative allocator such as tcmalloc)
 *       %used_memory_human: Human readable representation of previous value
 *       %used_memory_rss: Number of bytes that Redis allocated as seen by the operating system (a.k.a resident set size). This is the number reported by tools such as top(1) and ps(1)
 *       %used_memory_rss_human: Human readable representation of previous value
 *       %used_memory_peak: Peak memory consumed by Redis (in bytes)
 *       %used_memory_peak_human: Human readable representation of previous value
 *       %used_memory_peak_perc: The percentage of used_memory_peak out of used_memory
 *       %used_memory_overhead: The sum in bytes of all overheads that the server allocated for managing its internal data structures
 *       %used_memory_startup: Initial amount of memory consumed by Redis at startup in bytes
 *       %used_memory_dataset: The size in bytes of the dataset (used_memory_overhead subtracted from used_memory)
 *       %used_memory_dataset_perc: The percentage of used_memory_dataset out of the net memory usage (used_memory minus used_memory_startup)
 *       %total_system_memory: The total amount of memory that the Redis host has
 *       %total_system_memory_human: Human readable representation of previous value
 *       %used_memory_lua: Number of bytes used by the Lua engine
 *       %used_memory_lua_human: Human readable representation of previous value
 *       %used_memory_scripts: Number of bytes used by cached Lua scripts
 *       %used_memory_scripts_human: Human readable representation of previous value
 *       %maxmemory: The value of the maxmemory configuration directive
 *       %maxmemory_human: Human readable representation of previous value
 *       %maxmemory_policy: The value of the maxmemory-policy configuration directive
 *       %mem_fragmentation_ratio: Ratio between used_memory_rss and used_memory. Note that this doesn't only includes fragmentation, but also other process overheads (see the allocator_* metrics), and also overheads like code, shared libraries, stack, etc.
 *       %mem_fragmentation_bytes: Delta between used_memory_rss and used_memory. Note that when the total fragmentation bytes is low (few megabytes), a high ratio (e.g. 1.5 and above) is not an indication of an issue.
 *       %allocator_frag_ratio:: Ratio between allocator_active and allocator_allocated. This is the true (external) fragmentation metric (not mem_fragmentation_ratio).
 *       %allocator_frag_bytes Delta between allocator_active and allocator_allocated. See note about mem_fragmentation_bytes.
 *       %allocator_rss_ratio: Ratio between allocator_resident and allocator_active. This usually indicates pages that the allocator can and probably will soon release back to the OS.
 *       %allocator_rss_bytes: Delta between allocator_resident and allocator_active
 *       %rss_overhead_ratio: Ratio between used_memory_rss (the process RSS) and allocator_resident. This includes RSS overheads that are not allocator or heap related.
 *       %rss_overhead_bytes: Delta between used_memory_rss (the process RSS) and allocator_resident
 *       %allocator_allocated: Total bytes allocated form the allocator, including internal-fragmentation. Normally the same as used_memory.
 *       %allocator_active: Total bytes in the allocator active pages, this includes external-fragmentation.
 *       %allocator_resident: Total bytes resident (RSS) in the allocator, this includes pages that can be released to the OS (by MEMORY PURGE, or just waiting).
 *       %mem_not_counted_for_evict: Used memory that's not counted for key eviction. This is basically transient replica and AOF buffers.
 *       %mem_clients_slaves: Memory used by replica clients - Starting Redis 7.0, replica buffers share memory with the replication backlog, so this field can show 0 when replicas don't trigger an increase of memory usage.
 *       %mem_clients_normal: Memory used by normal clients
 *       %mem_cluster_links: Memory used by links to peers on the cluster bus when cluster mode is enabled.
 *       %mem_aof_buffer: Transient memory used for AOF and AOF rewrite buffers
 *       %mem_replication_backlog: Memory used by replication backlog
 *       %mem_total_replication_buffers: Total memory consumed for replication buffers - Added in Redis 7.0.
 *       %mem_allocator: Memory allocator, chosen at compile time.
 *       %active_defrag_running: When activedefrag is enabled, this indicates whether defragmentation is currently active, and the CPU percentage it intends to utilize.
 *       %lazyfree_pending_objects: The number of objects waiting to be freed (as a result of calling UNLINK, or FLUSHDB and FLUSHALL with the ASYNC option)
 *       %lazyfreed_objects: The number of objects that have been lazy freed.
 */

var _var = D.device.createVariable;
var telnet = D.device.sendTelnetCommand;
var redisInfoSelectedSections = ["cpu", "memory"];

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