var Kube = {
    params: {},
    metrics_endpoint: undefined,

    setParams: function (params) {
        ["api_endpoint", "token", "state_endpoint_name"].forEach(function (field) {
            if (typeof params !== "object" || typeof params[field] === "undefined"
                || params[field] === "") {
                throw "Required param is not set: \"" + field + "\".";
            }
        });

        Kube.params = params;
        // if (typeof Kube.params.api_endpoint === "string" && !Kube.params.api_endpoint.endsWith("/")) {
        //     Kube.params.api_endpoint += "/";
        // }
    },

    apiRequest: function (query) {
        var response,
            request = new HttpRequest(),
            url = Kube.params.api_endpoint + query;

        request.addHeader("Content-Type: application/json");
        request.addHeader("Authorization: Bearer " + Kube.params.token);

        Zabbix.log(4, "[ Kubernetes ] Sending request: " + url);

        response = request.get(url);

        Zabbix.log(4, "[ Kubernetes ] Received response with status code " + request.getStatus() + ": " + response);

        if (request.getStatus() < 200 || request.getStatus() >= 300) {
            throw "Request failed with status code " + request.getStatus() + ": " + response;
        }

        if (response !== null) {
            try {
                response = JSON.parse(response);
            }
            catch (error) {
                throw "Failed to parse response received from Kubernetes API. Check debug log for more information.";
            }
        }

        return {
            status: request.getStatus(),
            response: response
        };
    },

    getMetricsEndpoint: function () {
        var result = Kube.apiRequest("v1/endpoints"),
            endpoint = undefined;

        if (typeof result.response !== "object"
            || typeof result.response.items === "undefined"
            || result.status != 200) {
            throw "Cannot get endpoints from Kubernetes API. Check debug log for more information.";
        }

        result.response.items.forEach(function (ep) {
            if (ep.metadata.name === Kube.params.state_endpoint_name && Array.isArray(ep.subsets)) {
                if (typeof ep.subsets[0].addresses !== "undefined") {
                    var subset = ep.subsets[0];

                    endpoint = {
                        address: subset.addresses[0].ip,
                        port: port = subset.ports.filter(function (port) {
                            return port.name === "http";
                        })[0].port || 8080
                    };
                }
            }
        });

        Kube.metrics_endpoint = endpoint;
        return endpoint;
    },

    getStateMetrics: function () {
        if (typeof Kube.metrics_endpoint === "undefined") {
            throw "Cannot get kube-state-metrics endpoints from Kubernetes API. Check debug log for more information.";
        }

        var response,
            request = new HttpRequest(),
            url = "http://" + Kube.metrics_endpoint.address + ":" + Kube.metrics_endpoint.port + "/metrics";

        request.addHeader("Content-Type: application/json");
        request.addHeader("Authorization: Bearer " + Kube.params.token);

        Zabbix.log(4, "[ Kubernetes ] Sending request: " + url);

        response = request.get(url);

        Zabbix.log(4, "[ Kubernetes ] Received response with status code " + request.getStatus() + ": " + response);

        if (request.getStatus() < 200 || request.getStatus() >= 300) {
            throw "Request failed with status code " + request.getStatus() + ": " + response;
        }

        if (response === null) {
            throw "failed to get Kubernetes state metrics. Check debug log for more information.";
        }

        return response;

    }
};

// try {
Kube.setParams();

var metricsEndpoint = Kube.getMetricsEndpoint(),
    stateMetrics = Kube.getStateMetrics();

console.log(stateMetrics);
// }
// catch (error) {
//     error += (String(error).endsWith('.')) ? '' : '.';
//     Zabbix.log(3, '[ Kubernetes ] ERROR: ' + error);
//     console.log({ error: error });
// }

