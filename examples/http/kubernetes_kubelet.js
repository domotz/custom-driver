
/**
 * This driver extract Kubernetes kubelet metrics by HTTP agent from Prometheus metrics endpoint.
 * Communication protocol is http
 * dynamically create kubelet metrics for Kubernetes depending from response of the service
 * communicate with http api using a jwt token generated with this command: 
 * # kubectl -n kube-system create token default --duration=8760h
 * this command returns a jwt token valid for a year for kube-system user
 * tested with minikube version: v1.28.0 under Ubuntu 22.04.1 LTS 
 */

var _var = D.device.createVariable;
var token = D.device.password();
var port = 80;
var podsInfo, nodes, metrics, config;
var vars = [];
var table = D.createTable("Kubelets", [
    {label: "node"},
    {label: "namespace"},
    {label: "CPU: usage rate", type: D.valueType.RATE},
    {label: "CPU: System seconds"},
    {label: "CPU: User seconds"},
]);
Array.prototype._first = function () {
    return this.length ? this[0] : null;
};
Array.prototype._find = function (filterFn) {
    return this.filter(filterFn)._first();

};


function httpGet(url){
    var d = D.q.defer();
    D.device.http.get({
        url: url,
        port: port,
        headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
        }
    }, function (err, response, body) {
        if (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if(response.statusCode == 404){
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        if(response.statusCode == 401){
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        if(response.statusCode != 200){
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(body);

    });
    return d.promise;
}

/**
 * 
 * @returns promise for http response body containig Kubernetes API metrics in PROMETHEUS format
 */
function getMetrics() {
    return httpGet("/metrics")
        .then(convert)
        .then(function(data){
            metrics = data;
        });
}

/**
 * 
 * @param {string} node kubernetes node
 * @returns promise for metrics for the specific node
 */
function getCadvisorMetrics(node){
    return httpGet("/api/v1/nodes/"+node+"/proxy/metrics/cadvisor")
        .then(convert);
}

/**
 * 
 * @returns promise containing pods info
 */
function getPods(){
    return httpGet("/api/v1/pods")
        .then(JSON.parse)
        .then(extractPodsInfo);
}

/**
 * 
 * @returns load all kubernetes node metrics
 */
function getNodesMetrics(){
    return httpGet("/api/v1/nodes")
        .then(JSON.parse)
        .then(function(data){
            nodes = data.items.map(function(item){
                var ii = item.status.addresses._find(function(a) {return a.type == "InternalIP";});
                if(ii.address)
                    return {
                        name: item.metadata.name,
                        ip: ii.address
                    };
                return null;
            }).filter(function(d) { return d; });
            return nodes;
        }).then(function(nodes){
            return D.q.all(nodes.map(function(node){
                return getCadvisorMetrics(node.name);
            }));
        }).then(function(metrics){
            for(var i = 0; i<metrics.length; i++){
                nodes[i].metrics = metrics[i];
            }
        });
}

/**
 * 
 * @param {object} body pods api response body
 * @returns parsed pods infos
 */
function extractPodsInfo(body){
    podsInfo = body.items.map(function(e){
        return {
            podName: e.metadata.name,
            namespace: e.metadata.namespace,
            containerStatuses: e.status.containerStatuses,
            running: e.status.phase == "Running",
            hostIp: e.status.hostIP
        };
    });
    return podsInfo;
}

/**
 * 
 * @param {string} body containing metrics api response in PROMETHEUS format
 * @returns convert PROMETHEUS format to Javascript object
 */
function convert(body) {
    var lines = body.split("\n");
    var result = lines
        .filter(function (line) { return line.indexOf("#") != 0 && line; })
        .map(function (line) {
            var matches = line.match(/^([^\{]*)(\{(.*)\})? (.*)$/);
            var key = matches[1];
            var desc = matches[3] ? matches[3].split(",").reduce(function (a, b) {
                var keyValue = b.split("=");
                a[keyValue[0]] = keyValue[1].substring(1, keyValue[1].length - 1);
                return a;
            }, {}) : null;
            var value = matches[4];
            return { key: key, desc: desc, value: value };
        });
    return result;
}

/**
 * 
 * @param {string} key parameter key
 * @param {string} statusFirstNumber http status prefix
 * @returns value
 */
function statusFilter(key, statusFirstNumber) {
    return function (data) {
        return data.filter(function (d) {
            return d.key == key && d.desc != null && d.desc.code && d.desc.code.indexOf(statusFirstNumber) == 0;
        }).map(function (d) { return parseFloat(d.value); });
    };
}

/**
 * 
 * @param {string} key parameter key
 * @param {function} filterFn filter function
 * @returns sum of returned data based on the key and the filter function
 */
function getValueSum(metrics, key, filterFn){
    return function(){
        return metrics
            .filter(function(d){return d.key == key && (filterFn ? filterFn(d) : true);})
            .map(function(d){return parseFloat(d.value.split(" ")[0]);})
            .reduce(function(a,b){return a + b;}, 0);
    };
}

// config variable containing the list of monitoring parameters
function fillConfig(){
    config = [

        {
            uid: "containers_terminated",
            label: "Containers last state terminated",
            execute: function(){
                var terminatedContainers = podsInfo.map(function(item){
                    var res = item.containerStatuses.filter(function(cs){
                        return cs.lastState && cs.lastState.terminated && cs.lastState.terminated.exitCode;
                    });
                    return res.length;
                }).reduce(function(a,b){return a+b;}, 0);
                return terminatedContainers;
            },
        },
        {
            uid: "containers_restarts",
            label: "Containers restarts",
            execute: function(){
                var restartCount = podsInfo.map(function(item){
                    var res = item.containerStatuses.reduce(function(a,b){return a+b.restartCount;},0);
                    return res;
                }).reduce(function(a,b){return a+b;}, 0);
                return restartCount;
            },
        },
        {
            uid: "containers_running",
            label: "Containers running",
            execute: function(){
                var runningCount = podsInfo.map(function(item){
                    var res = item.containerStatuses.filter(function(cs){
                        return cs.state && cs.state.running;
                    });
                    return res.length;
                }).reduce(function(a,b){return a+b;}, 0);
                return runningCount;
            },
        },
        {
            uid: "pods_running",
            label: "Pods running",
            execute: function(){
                return podsInfo.filter(function(item){
                    return item.running;
                }).length;
            },
        },
        {
            uid: "cpu_cores",
            label: "CPU cores, total",
            execute: getValueSum(metrics,"machine_cpu_cores"),
        },
        {
            uid: "process_max_fds",
            label: "File descriptors, max",
            execute: getValueSum(metrics,"process_max_fds"),
        },
        {
            uid: "process_open_fds",
            label: "File descriptors, open",
            execute: getValueSum(metrics,"process_open_fds"),
        },
        {
            uid: "machine_memory",
            label: "Machine memory",
            execute: getValueSum(metrics,"process_resident_memory_bytes"),
            unit: "B"
        },
        {
            uid: "virtual_memory",
            label: "Virtual memory",
            execute: getValueSum(metrics,"process_virtual_memory_bytes"),
            unit: "B"
        },
       
    ];
}

function fillTable() {
    podsInfo.map(function(item){
        var node = nodes._find(function(n) {return n.ip == item.hostIp;});
        return {
            id: item.podName,
            row: [
                node.name,
                item.namespace,
                getValueSum(node.metrics, "container_cpu_usage_seconds_total", function(d){
                    return d.desc.pod==item.podName && d.desc.namespace == item.namespace;
                })(),
                getValueSum(node.metrics, "container_cpu_system_seconds_total", function(d){
                    return d.desc.pod==item.podName && d.desc.namespace == item.namespace;
                })(),
                getValueSum(node.metrics, "container_cpu_user_seconds_total", function(d){
                    return d.desc.pod==item.podName && d.desc.namespace == item.namespace;
                })(),

            ]
        };
    }).forEach(function(item){
        table.insertRecord(item.id, item.row);
    });
}

/**
 * 
 * @param {string} number to convert to float
 * @returns float number
 */
function toFloat(number){
    if(number == "+Inf"){
        return Infinity;
    }else{
        return parseFloat(number);
    }
}



/**
 * 
 * @param {[object]} data array of objects 
 * @returns list of domotz variables
 */
function extract(data) {
    vars = config.map(function (c) {
        var result;
        if (Array.isArray(c.execute)) {
            result = c.execute.reduce(function (a, b) { return b(a); }, data);
        } else if (typeof (c.execute) == "function") {
            result = c.execute(data);
        }
        if(result){
            return _var(c.uid, c.label, result, c.unit, c.type);
        }else{
            return null;
        }
    }).filter(function(v){
        return v != null;
    });
}

function loadData(){
    return D.q.all([
        getMetrics(),
        getPods(),
        getNodesMetrics()
    ]).then(function(){
        fillConfig();
    });
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the metrics, pods and node metrics apis are accessible
*/
function validate() {
    loadData()
        .then(function(){
            D.success();
        });
}

function success(){
    D.success(vars, table);
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for kubernetes kubelet statistics
*/
function get_status() {
    loadData()
        .then(extract)
        .then(fillTable)
        .then(success)
        .catch(function(err){
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}