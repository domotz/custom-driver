
/**
 * This driver monitor Kubernetes state that work without any external scripts. It works without external scripts and uses the script item to make HTTP requests to the Kubernetes API
 * Communication protocol is http
 * dynamically create cluster state metrics for Kubernetes depending from response of the service
 * communicate with http api using a jwt token generated with this command: 
 * # kubectl -n kube-system create token default --duration=8760h
 * this command returns a jwt token valid for a year for kube-system user
 * tested with minikube version: v1.28.0 under Ubuntu 22.04.1 LTS 
 */


var _var = D.device.createVariable;
var token = D.device.password();
var port = 80;
var vars = [];
var metrics, componentStatuses, readyz, livez;

Array.prototype._first = function () {
    return this.length ? this[0] : null;
};

Array.prototype._find = function (filterFn) {
    return this.filter(filterFn)._first();

};


function httpGet(url) {
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
 * 
 * @returns promise for http response body containig Kubernetes API metrics in PROMETHEUS format
 */
function getMetrics() {
    return httpGet("/metrics")
        .then(convert);
}

function getComponentStatuses() {
    return httpGet("/api/v1/componentstatuses")
        .then(JSON.parse);
}

function convertVerboseData(body) {
    var output = [];
    body.split(/\n/).forEach(function (entry) {
        var component = entry.match(/^\[.+\](.+)\s(\w+)$/);
        if (component) {
            output.push({
                name: component[1],
                value: component[2]
            });
        }
    });

    return output;
}

function getLivez() {
    return httpGet("/livez?verbose")
        .then(convertVerboseData);
        
}

function getReadyz() {
    return httpGet("/readyz?verbose")
        .then(convertVerboseData);
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
 * @param {function} filterFn filter function
 * @returns sum of returned data based on the key and the filter function
 */
function getValueSum(key, filterFn) {
    return function () {
        return metrics
            .filter(function (d) { return d.key == key && (filterFn ? filterFn(d) : true); })
            .map(function (d) { return parseFloat(d.value); })
            .reduce(function (a, b) { return a + b; }, 0);
    };
}

// config variable containing the list of monitoring parameters
var config = [
    {
        uid: "CronJob_count",
        label: "CronJob count",
        execute: getValueSum("kube_cronjob_created")
    },
    {
        uid: "Deployment_count",
        label: "Deployment count",
        execute: getValueSum("kube_deployment_created")
    },
    {
        uid: "endpoint_count",
        label: "Endpoint count",
        execute: getValueSum("kube_endpoint_created")
    },
    {
        uid: "job_count",
        label: "Job count",
        execute: getValueSum("kube_job_created")
    },
    {
        uid: "service_count",
        label: "Service count",
        execute: getValueSum("kube_service_created")
    },
    {
        uid: "namespace_count",
        label: "Namespace count",
        execute: getValueSum("kube_namespace_created")
    },
    {
        uid: "node_count",
        label: "Node count",
        execute: getValueSum("kube_node_created")
    },
    {
        uid: "statefulset_count",
        label: "Statefulset count",
        execute: getValueSum("kube_statefulset_created")
    },

];

/**
 * fill component statuses variables in config
 */
function fillComponentsStatuses(){
    componentStatuses.items.forEach(function(cs){
        config.push({
            uid: "component_" + cs.metadata.name,
            label: "Component " + cs.metadata.name + " Healthy",
            execute: function(){
                var healthy = cs.conditions._find(function(c) { return c.type == "Healthy";});
                if(healthy) return healthy.status;
                return null;
            }
        });
    });
}

/**
 * fill livez variables in config
 */
function fillLivez(){
    livez.forEach(function(l){
        var index = l.name.lastIndexOf("/");
        config.push({
            uid: ("livez_" + l.name.substring(index+1)).substring(0, 50),
            label: "Livez " + l.name + " healthcheck",
            execute: function() { return l.value; }
        });
    });
}
/**
 * fill readyz variables in config
 */
function fillReadyz(){
    readyz.forEach(function(l){
        var index = l.name.lastIndexOf("/");
        config.push({
            uid: ("readyz_" + l.name.substring(index+1)).substring(0, 50),
            label: "Readyz " + l.name + " healthcheck",
            execute: function() { return l.value; }
        });
    });
}


function fillConfig(){
    fillComponentsStatuses();
    fillLivez();
    fillReadyz();

}


/**
 * 
 * @param {[object]} data array of objects 
 * @returns list of domotz variables
 */
function extract() {
    vars = config.map(function (c) {
        var result;
        if (Array.isArray(c.execute)) {
            result = c.execute.reduce(function (a, b) { return b(a); });
        } else if (typeof (c.execute) == "function") {
            result = c.execute();
        }
        if (result) {
            return _var(c.uid, c.label, result, c.unit, c.type);
        } else {
            return null;
        }
    }).filter(function (v) {
        return v != null;
    });
}

function loadData() {
    return D.q.all([
        getMetrics(),
        getComponentStatuses(),
        getLivez(),
        getReadyz()
    ]).then(function(data){
        metrics = data[0];
        componentStatuses = data[1];
        livez = data[2];
        readyz = data[3];
    });
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the metrics api is accessible
*/
function validate() {
    loadData()
        .then(function () {
            D.success();
        });
}

function success() {
    D.success(vars);
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    loadData()
        .then(function(){
            fillConfig();
        })
        .then(extract)
        .then(success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}