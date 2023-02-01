/** 
 * This driver gets node metrics from RabbitMQ management plugin provided an HTTP-based API using HTTP agent
 * Communication protocol is http
 * Communicate with http api using USERNAME and PASSWORD
 * The rabbitmq cluster name is modified in each installation. it should be found in in the top right corner of the RabbitMQ web application after making the signin. example: Cluster rabbit@319ac541e311
 * Dynamically create a table with specific columns in table variable.
 * Return a table with this columns:
 * -------------------------------------
 * Sum delivered per second: The sum of messages delivered (per second) to consumers in acknowledgement and  no-acknowledgement mode.
 * Sum delivered: The sum of messages delivered to consumers in acknowledgement and no-acknowledgement mode.
 * Unacknowledged per second: The number of messages per second delivered to clients but not yet acknowledged.
 * Unacknowledged: The number of messages delivered to clients but not yet acknowledged.
 * Redelivered per second: The rate of messages redelivered per second.
 * Redelivered: The count of subset of messages in the `deliver_get` queue with the `redelivered` flag set.
 * Ready per second: The number of messages per second ready to be delivered to clients.
 * Ready: The number of messages ready to be delivered to clients.
 * Published per second: The rate of published messages per second.
 * Published: The count of published messages.
 * Messages per second: The count of total messages per second in the queue.
 * Messages delivered per second: The count of messages (per second) delivered to consumers in acknowledgement mode.
 * Delivered: The count of messages delivered to consumers in acknowledgement mode.
 * Acknowledged per second: The number of messages (per second) delivered to clients and acknowledged.
 * Acknowledged: The number of messages delivered to clients and acknowledged.
 * Messages: The count of total messages in the queue.
 * Memory: The bytes of memory consumed by the Erlang process associated with the queue, including stack, heap and internal structures.
 * Consumers: The number of consumers.
 * -----------------------------------------
 * Tested with RabbitMQ version: 3.11.5 under Ubuntu 22.04.1 LTS 
 * 
 */

var port = 15672;
var nodes, overview, queues, monitoringList;
var healthcheck = {};
var vars = [];
var cluster = "TO_CHANGE_CLUSTER_NAME"; // example: rabbit@319ac541e311
var table = D.createTable("Cluster", [
    { label: "Sum delivered per second" },
    { label: "Sum delivered" },
    { label: "Unacknowledged per second" },
    { label: "Unacknowledged" },
    { label: "Redelivered per second" },
    { label: "Redelivered" },
    { label: "Ready per second" },
    { label: "Ready" },
    { label: "Published per second" },
    { label: "Published" },
    { label: "Messages per second" },
    { label: "Messages delivered per second" },
    { label: "Delivered" },
    { label: "Acknowledged per second" },
    { label: "Acknowledged" },
    { label: "Messages" },
    { label: "Memory" },
    { label: "Consumers" }
]);
/**
 * @returns promise for http response body
 */
