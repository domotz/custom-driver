/** 
 * This driver gets node metrics from RabbitMQ management plugin provided an HTTP-based API using HTTP agent
 * Communication protocol is http
 * Communicate with http api using USERNAME and PASSWORD
 * The rabbitmq cluster name is modified in each installation.So, you can find it in the right side of the rabbitmq GUI. example: Cluster rabbit@319ac541e311
 * Tested with RabbitMQ version: 3.11.5 under Ubuntu 22.04.1 LTS 
 */
var port = 15672;
var nodes, overview, monitoringList;
var healthcheck = {};
var vars = [];
var cluster = "TO_CHANGE_CLUSTER_NAME" // example: rabbit@319ac541e311
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
 * @param {string} body 
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
            uid: "disk_free_alarm",
            label: "Disk free alarm",
            execute: [extractValue(nodes, "disk_free_alarm"), convertToNumber]
        },
        {
            uid: "disk_free_limit",
            label: "Disk free limit",
            execute: extractValue(nodes, "disk_free_limit"),
            unit: "B"
        },
        {
            uid: "disk_free",
            label: "Free disk space",
            execute: extractValue(nodes, "disk_free"),
            unit: "B"
        },
        {
            uid: "mirror_sync",
            label: "Healthcheck: classic mirrored queues without synchronized mirrors online",
            execute: extractValue(healthcheck.mirror_sync, "status")
        },
        {
            uid: "certificate_expiration",
            label: "Healthcheck: expiration date on the certificates",
            execute: extractValue(healthcheck.certificate_expiration, "status")
        },
        {
            uid: "local_alarms",
            label: "Healthcheck: expiration date on the certificates",
            execute: extractValue(healthcheck.local_alarms, "status")
        },
        {
            uid: "quorum",
            label: "Healthcheck: local alarms in effect on this node",
            execute: extractValue(healthcheck.quorum, "status")
        },
        {
            uid: "virtual_hosts",
            label: "Healthcheck: virtual hosts on this node",
            execute: extractValue(healthcheck.virtual_hosts, "status")
        },
        {
            uid: "running",
            label: "Is running",
            execute: [extractValue(nodes, "running"), convertToNumber]
        },
        {
            uid: "management_version",
            label: "Management plugin version",
            execute: extractValue(overview, "management_version")
        },
        {
            uid: "mem_alarm",
            label: "Memory alarm",
            execute: [extractValue(nodes, "mem_alarm"), convertToNumber]
        },
        {
            uid: "mem_limit",
            label: "Memory limit",
            execute: extractValue(nodes, "mem_limit"),
            unit: "B"
        },
        {
            uid: "mem_used",
            label: "Memory used",
            execute: extractValue(nodes, "mem_used"),
            unit: "B"
        },
        {
            uid: "partitions",
            label: "Number of network partitions",
            execute: [extractValue(nodes, "partitions"), length]
        },
        {
            uid: "rabbitmq_version",
            label: "RabbitMQ version",
            execute: extractValue(overview, "rabbitmq_version")
        },
        {
            uid: "run_queue",
            label: "Runtime run queue",
            execute: extractValue(nodes, "run_queue")
        },
        {
            uid: "sockets_total",
            label: "Sockets available",
            execute: extractValue(nodes, "sockets_total")
        },
        {
            uid: "sockets_used",
            label: "Sockets used",
            execute: extractValue(nodes, "sockets_used")
        },
        {
            uid: "uptime",
            label: "Uptime",
            execute: [extractValue(nodes, "uptime"), multiplier(0.001)],
            unit: "S"
        },
        {
            uid: "fd_used",
            label: "Used file descriptors",
            execute: extractValue(nodes, "fd_used")
        }
    ];
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

// load all data 
function loadData() {
    return D.q.all([
        getNodes(),
        getNodesOverview(),
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
        .then(function () { D.success(); });
}

function success() {
    D.success(vars);
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
        .then(success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}