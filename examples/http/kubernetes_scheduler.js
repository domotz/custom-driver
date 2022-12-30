
/**
 * This driver extract kubernetes Scheduler metrics
 * Communication protocol is http
 * dynamically create metrics for Kubernetes Scheduler depending from response of the service
 * communicate with http api using a jwt token generated with this command: 
 * # kubectl -n kube-system create token default --duration=8760h
 * this command returns a jwt token valid for a year for kube-system user
 * tested with minikube version: v1.28.0 under Ubuntu 22.04.1 LTS 
 */

var _var = D.device.createVariable;
var token = D.device.password();
var port = 27000;

/**
 * 
 * @returns promise for http response body containig Kubernetes API metrics in PROMETHEUS format
 */
function getMetrics() {
    var d = D.q.defer();
    D.device.http.get({
        url: "/metrics",
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
 * @param {[number]} data 
 * @returns sum of array
 */
function sum(data) {
    if (!data.length) return null;
    return data.reduce(function (a, b) { return a + b; }, 0);
}

/**
 * 
 * @param {string} key parameter key
 * @param {function} filterFn filter function
 * @returns sum of returned data based on the key and the filter function
 */
function getValueSum(key, filterFn){
    return function(data){
        return data
            .filter(function(d){return d.key == key && (filterFn ? filterFn(d) : true);})
            .map(function(d){return parseFloat(d.value);})
            .reduce(function(a,b){return a + b;}, 0);
    };
}

// config variable containing the list of monitoring parameters
var config = [
    {
        uid: "rest_client_requests_total_200",
        label: "HTTP requests: 2xx",
        execute: [statusFilter("rest_client_requests_total","2"), sum],
        type: D.valueType.RATE
    },
    {
        uid: "rest_client_requests_total_300",
        label: "HTTP requests: 3xx",
        execute: [statusFilter("rest_client_requests_total","3"), sum],
        type: D.valueType.RATE
    },
    {
        uid: "rest_client_requests_total_400",
        label: "HTTP requests: 4xx",
        execute: [statusFilter("rest_client_requests_total","4"), sum],
        type: D.valueType.RATE
    },
    {
        uid: "rest_client_requests_total_500",
        label: "HTTP requests: 5xx",
        execute: [statusFilter("rest_client_requests_total","5"), sum],
        type: D.valueType.RATE
    },
    {
        uid: "cpu",
        label: "CPU",
        execute: [getValueSum("process_cpu_seconds_total"), multiplier(100)],
        type: D.valueType.RATE
    },
    {
        uid: "max_fds",
        label: "Fds max",
        execute: getValueSum("process_max_fds")
    },
    {
        uid: "open_fds",
        label: "Fds open",
        execute: getValueSum("process_open_fds")
    },
    {
        uid: "go_goroutines",
        label: "Goroutines",
        execute: getValueSum("go_goroutines")
    },
    {
        uid: "go_threads",
        label: "Go threads",
        execute: getValueSum("go_threads")
    },
    {
        uid: "process_resident_memory_bytes",
        label: "Resident memory",
        execute: getValueSum("process_resident_memory_bytes"),
        unit: "B"
    },
    {
        uid: "process_virtual_memory_bytes",
        label: "Virtual memory,",
        execute: getValueSum("process_virtual_memory_bytes"),
        type: D.valueType.RATE,
        unit: "B"
    },
    {
        uid: "scheduler_schedule_attempts_error",
        label: "Schedule attempts: error",
        execute: getValueSum("scheduler_schedule_attempts_total", function(d){return d.desc.result == "error";}),
        type: D.valueType.RATE,
    },
    {
        uid: "scheduler_schedule_attempts_scheduled",
        label: "Schedule attempts: scheduled",
        execute: getValueSum("scheduler_schedule_attempts_total", function(d){return d.desc.result == "scheduled";}),
        type: D.valueType.RATE,
    },
    {
        uid: "scheduler_schedule_attempts_unschedulable",
        label: "Schedule attempts: unschedulable",
        execute: getValueSum("scheduler_schedule_attempts_total", function(d){return d.desc.result == "unschedulable";}),
        type: D.valueType.RATE,
    }

];

/**
 * 
 * @param {number} number multiplier
 * @returns the value muliplied by the number
 */
function multiplier(number){
    return function(value){
        return value*number;
    };
}

/**
 * 
 * @param {[object]} data array of objects 
 * @returns list of domotz variables
 */
function extract(data) {
    return config.map(function (c) {
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

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the metrics api is accessible
*/
function validate() {
    getMetrics()
        .then(function(){
            D.success();
        });
}

function success(vars){
    D.success(vars);
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    getMetrics()
        .then(convert)
        .then(extract)
        .then(success)
        .catch(function(err){
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}