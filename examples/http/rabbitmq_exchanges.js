/** 
 * This driver gets exchanges from RabbitMQ management plugin provided an HTTP-based API using HTTP agent.
 * Communication protocol is http
 * Communicate with http api using USERNAME and PASSWORD
 * Dynamically create a table with specific columns in table variable.
 * Return a table with this columns:
 * -------------------------------------
 * name: Name of the exchange
 * Vhost: Vhost of the exchange
 * Type: Type of the exchange
 * Returned unroutable per second: The rate of messages (per second) returned to a publisher as unroutable.
 * Returned unroutable: The count of messages returned to a publisher as unroutable.
 * Redelivered per second: The rate of subset of messages (per second) in the `deliver_get`, which had the `redelivered` flag set.
 * Redelivered: The count of subset of messages in the `deliver_get`, which had the `redelivered` flag set.
 * Publish_out per second: The rate of messages (per second) published from this overview into queues.
 * Publish_out: The count of messages published from this overview into queues.
 * Publish_in per second: The rate of messages (per second) published from the channels into this overview.
 * Publish_in: The count of messages publsished from the channels into this overview.
 * Published per second: The rate of messages published per second.
 * Published: The count of published messages.
 * Delivered per second: The rate of the sum of messages (per second) delivered to consumers in acknowledgement and no-acknowledgement mode.
 * Delivered: The sum of messages delivered to consumers in acknowledgement and no-acknowledgement mode.
 * Confirmed per second: The rate of messages confirmed per second.
 * Confirmed: The count of confirmed messages.
 * Acknowledged per second: The rate of messages (per second) delivered to clients and acknowledged.
 * Acknowledged: The number of messages delivered to clients and acknowledged.
 * -------------------------------------
 * Tested with RabbitMQ version: 3.11.5 under Ubuntu 22.04.1 LTS 
 */

var port = 15672;
var exchanges;
var vars = [];
var table = D.createTable("Exchanges", [
    { label: "Name" },
    { label: "Vhost" },
    { label: "Type" },
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

/**
 * @returns promise for http response body
 */
function httpGet() {
    var d = D.q.defer();
    D.device.http.get({
        url: "/api/exchanges",
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
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

//fill the dynamic table with data related to exchanges. 
function fillTable(data) {
    data.forEach(function (item) {
        var recordId = ("[" + item.name + "]" + "[" + item.vhost + "]").substring(0, 50);
        var vhost = item.vhost;
        if (vhost === "/"){
            // Igore root level exchanges and only collect vhost child ones.
            // Remove conditional in case you want to monitor them as well
            return
        }
        var name = item.name;
        var type = item.type;
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
        table.insertRecord(recordId, [
            name,
            vhost,
            type,
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
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver rabbitmq exchanges is accessible for the device.
 */
function validate() {
    httpGet()
        .then(function () {
            D.success();
        });
}

//Indicate the successful execution for variable list and table
function success() {
    D.success(table);
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to extract monitoring parameters from RabbitMQ exchanges.
 */
function get_status() {
    httpGet()
        .then(fillTable)
        .then(success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

