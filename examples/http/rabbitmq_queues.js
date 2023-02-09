/** 
 * This driver gets queues from RabbitMQ management plugin provided an HTTP-based API using HTTP agent
 * Communication protocol is http
 * Communicate with http api using USERNAME and PASSWORD
 * Dynamically create a table with specific columns in table variable.
 * Return a table with this columns:
 * -------------------------------------
 * Name: Name of the queue
 * Vhost: Vhost of the queue
 * Type: Type of the queue
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
var queues;
var page = 1, size = 100;
// var queueNameRegex = ""; // Parameter used to filter queue names
var table = D.createTable("Queues", [
    { label: "Name" },
    { label: "Vhost" },
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
 * @returns promise for http response containing queues info
 */
function getQueues() {
    query = "/api/queues";
    params = [];
    if (typeof page !== "undefined") params.push("page=" + page);
    if (typeof size !== "undefined") params.push("page_size=" + size);
    if (typeof queueNameRegex !== "undefined") params.push("name=" + queueNameRegex + "&use_regex=true");
    if (params.length)
        query += "?" + params.join("&");
    return httpGet(query)
        .then(JSON.parse)
        .then(function (data) {
            if (typeof page === "undefined")
                queues = data;
            else
                queues = data.items;
        });
}
//fill the dynamic table with data related to queues  
function fillTable() {
    queues.forEach(function (item) {
        var recordId = ("[" + item.name + "]" + "[" + item.vhost + "]").substring(0, 50);
        var name = item.name;
        var vhost = item.vhost;
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
        table.insertRecord(recordId, [
            name,
            vhost,
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

// load queues informations
function loadData() {
    return D.q.all([
        getQueues()
    ]);
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if queues are accessible
 */
function validate() {
    loadData()
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
 * @documentation This procedure is used to extract monitoring parameters from RabbitMQ queues.
 * 
 */
function get_status() {
    loadData()
        .then(fillTable)
        .then(success)
        .catch(function (err) {
            D.failure(D.errorType.GENERIC_ERROR);
        });
}