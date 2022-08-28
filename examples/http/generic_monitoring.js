
/**
 * This driver extract information from http response
 * Communication protocol is https
 * return a table with this columns:
 * %id: monitoring variable id
 * %Link: http request link for the device, 
 * %Port: http request port for the device, 
 * %HTTP Method: http request method for the device, 
 * %Extracted Value: the value that should be extracted from http response, 
 * %Validation: check if the extracted value is valid or not
 * 
 * Each row of the table is defined in {@link httpMonitoringConfig}
 */

var responseType = Object.freeze({
    html: "html",
    text: "text",
    json: "json"
});

var httpMethod = Object.freeze({
    get: "get",
    post: "post",
    put: "put",
    delete: "delete"
});

var nodeValueLocation = Object.freeze({
    text: "text",
    value: "value",
    attribute: function (attr) {
        return "attr:" + attr;
    }
});

/**
 * {@link httpMonitoringConfig} is an arrays contains the configuration of the different parameter to monitor, each parameter should be configured like this:
 * * id: your parameter id (should be unique)
 * * link: path to resource over http
 * * protocol (default http)
 * * port (default 80 for http and 443 for https)
 * * method: 'get' | 'post' | 'put' | 'delete' (default 'get')
 * * contentType (default 'application/json')
 * * responseType: 'json' | 'html' | 'text' (if not specified it will be extracted from content-type header of the response)
 * * valueExtractor:
 *    - if response type is html: 
 *       - Regular Expression: regular expression containing the token to extract (example: /<input name="input_name" value="(.*)" \/>/), only the first token will be extracted
 *       - Query selector: an object that contain this fields:
 *            - query: string contains html query selector (example: "body > div > #id1 > .class1")
 *            - nodeIndex: only one node should be selected from query result, specify the index in the Child Node list (default 0)
 *            - valueLocation: (default 'text')
 *                - text: will extract html node text
 *                - value: will extract html node value
 *                - attr:node_attribute_name: node_attribute_name is the name of the attribute to extract from the node
 *    - if response type is json: 
 *       - string: contains the path to the field starting by value which contain the json response (example: "value.field1.field2")
 *       - function: user defined function where the value is passed as an argument and return the value desired
 *    - if response type is json: 
 *       - Regular Expression: regular expression containing the token to extract (example: /<input name="input_name" value="(.*)" \/>/)
 * * valueValidation: validate the value extracted, it can have 2 possible types (default "value")
 *    - string: expression return expected result depending from the value extracted (example: "value == 'valid' ? true : false")
 *    - function: user defined function where the value is passed as an argument and return the expected result (example: function(value) { return value > 10 ? 'working' : 'not working';})
 */
var httpMonitoringConfig = [
    // example using Regular expression to find the value in html response
    // {
    //     id: "domotz_feature_page_title",
    //     link: "/features.php",
    //     valueExtractor: /<h1.*>(.*)<\/h1>/,
    //     protocol: "https"
    // },
    // example using query selector to find the value in html response
    // {
    //     id: "domotz_feature_page_title3",
    //     link: "/features.php",
    //     valueExtractor: {
    //         query: "input",
    //         valueLocation: "value"
    //     },
    //     protocol: "https"
    // }
    // example find the value in json response
    {
        id: "domotz_debian_x64_version",
        link: "/assets/domotz-packages.json",
        protocol: "https",
        // valueExtractor: "value.filter(function(e){return e.model == 'debian' && e.arch =='x64'})[0].version"
        // valueExtractor: function(value){
        //     return value.filter(function(e){return e.model == "debian" && e.arch =="x64";})[0].version;
        // }
        valueExtractor: "value[3].version",
        valueValidation: "value == '1.0-2.9.6-4.3.2-b001-0050'"
    }
];


var httpMonitoringTable = D.createTable(
    "HTTP Monitoring",
    [
        { label: "Link" },
        { label: "Port" },
        { label: "HTTP Method" },
        { label: "Extracted value" },
        { label: "Validation" },
    ]
);

function failValidation(message) {
    console.error(message);
    D.failure(D.errorType.PARSING_ERROR);
}

function httpMonitoringConfigValidation() {
    httpMonitoringConfig.forEach(configValidation);
    return httpMonitoringConfig;
}

