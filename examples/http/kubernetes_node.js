

/**
 * This driver extract kubernetes pods information
 * Communication protocol is http
 * dynamically create table with columns specified in podTable variable
 * communicate with http api using a jwt token generated with this command: 
 * # kubectl -n kube-system create token default --duration=8760h
 * this command returns a jwt token valid for a year for kube-system user
 * tested with minikube version: v1.28.0 under Ubuntu 22.04.1 LTS 
 */

var podTable = D.createTable(
    "Pods",
    [
        { label: "Node: Metadata Name" },
        { label: "Node: Internal IP" },
        { label: "Node: External IP" },
        { label: "Node: Allocable CPU" },
        { label: "Node Cnd: Memory pressure" },
        { label: "Node Cnd: Network unavailable" },
        { label: "Node Cnd: PID pressure" },
        { label: "Node Cnd: Ready" },
        { label: "Node Cnd: Disk pressure" },
        { label: "Node Allocatable: Memory" },
        { label: "Node Allocatable: Pods" },
        { label: "Node Capacity: CPU" },
        { label: "Node Capacity: Memory" },
        { label: "Node Capacity: Pods" },
        { label: "Node Info: Architecture" },
        { label: "Node Info: Container runtime" },
        { label: "Node Info: Kernel version" },
        { label: "Node Info: Kubelet version" },
        { label: "Node Info: KubeProxy version" },
        { label: "Node Info: Operating system" },
        { label: "Node Info: Roles" },
        { label: "Node Limits: CPU" },
        { label: "Node Limits: Memory" },
        { label: "Node Requests: CPU" },
        { label: "Node Requests: Memory" },
        { label: "Node Uptime" },
        { label: "Node Used: Pods" },
        { label: "Pod Cnd: Containers ready" },
        { label: "Pod Cnd: Initialized" },
        { label: "Pod Cnd: Ready" },
        { label: "Pod Cnd: Scheduled" },
        { label: "Pod Containers: Restarts" },
        { label: "Pod Status: Phase" },
        { label: "Pod Start time" },
        { label: "Pod IP" },
    ]
);

var token = D.device.password();
var port = "80";

/**
 * 
 * @param {object} params http request parameters
 * @returns http api response
 */
