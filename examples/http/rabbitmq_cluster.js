/** 
 * This driver gets cluster metrics from RabbitMQ management plugin provided an HTTP-based API using HTTP agent.
 * Communication protocol is http
 * Communicate with http api using USERNAME and PASSWORD
 * Dynamically create a table with specific columns in table variable.
 * Tested with RabbitMQ version: 3.11.5 under Ubuntu 22.04.1 LTS 
 */

var port = 15672;
var overview, healthcheck, exchanges, monitoringList;
var vars = [];
var table = D.createTable("Cluster", [
    { label: "Returned unroutable per second" },
    { label: "Returned unroutable" },
    { label: "Redelivered per second" },
    { label: "Redelivered" },
    { label: "Publish_out per second" },
    { label: "Publish_out" },
    { label: "Publish_in per second" },
    { label: "Publish_in" },
    { label: "Published per second" },
    { label: "Published" },
    { label: "Delivered per second" },
    { label: "Delivered" },
    { label: "Confirmed per second" },
    { label: "Confirmed" },
    { label: "Acknowledged per second" },
    { label: "Acknowledged" }
]);

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
            healthcheck = data;
        });
}

/**
 * @returns promise for http response body containig exchanges info
 */
function getExchanges() {
    return httpGet("/api/exchanges")
        .then(function (body) {
            exchanges = JSON.parse(body);
        });
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
            uid: "queues",
            label: "Queues total",
            execute: extractValue(overview.object_totals, "queues")
        },
        {
            uid: "messages_unacknowledged",
            label: "Messages unacknowledged",
            execute: extractValue(overview.queue_totals, "messages_unacknowledged")
        },
        {
            uid: "messages",
            label: "Messages total",
            execute: extractValue(overview.queue_totals, "messages")
        },
        {
            uid: "return_unroutable_details",
            label: "Messages returned unroutable per second",
            execute: extractValue(overview.message_stats, "return_unroutable_details"),
            type: D.valueType.RATE
        },
        {
            uid: "return_unroutable",
            label: "Messages returned unroutable",
            execute: extractValue(overview.message_stats, "return_unroutable")
        },
        {
            uid: "redeliver_details",
            label: "Messages returned redeliver per second",
            execute: extractValue(overview.message_stats, "redeliver_details"),
            type: D.valueType.RATE
        },
        {
            uid: "redeliver",
            label: "Messages returned redeliver",
            execute: extractValue(overview.message_stats, "redeliver")
        },
        {
            uid: "messages_ready",
            label: "Messages ready for delivery",
            execute: extractValue(overview.message_stats, "messages_ready")
        },
        {
            uid: "publish_out_details",
            label: "Messages publish_out per second",
            execute: extractValue(overview.message_stats, "publish_out_details"),
            type: D.valueType.RATE
        },
        {
            uid: "publish_out",
            label: "Messages publish_out",
            execute: extractValue(overview.message_stats, "publish_out")
        },
        {
            uid: "publish_in_details",
            label: "Messages publish_in per second",
            execute: extractValue(overview.message_stats, "publish_in_details"),
            type: D.valueType.RATE
        },
        {
            uid: "publish_in",
            label: "Messages publish_in",
            execute: extractValue(overview.message_stats, "publish_in")
        },
        {
            uid: "publish_details",
            label: "Messages published per second",
            execute: extractValue(overview.message_stats, "publish_details"),
            type: D.valueType.RATE
        },
        {
            uid: "publish",
            label: "Messages published",
            execute: extractValue(overview.message_stats, "publish")
        },
        {
            uid: "deliver_get_details",
            label: "Messages delivered per second",
            execute: extractValue(overview.message_stats, "deliver_get_details"),
            type: D.valueType.RATE
        },
        {
            uid: "deliver_get",
            label: "Messages delivered",
            execute: extractValue(overview.message_stats, "deliver_get")
        },
        {
            uid: "confirm_details",
            label: "Messages confirmed per second",
            execute: extractValue(overview.message_stats, "confirm_details"),
            type: D.valueType.RATE
        },
        {
            uid: "confirm",
            label: "Messages confirmed",
            execute: extractValue(overview.message_stats, "confirm")
        },
        {
            uid: "ack_details",
            label: "Messages acknowledged per second",
            execute: extractValue(overview.message_stats, "ack_details"),
            type: D.valueType.RATE
        },
        {
            uid: "ack",
            label: "Messages acknowledged",
            execute: extractValue(overview.message_stats, "ack")
        },
        {
            uid: "alarms",
            label: "Healthcheck: alarms in effect in the cluster",
            execute: extractValue(healthcheck, "status")
        },
        {
            uid: "exchanges",
            label: "Exchanges total",
            execute: extractValue(overview.object_totals, "exchanges")
        },
        {
            uid: "consumers",
            label: "Consumers total",
            execute: extractValue(overview.object_totals, "consumers")
        },
        {
            uid: "connections",
            label: "Connections total",
            execute: extractValue(overview.object_totals, "connections")
        },
        {
            uid: "channels",
            label: "Channels total",
            execute: extractValue(overview.object_totals, "channels")
        }
    ];
}

function fillTable() {
    exchanges.forEach(function (item) {
        var id = "[" + item.name + "]" + "[" + item.vhost + "]" + "[" + item.type + "]";
        var unroutableDetails = item.message_stats && item.message_stats.return_unroutable_details && item.message_stats.return_unroutable_details.rate || 0;
        var unroutable = item.message_stats && item.message_stats.return_unroutable || 0;
        var redeliverDetails = item.message_stats && item.message_stats.redeliver_details && item.message_stats.redeliver_details.rate || 0;
        var redelivered = item.message_stats && item.message_stats.redeliver || 0;
        var publishOutDetails = item.message_stats && item.message_stats.publish_out_details && item.message_stats.publish_out_details.rate || 0;
        var publishOut = item.message_stats && item.message_stats.publish_out || 0;
        var publishInDetails = item.message_stats && item.message_stats.publish_in_details && item.message_stats.publish_in_details.rate || 0;
        var publishIn = item.message_stats && item.message_stats.publish_in || 0;
        var publishDetails = item.message_stats && item.message_stats.publish_details && item.message_stats.publish_details.rate || 0;
        var published = item.message_stats && item.message_stats.publish || 0;
        var deliverGetDetails = item.message_stats && item.message_stats.deliver_get_details && item.message_stats.deliver_get_details.rate || 0;
        var deliverGet = item.message_stats && item.message_stats.deliver_get || 0;
        var confirmDetails = item.message_stats && item.message_stats.confirm_details && item.message_stats.confirm_details.rate || 0;
        var confirmed = item.message_stats && item.message_stats.confirm || 0;
        var ackDetails = item.message_stats && item.message_stats.ack_details && item.message_stats.ack_details.rate || 0;
        var acknowledged = item.message_stats && item.message_stats.ack || 0;
        table.insertRecord(id, [
            unroutableDetails,
            unroutable,
            redeliverDetails,
            redelivered,
            publishOutDetails,
            publishOut,
            publishInDetails,
            publishIn,
            publishDetails,
            published,
            deliverGetDetails,
            deliverGet,
            confirmDetails,
            confirmed,
            ackDetails,
            acknowledged
        ]);
    });
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

//Load all data
function loadData() {
    return D.q.all([
        getOverview(),
        getHealthcheck(),
        getExchanges()
    ]).then(function () {
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


function success() {
    D.success(vars, table);
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to extract monitoring parameters from RabbitMQ cluster.
 */
function get_status() {
    loadData()
        .then(extract)
        .then(fillTable)
        .then(success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