function httpGet(url) {
    var d = D.q.defer();
    D.device.http.get({
        url: url,
        port: port,
        username: D.device.username(),
        password: D.device.password(),
        auth: "basic"
    }, function (err, response, body) {
        if (err) {
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        if (response.statusCode == 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(body);
    });
    return d.promise;
}

/**
 * @returns promise for http response containing nodes overview info
 */
function getNodesOverview() {
    return httpGet("/api/overview")
        .then(JSON.parse)
        .then(function (data) {
            overview = data;
        });
}

/**
 * @returns promise for http response body containig nodes info
 */
function getNodes() {
    return httpGet("/api/nodes/" + cluster + "?memory=true")
        .then(JSON.parse)
        .then(function (data) {
            nodes = data;
        });
}

/**
 * @returns promise for http response containing queues info
 */
function getQueues() {
    return httpGet("/api/queues")
        .then(JSON.parse)
        .then(function (data) {
            queues = data;
        });
}

/**
 * @returns promise for http response containing healthcheck nodes
 */
function getHealthcheckMirrorSync() {
    return httpGet("/api/health/checks/node-is-mirror-sync-critical")
        .then(JSON.parse)
        .then(function (data) {
            healthcheck.mirror_sync = data;
        });
}
function getHealthcheckCertExpiry() {
    return httpGet("/api/health/checks/certificate-expiration/1/months")
        .then(JSON.parse)
        .then(function (data) {
            healthcheck.certificate_expiration = data;
        });
}
function getHealthcheckLocalAlarms() {
    return httpGet("/api/health/checks/local-alarms")
        .then(JSON.parse)
        .then(function (data) {
            healthcheck.local_alarms = data;
        });
}
function getHealthcheckQuorumCritical() {
    return httpGet("/api/health/checks/node-is-quorum-critical")
        .then(JSON.parse)
        .then(function (data) {
            healthcheck.quorum = data;
        });
}
function getHealthcheckVirtualHosts() {
    return httpGet("/api/health/checks/virtual-hosts")
        .then(JSON.parse)
        .then(function (data) {
            healthcheck.virtual_hosts = data;
        });
}

/**
 * @param {value} value to convert to number  
 * @returns numeric value
 */
function convertToNumber(value) {
    return Number(value);
}

/**
 * @param {number} number multiplier
 * @returns the value muliplied by the number
 */
function multiplier(number) {
    return function (value) {
        return parseFloat(value * number);
    };
}

/**
 * @param {value} value length
 * @returns the length of value
 */
function length(value) {
    return value.length;
}

/**
 * @param {string} key parameter key
 * @returns extract values of all RabbitMQ nodes
 */
function extractValue(data, key) {
    return function () {
        return data[key];
    };
}

// The list of custom driver variables to monitor
function fillConfig() {
    monitoringList = [
        {
            // It checks whether the node has a disk alarm or not.
            uid: "disk_free_alarm",
            label: "Disk free alarm",
            execute: [extractValue(nodes, "disk_free_alarm"), convertToNumber]
        },
        {
            //The free space limit of a disk expressed in bytes.
            uid: "disk_free_limit",
            label: "Disk free limit",
            execute: extractValue(nodes, "disk_free_limit"),
            unit: "B"
        },
        {
            //The current free disk space.
            uid: "disk_free",
            label: "Free disk space",
            execute: extractValue(nodes, "disk_free"),
            unit: "B"
        },
        {
            //Checks if there are classic mirrored queues without synchronized mirrors online 
            uid: "mirror_sync",
            label: "Healthcheck: classic mirrored queues without synchronized mirrors online",
            execute: extractValue(healthcheck.mirror_sync, "status")
        },
        {
            //Checks the expiration date on the certificates for every listener configured to use TLS.
            uid: "certificate_expiration",
            label: "Healthcheck: expiration date on the certificates",
            execute: extractValue(healthcheck.certificate_expiration, "status")
        },
        {
            //Checks if there are no local alarms in effect on the target node.
            uid: "local_alarms",
            label: "Healthcheck: expiration date on the certificates",
            execute: extractValue(healthcheck.local_alarms, "status")
        },
        {
            //Checks if there are quorum queues with minimum online quorum.
            uid: "quorum",
            label: "Healthcheck: local alarms in effect on this node",
            execute: extractValue(healthcheck.quorum, "status")
        },
        {
            //Checks if all virtual hosts and running on the target node.
            uid: "virtual_hosts",
            label: "Healthcheck: virtual hosts on this node",
            execute: extractValue(healthcheck.virtual_hosts, "status")
        },
        {
            //It "sees" whether the node is running or not.
            uid: "running",
            label: "Is running",
            execute: [extractValue(nodes, "running"), convertToNumber]
        },
        {
            //The version of the management plugin in use.
            uid: "management_version",
            label: "Management plugin version",
            execute: extractValue(overview, "management_version")
        },
        {
            //It checks whether the host has a memory alarm or not.
            uid: "mem_alarm",
            label: "Memory alarm",
            execute: [extractValue(nodes, "mem_alarm"), convertToNumber]
        },
        {
            //The memory usage with high watermark properties expressed in bytes.
            uid: "mem_limit",
            label: "Memory limit",
            execute: extractValue(nodes, "mem_limit"),
            unit: "B"
        },
        {
            //The memory usage expressed in bytes.
            uid: "mem_used",
            label: "Memory used",
            execute: extractValue(nodes, "mem_used"),
            unit: "B"
        },
        {
            //The number of network partitions, which this node "sees".
            uid: "partitions",
            label: "Number of network partitions",
            execute: [extractValue(nodes, "partitions"), length]
        },
        {
            //The version of the RabbitMQ on the node, which processed this request.
            uid: "rabbitmq_version",
            label: "RabbitMQ version",
            execute: extractValue(overview, "rabbitmq_version")
        },
        {
            //The average number of Erlang processes waiting to run.
            uid: "run_queue",
            label: "Runtime run queue",
            execute: extractValue(nodes, "run_queue")
        },
        {
            //The file descriptors available for use as sockets.
            uid: "sockets_total",
            label: "Sockets available",
            execute: extractValue(nodes, "sockets_total")
        },
        {
            //The number of file descriptors used as sockets.
            uid: "sockets_used",
            label: "Sockets used",
            execute: extractValue(nodes, "sockets_used")
        },
        {
            //Uptime expressed in milliseconds.
            uid: "uptime",
            label: "Uptime",
            execute: [extractValue(nodes, "uptime"), multiplier(0.001)],
            unit: "S"
        },
        {
            //The descriptors of the used file.
            uid: "fd_used",
            label: "Used file descriptors",
            execute: extractValue(nodes, "fd_used")
        }
    ];
}

//fill the dynamic table with data related to queues  
function fillTable() {
    queues.forEach(function (item) {
        var id = "[" + item.name + "]" + "[" + item.vhost + "]";
        var deliverGetDetails = item.message_stats && item.message_stats.deliver_get_details && item.message_stats.deliver_get_details.rate || 0;
        var deliverGet = item.message_stats && item.message_stats.deliver_get || 0;
        var unacknowledgedDetails = item.messages_unacknowledged_details && item.messages_unacknowledged_details.rate || 0;
        var unacknowledged = item.messages_unacknowledged || 0;
        var redeliverDetails = item.message_stats && item.message_stats.redeliver_details && item.message_stats.redeliver_details.rate || 0;
        var redelivered = item.message_stats && item.message_stats.redeliver || 0;
        var readyDetails = item.messages_ready_details && item.messages_ready_details.rate || 0;
        var ready = item.messages_ready || 0;
        var publishDetails = item.message_stats && item.message_stats.publish_details && item.message_stats.publish_details.rate || 0;
        var published = item.message_stats && item.message_stats.publish || 0;
        var messagesDetails = item.messages_details && item.messages_details.rate || 0;
        var deliverDetails = item.message_stats && item.message_stats.deliver_details && message_stats.deliver_details.rate || 0;
        var delivered = item.message_stats && item.message_stats.deliver || 0;
        var ackDetails = item.message_stats && item.message_stats.ack_details && message_stats.ack_details.rate || 0;
        var acknowledged = item.message_stats && item.message_stats.ack || 0;
        var queueMessages = item.messages || 0;
        var queueMemory = item.memory || 0;
        var queueConsumers = item.consumers || 0;
        table.insertRecord(id, [
            deliverGetDetails,
            deliverGet,
            unacknowledgedDetails,
            unacknowledged,
            redeliverDetails,
            redelivered,
            readyDetails,
            ready,
            publishDetails,
            published,
            messagesDetails,
            deliverDetails,
            delivered,
            ackDetails,
            acknowledged,
            queueMessages,
            queueMemory,
            queueConsumers
        ]);
    });
}

/**
 * @param {[object]} data array of objects 
 * @returns list of domotz variables
 */
function extract(data) {
    vars = monitoringList.map(function (c) {
        var result;
        if (Array.isArray(c.execute)) {
            result = c.execute.reduce(function (a, b) { return b(a); }, data);
        } else if (typeof (c.execute) == "function") {
            result = c.execute(data);
        }
        if (result != null) {
            return D.device.createVariable(c.uid, c.label, result, c.unit, c.type);
        } else {
            return null;
        }
    }).filter(function (v) {
        return v != null;
    });
}

// load nodes, queues, overview and helthcheck informations
function loadData() {
    return D.q.all([
        getNodes(),
        getNodesOverview(),
        getQueues(),
        getHealthcheckMirrorSync(),
        getHealthcheckCertExpiry(),
        getHealthcheckLocalAlarms(),
        getHealthcheckQuorumCritical(),
        getHealthcheckVirtualHosts()
    ]).then(function () {
        fillConfig();
    });
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the node metrics apis are accessible
 */
function validate() {
    loadData()
        .then(function () {
            D.success();
        });

}

//Indicate the successful execution for variable list and table
function success() {
    D.success(vars, table);
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to extract monitoring parameters from RabbitMQ nodes.
 * 
 */
function get_status() {
    loadData()
        .then(extract)
        .then(fillTable)
        .then(success)
        .catch(function (err) {
            D.failure(D.errorType.GENERIC_ERROR);
        });
}