function httpGet(params) {
    var d = D.q.defer();
    D.device.http.get(params, function (err, response) {
        if (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(response);

    });
    return d.promise;
}

var Kube = {
    params: {
        "api_endpoint": "/api/",
        "endpoint_name": "kubernetes",
        "token": token
    },
    pods_limit: 1000,
    request: function (query) {

        console.info("[ Kubernetes ] Sending request: " + Kube.params.api_endpoint + query);
        return httpGet({
            url: Kube.params.api_endpoint + query,
            port: port,
            headers: {
                "Authorization": "Bearer " + Kube.params.token,
                "Content-Type": "application/json"
            }
        }).then(function (response) {
            var status = response.statusCode;
            console.info("[ Kubernetes ] Received response with status code " + status + ": " + response);

            if (status < 200 || status >= 300) {
                throw "Request failed with status code " + status + ": " + response;
            }
            if (response !== null) {
                try {
                    response = JSON.parse(response.body);
                }
                catch (error) {
                    throw "Failed to parse response received from Kubernetes API. Check debug log for more information.";
                }
            }
            return {
                status: status,
                response: response
            };
        });


    },

    getNodes: function () {
        return Kube.request("v1/nodes")
            .then(function (result) {
                if (typeof result.response !== "object"
                    || typeof result.response.items === "undefined"
                    || result.status != 200) {
                    throw "Cannot get nodes from Kubernetes API. Check debug log for more information.";
                }

                return result.response;
            });

    },

    getPods: function () {
        var result = [],
            continue_token;
        function loop() {
            return Kube.request("v1/pods?limit=" + Kube.pods_limit
                + ((typeof continue_token !== "undefined") ? "&continue=" + continue_token : ""))
                .then(function (data) {

                    if (typeof data.response !== "object"
                        || typeof data.response.items === "undefined"
                        || data.status != 200) {
                        throw "Cannot get pods from Kubernetes API. Check debug log for more information.";
                    }

                    result.push.apply(result, data.response.items);
                    continue_token = data.response.metadata.continue || "";
                    if (continue_token !== "") return loop();
                    return result;
                });
        }

        return loop();

    },

    getEndpointIPs: function () {
        return Kube.request("v1/endpoints")
            .then(function (result) {
                epIPs = {};

                if (typeof result.response !== "object"
                    || typeof result.response.items === "undefined"
                    || result.status != 200) {
                    throw "Cannot get endpoints from Kubernetes API. Check debug log for more information.";
                }

                result.response.items.forEach(function (ep) {
                    if (ep.metadata.name === Kube.params.endpoint_name && Array.isArray(ep.subsets)) {
                        ep.subsets.forEach(function (subset) {
                            if (Array.isArray(subset.addresses)) {
                                subset.addresses.forEach(function (addr) {
                                    epIPs[addr.ip] = "";
                                });
                            }
                        });
                    }
                });

                return epIPs;
            });

    }
};

Fmt = {
    factors: {
        Ki: 1024, K: 1000,
        Mi: Math.pow(1024, 2), M: Math.pow(1000, 2),
        Gi: Math.pow(1024, 3), G: Math.pow(1000, 3),
        Ti: Math.pow(1024, 4), T: Math.pow(1000, 4),
    },

    cpuFormat: function (cpu) {
        if (typeof cpu === "undefined") {
            return 0;
        }

        if (cpu.indexOf("m") > -1) {
            return parseInt(cpu) / 1000;
        }

        return parseInt(cpu);
    },

    memoryFormat: function (mem) {
        if (typeof mem === "undefined") {
            return 0;
        }

        var pair = mem.match(/(\d+)(\w*)/),
            factor;

        if (pair) {
            factor = Fmt.factors[pair[2]];
            if (factor) {
                return parseInt(pair[1]) * factor;
            }

            return mem;
        }

        return parseInt(mem);
    }

};


/**
 * 
 * @returns object contains the pods informations
 */
function parse() {
    return D.q.all([
        Kube.getNodes(),
        Kube.getPods(),
        Kube.getEndpointIPs()
    ]).then(function (results) {
        var nodes = results[0],
            pods = results[1],
            epIPs = results[2];

        for (idx = 0; idx < nodes.items.length; idx++) {
            var internalIP,
                nodePodsCount = 0,
                nodePods = [],
                roles = [];

            Object.keys(nodes.items[idx].metadata.labels).forEach(function (label) {
                var splitLabel = label.match(/^node-role.kubernetes.io\/([\w\.-]+)/);

                if (splitLabel) {
                    roles.push(splitLabel[1]);
                }
            });

            var internalIPs = nodes.items[idx].status.addresses.filter(function (addr) {
                return addr.type === "InternalIP";
            });

            internalIP = internalIPs.length && internalIPs[0].address;

            pods.forEach(function (pod) {
                var containers = {
                    limits: { cpu: 0, memory: 0 },
                    requests: { cpu: 0, memory: 0 },
                    restartCount: 0
                };

                if (pod.status.hostIP === internalIP) {
                    pod.spec.containers.forEach(function (container) {
                        var limits = container.resources.limits,
                            requests = container.resources.requests;

                        nodePodsCount++;

                        if (typeof limits !== "undefined") {
                            containers.limits.cpu += Fmt.cpuFormat(limits.cpu);
                            containers.limits.memory += Fmt.memoryFormat(limits.memory);
                        }

                        if (typeof requests !== "undefined") {
                            containers.requests.cpu += Fmt.cpuFormat(requests.cpu);
                            containers.requests.memory += Fmt.memoryFormat(requests.memory);
                        }
                    });

                    pod.status.containerStatuses.forEach(function (container) {
                        containers.restartCount += container.restartCount;
                    });

                    nodePods.push({
                        name: pod.metadata.name,
                        namespace: pod.metadata.namespace,
                        labels: pod.metadata.labels,
                        annotations: pod.metadata.annotations,
                        phase: pod.status.phase,
                        conditions: pod.status.conditions,
                        startTime: pod.status.startTime,
                        containers: containers,
                        podIP: pod.status.podIP
                    });
                }
            });
            delete nodes.items[idx].metadata.managedFields;
            delete nodes.items[idx].status.images;

            nodes.items[idx].status.capacity.cpu = Fmt.cpuFormat(nodes.items[idx].status.capacity.cpu);
            nodes.items[idx].status.capacity.memory = Fmt.memoryFormat(nodes.items[idx].status.capacity.memory);
            nodes.items[idx].status.allocatable.cpu = Fmt.cpuFormat(nodes.items[idx].status.allocatable.cpu);
            nodes.items[idx].status.allocatable.memory = Fmt.memoryFormat(nodes.items[idx].status.allocatable.memory);

            nodes.items[idx].status.podsCount = nodePodsCount;
            nodes.items[idx].status.roles = roles.join(", ");
            nodes.items[idx].pods = nodePods;
        }

        nodes.endpointIPs = epIPs;

        return nodes;
    });

}

/**
 * 
 * @param {function} filterFn array filter function
 * @param {object} _default default value to return if the filter function doesn't return any thing
 * @returns object after the filter applied the the array
 */
Array.prototype._find = function (filterFn, _default) {
    var filtered = this.filter(filterFn);
    return filtered.length ? filtered[0] : _default;
};

/**
 * 
 * @param {object} data for pods informations
 */
function fillTable(data) {
    data.items.forEach(function (item) {
        var metadataName = item.metadata.name;

        var internalIp = item.status.addresses._find(function (a) { return a.type == "InternalIP"; }, {}).address;
        var externalIp = item.status.addresses._find(function (a) { return a.type == "ExternalIP"; }, {}).address;
        var allocableCpu = item.status.allocatable.cpu;
        var memoryPressure = item.status.conditions._find(function (a) { return a.type == "MemoryPressure"; }, {}).status;
        var networkUnavailable = item.status.conditions._find(function (a) { return a.type == "NetworkUnavailable"; }, {}).status;
        var pidPressure = item.status.conditions._find(function (a) { return a.type == "PIDPressure"; }, {}).status;
        var nodeReady = item.status.conditions._find(function (a) { return a.type == "Ready"; }, {}).status;
        var diskPressure = item.status.conditions._find(function (a) { return a.type == "DiskPressure"; }, {}).status;
        var allocatableMem = item.status.allocatable.memory;
        var allocatablePods = item.status.allocatable.pods;
        var capacityCpu = item.status.capacity.cpu;
        var capacityMem = item.status.capacity.memory;
        var capacityPods = item.status.capacity.pods;
        var arch = item.status.nodeInfo.architecture;
        var cntVer = item.status.nodeInfo.containerRuntimeVersion;
        var kernelVer = item.status.nodeInfo.kernelVersion;
        var kubeletVer = item.status.nodeInfo.kubeletVersion;
        var kubeProxyVer = item.status.nodeInfo.kubeProxyVersion;
        var opSystem = item.status.nodeInfo.operatingSystem;
        var roles = item.status.roles;
        var limitsCpu = item.pods.reduce(function (a, b) { return a + b.containers.limits.cpu; }, 0);
        var limitsMem = item.pods.reduce(function (a, b) { return a + b.containers.limits.memory; }, 0);
        var reqCpu = item.pods.reduce(function (a, b) { return a + b.containers.requests.cpu; }, 0);
        var reqMem = item.pods.reduce(function (a, b) { return a + b.containers.requests.memory; }, 0);
        var uptime = item.metadata.creationTimestamp;
        var podsCount = item.status.podsCount;
        item.pods.forEach(function (pod) {
            var containerReady = pod.conditions._find(function (c) { return c.type == "ContainersReady"; }, {}).status;
            var initialized = pod.conditions._find(function (c) { return c.type == "Initialized"; }, {}).status;
            var ready = pod.conditions._find(function (c) { return c.type == "Ready"; }, {}).status;
            var scheduled = pod.conditions._find(function (c) { return c.type == "PodScheduled"; }, {}).status;
            var podIP = pod.podIP;
            podTable.insertRecord(pod.name, [
                metadataName,
                internalIp,
                externalIp,
                allocableCpu,
                memoryPressure,
                networkUnavailable,
                pidPressure,
                nodeReady,
                diskPressure,
                allocatableMem,
                allocatablePods,
                capacityCpu,
                capacityMem,
                capacityPods,
                arch,
                cntVer,
                kernelVer,
                kubeletVer,
                kubeProxyVer,
                opSystem,
                roles,
                limitsCpu,
                limitsMem,
                reqCpu,
                reqMem,
                uptime,
                podsCount,
                containerReady,
                initialized,
                ready,
                scheduled,
                pod.containers.restartCount,
                pod.phase,
                pod.startTime,
                podIP
            ]);
        });
    });
}





/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the nodes, pods, endpointIPs is accessible over http request
*/
function validate() {
    D.q.all([
        Kube.getNodes(),
        Kube.getPods(),
        Kube.getEndpointIPs()
    ]).then(function () {
        D.success();
    });
}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving kubernetes pods information 
*/
function get_status() {
    parse().then(function (result) {
        fillTable(result);
        D.success(podTable);
    }).catch(function (e) {
        console.error(e);
        D.failure(D.errorType.GENERIC_ERROR);
    });
}

