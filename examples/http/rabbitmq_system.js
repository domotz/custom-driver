/** 
 * This driver gets nodes and cluster metrics from RabbitMQ management plugin provided an HTTP-based API using HTTP agent.
 * Communication protocol is http
 * Communicate with http api using USERNAME and PASSWORD
 * Tested with RabbitMQ version: 3.11.5 under Ubuntu 22.04.1 LTS 
 */

var port = 15672;
var nodes, overview, monitoringList;
var vars = [];
var healthcheck = {};
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
 * @returns promise for http response body containig overview info
 */
function getOverview() {
    return httpGet("/api/overview")
        .then(JSON.parse)
        .then(function (data) {
            overview = data;
        });
}

/**
 * @returns promise for http response body containig healthcheck info
 */
function getHealthcheck() {
    return httpGet("/api/health/checks/alarms")
        .then(JSON.parse)
        .then(function (data) {
            healthcheck.helth = data;
        });
}
/**
 * @returns promise for http response body to return the cluster name
 */
function loadConfig() {
    return httpGet("/api/nodes/")
        .then(JSON.parse)
        .then(function (data) {
            return data[0].name;
        });
}

/**
 * @returns promise for http response body containig nodes info
 */
function getNodes(cluster) {
    return httpGet("/api/nodes/" + cluster + "?memory=true")
        .then(JSON.parse)
        .then(function (data) {
            nodes = data;
            console.log(nodes);
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
 * @param {object} data for cluster informations
 * @returns extract values of all RabbitMQ cluster
 */
function extractValue(data, key) {
    return function () {
        return data[key] || 0;
    };
}

// The list of custom driver variables to monitor
function fillConfig() {
    monitoringList = [
        {
            //The total number of queues.
            uid: "queues",
            label: "Queues total",
            execute: extractValue(overview.object_totals, "queues")
        },
        {
            //The number of unacknowledged messages.
            uid: "messages_unacknowledged",
            label: "Messages unacknowledged",
            execute: extractValue(overview.queue_totals, "messages_unacknowledged")
        },
        {
            //The total number of messages (ready, plus unacknowledged).
            uid: "messages",
            label: "Messages total",
            execute: extractValue(overview.queue_totals, "messages")
        },
        {
            //The rate of messages (per second) returned to a publisher as unroutable.
            uid: "return_unroutab_details",
            label: "Messages returned unroutable per second",
            execute: extractValue(overview.message_stats, "return_unroutable_details"),
            type: D.valueType.RATE
        },
        {
            //The count of messages returned to a publisher as unroutable.
            uid: "return_unroutab",
            label: "Messages returned unroutable",
            execute: extractValue(overview.message_stats, "return_unroutable")
        },
        {
            //The rate of subset of messages (per second) in the `deliver_get`, which had the `redelivered` flag set.
            uid: "redeliver_details",
            label: "Messages returned redeliver per second",
            execute: extractValue(overview.message_stats, "redeliver_details"),
            type: D.valueType.RATE
        },
        {
            //The count of subset of messages in the `deliver_get`, which had the `redelivered` flag set.
            uid: "redeliver",
            label: "Messages returned redeliver",
            execute: extractValue(overview.message_stats, "redeliver")
        },
        {
            //The number of messages ready for delivery.
            uid: "messages_ready",
            label: "Messages ready for delivery",
            execute: extractValue(overview.message_stats, "messages_ready")
        },
        {
            //The rate of messages (per second) published from this overview into queues.
            uid: "publish_out_details",
            label: "Messages publish_out per second",
            execute: extractValue(overview.message_stats, "publish_out_details"),
            type: D.valueType.RATE
        },
        {
            //The count of messages published from this overview into queues.
            uid: "publish_out",
            label: "Messages publish_out",
            execute: extractValue(overview.message_stats, "publish_out")
        },
        {
            //The rate of messages (per second) published from the channels into this overview.
            uid: "publish_in_details",
            label: "Messages publish_in per second",
            execute: extractValue(overview.message_stats, "publish_in_details"),
            type: D.valueType.RATE
        },
        {
            //The count of messages published from the channels into this overview.
            uid: "publish_in",
            label: "Messages publish_in",
            execute: extractValue(overview.message_stats, "publish_in")
        },
        {
            //The rate of published messages per second.
            uid: "publish_details",
            label: "Messages published per second",
            execute: extractValue(overview.message_stats, "publish_details"),
            type: D.valueType.RATE
        },
        {
            //The count of published messages.
            uid: "publish",
            label: "Messages published",
            execute: extractValue(overview.message_stats, "publish")
        },
        {
            //The rate of the sum of messages (per second) delivered to consumers in acknowledgement and no-acknowledgement mode.
            uid: "deliver_get_details",
            label: "Messages delivered per second",
            execute: extractValue(overview.message_stats, "deliver_get_details"),
            type: D.valueType.RATE
        },
        {
            //The sum of messages delivered to consumers in acknowledgement and no-acknowledgement mode.
            uid: "deliver_get",
            label: "Messages delivered",
            execute: extractValue(overview.message_stats, "deliver_get")
        },
        {
            //The rate of confirmed messages per second.
            uid: "confirm_details",
            label: "Messages confirmed per second",
            execute: extractValue(overview.message_stats, "confirm_details"),
            type: D.valueType.RATE
        },
        {
            //The count of confirmed messages.
            uid: "confirm",
            label: "Messages confirmed",
            execute: extractValue(overview.message_stats, "confirm")
        },
        {
            //The rate of messages (per second) delivered to clients and acknowledged.
            uid: "ack_details",
            label: "Messages acknowledged per second",
            execute: extractValue(overview.message_stats, "ack_details"),
            type: D.valueType.RATE
        },
        {
            //The number of messages delivered to clients and acknowledged.
            uid: "ack",
            label: "Messages acknowledged",
            execute: extractValue(overview.message_stats, "ack")
        },
        {
            //Checks if there are no alarms in effect in the cluster
            uid: "alarms",
            label: "Healthcheck: alarms in effect in the cluster",
            execute: extractValue(healthcheck.helth, "status")
        },
        {
            //The total number of exchanges.
            uid: "exchanges",
            label: "Exchanges total",
            execute: extractValue(overview.object_totals, "exchanges")
        },
        {
            //The total number of consumers.
            uid: "consumers",
            label: "Consumers total",
            execute: extractValue(overview.object_totals, "consumers")
        },
        {
            //The total number of connections.
            uid: "connections",
            label: "Connections total",
            execute: extractValue(overview.object_totals, "connections")
        },
        {
            //The total number of channels.
            uid: "channels",
            label: "Channels total",
            execute: extractValue(overview.object_totals, "channels")
        },
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
            label: "Healthcheck: local alarms in effect on this node",
            execute: extractValue(healthcheck.local_alarms, "status")
        },
        {
            //Checks if there are quorum queues with minimum online quorum.
            uid: "quorum",
            label: "Healthcheck: queues with minimum online quorum",
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

/**
* 
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

// load overview, helthcheck and exchanges informations
function loadData() {
    return D.q.all([
        getOverview(),
        getHealthcheck(),
        getHealthcheckMirrorSync(),
        getHealthcheckCertExpiry(),
        getHealthcheckLocalAlarms(),
        getHealthcheckQuorumCritical(),
        getHealthcheckVirtualHosts()
    ])
        .then(function () {
            fillConfig();
        });
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver rabbitmq cluster is accessible for the device.
 */
function validate() {
    loadData()
        .then(function () {
            D.success();
        });
}

//Indicate the successful execution for variable list and table
function success() {
    D.success(vars);
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to extract monitoring parameters from RabbitMQ cluster.
 */
function get_status() {
    loadConfig()
        .then(getNodes)
        .then(loadData)
        .then(extract)
        .then(success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