function configValidation(config, index) {
    if (!config.id || typeof (config.id) != "string") failValidation("this field 'id' in the parameter with index " + index + " is required and should be string value");
    if (!config.link || typeof (config.link) != "string") failValidation("this field 'link' in the parameter with index " + index + " is required and should be string value");
    if (!config.method || typeof (config.method) != "string") config.method = httpMethod.get;
    if (!config.contentType || typeof (config.contentType) != "string") config.contentType = "application/x-www-form-urlencoded";
    if (config.requestBody && typeof (config.requestBody) == "object") {
        if (config.contentType == "application/json") config.body = JSON.stringify(config.body);
        else {
            config.form = config.requestBody;
            delete config.requestBody;
        }
    } else if (!(typeof (config.requestBody) == "string")) {
        delete config.requestBody;
    }
    if (config.responseType && ["json", "html", "text"].indexOf(config.responseType) < 0)
        failValidation("this field 'responseType' in the parameter with index " + index + " should be 'json' or 'html' or 'text'");
    if (!config.valueExtractor)
        failValidation("this field 'valueExtractor' in the parameter with index " + index + " is required");
    if (config.responseType == responseType.html) {
        if (!(config.valueExtractor instanceof RegExp)) {
            if (typeof (config.valueExtractor) == "object") {
                if (!config.valueExtractor.query || typeof (config.valueExtractor.query) != "string")
                    failValidation("this field 'valueExtractor.query' in the parameter with index " + index + " is required and should be string value");
                if (!config.valueExtractor.nodeIndex) config.valueExtractor.nodeIndex = 0;
                if (!config.valueExtractor.valueLocation) config.valueExtractor.valueLocation = nodeValueLocation.text;
                if (
                    [nodeValueLocation.text, nodeValueLocation.value].indexOf(config.valueExtractor.valueLocation) < 0
                    && !config.valueExtractor.valueLocation.match(/^attr\:.+$/))
                    failValidation("this field 'valueExtractor.valueLocation' in the parameter with index " + index + " should contain 'text' or 'value' or 'attr:{node_attribute}'");

            } else {
                failValidation("this field 'valueExtractor' in the parameter with index " + index + " is invalid, please check the parameter documentation");
            }
        }
    } else if (config.responseType == responseType.text && !(config.valueExtractor instanceof RegExp))
        failValidation("this field 'valueExtractor' in the parameter with index " + index + " is invalid, please check the parameter documentation");
    else if (config.responseType == responseType.json && !(typeof (config.valueExtractor) == "string" || typeof (config.valueExtractor) == "function"))
        failValidation("this field 'valueExtractor' in the parameter with index " + index + " is invalid, please check the parameter documentation");
    if (!config.valueValidation) config.valueValidation = "!!value";
    else if (typeof (config.valueValidation) != "string" && typeof (config.valueValidation) != "function") {
        failValidation("this field 'valueValidation' in the parameter with index " + index + " should be string or function");
    }
    return config;
}

function findResource(config) {
    var httpConfig = {
        url: config.link,
        protocol: config.protocol,
        port: config.port,
        rejectUnauthorized: false,
        headers: {}
    };
    if (config.method == httpMethod.post || config.method == httpMethod.put) {
        httpConfig.body = config.requestBody;
        httpConfig.form = config.form;
        httpConfig.headers["content-type"] = config.contentType;
    }
    var d = D.q.defer();
    D.device.http[config.method](httpConfig, function (err, response, body) {
        if (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }

        if (!config.responseType) {
            var contentType = response.headers["content-type"];
            if(contentType.indexOf("application/json") >= 0){
                config.responseType = responseType.json;
            }else if(contentType.indexOf("text/html") >= 0){
                config.responseType = responseType.html;
            }else{
                config.responseType = responseType.text;
            }
        }
        config.responseBody = body;
        d.resolve(config);

    });
    return d.promise;
}
function parse(config) {
    var result, match;
    if (config.responseType == responseType.html) {
        if (config.valueExtractor instanceof RegExp) {
            match = config.responseBody.match(config.valueExtractor);
            if (match && match.length) {
                result = match[1];
            }
        } else {
            var $ = D.htmlParse(config.responseBody);
            var nodes = $(config.valueExtractor.query);
            var targetNode = nodes[config.valueExtractor.nodeIndex];
            if (config.valueExtractor.valueLocation == nodeValueLocation.text) {
                result = $(targetNode).text();
            } else if (config.valueExtractor.valueLocation == nodeValueLocation.value) {
                result = $(targetNode).val();
            } else {
                var attr = config.valueExtractor.valueLocation.split(":")[1];
                result = $(targetNode).attr(attr);
            }
        }
    } else if (config.responseType == responseType.text) {
        match = config.responseBody.match(config.valueExtractor);
        if (match && match.length) {
            result = match[1];
        }
    } else if (config.responseType == responseType.json) {
        var value = JSON.parse(config.responseBody);
        if (typeof (config.valueExtractor) == "string") {
            result = eval(config.valueExtractor);
        } else {
            result = config.valueExtractor(value);
        }
    }
    config.result = result;
    return config;

}

function valueValidation(config) {
    var value = config.result;
    if (typeof (config.valueValidation) == "string") {
        config.validation = eval(config.valueValidation);
    } else {
        config.validation = config.valueValidation(value);
    }
    return config;
}
function createVariable(config) {
    return D.device.create;
}

function findResourceForAll() {
    return D.q.all(httpMonitoringConfig.map(findResource));
}
function parseForAll(configs) {
    return configs.map(parse);
}
function valueValidationForAll(configs) {
    return configs.map(valueValidation);
}
function fillTable(configs) {
    configs.forEach(function (config) {
        httpMonitoringTable.insertRecord(
            config.id,
            [
                config.link,
                config.port || (!config.protocol || config.protocol == "http" ? "80" : "443"),
                config.method,
                config.result,
                config.validation
            ]
        );
    });
    return httpMonitoringTable;
}

function failure(err) {
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    httpMonitoringConfigValidation();
    D.success();
}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    httpMonitoringConfigValidation();
    findResourceForAll()
        .then(parseForAll)
        .then(valueValidationForAll)
        .then(fillTable)
        .then(D.success)
        .catch(failure);
}