
/**
 * * id: your parameter id (should be unique)
 * * link: path to resource over http
 * * protocol (default http)
 * * port (default 80 for http and 443 for https)
 * * method: 'get' | 'post' | 'put' | 'delete' (default 'get')
 * * contentType (default 'application/json')
 * * responseType: 'json' | 'html' | 'text' (default 'html')
 * * valueExtractor:
 *    - if response type is html: 
 *       - Regular Expression: regular expression containing the token to extract (example: /<input name="input_name" value="(.*)" \/>/), only the first token will be extracted
 *       - Query selector: an object that contain this fields:
 *            - query: string contains html query selector (example: "body > div > #id1 > .class1")
 *            - nodeIndex: only one node should be selected from query result, specify the index in the Child Node list (default 0)
 *            - valueLocation: (default 'text')
 *                - text: will extract html node text
 *                - value: will extract html node value
 *    - if response type is json: 
 *       - string contains the path to the field starting by value which contain the json response (example: "value.field1.field2")
 *    - if response type is json: 
 *       - Regular Expression: regular expression containing the token to extract (example: /<input name="input_name" value="(.*)" \/>/)
 * * valueValidation: validate the value extracted, it can have 2 possible types (default "value")
 *    - string: expression return expected result depending from the value extracted (example: "value == 'valid' ? true : false")
 *    - function: user defined function where the value is passed as an argument and return the expected result (example: function(value) { return value > 10 ? 'working' : 'not working';})
 */

var httpMonitoringConfig = [
    {
        id: "domotz_feature_page_title",
        link: "/features.php",
        valueExtractor: /<h1>(.*)<\/h1>/,
        protocol: "https"
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
    if (!config.method || typeof (config.method) != "string") config.method = "get";
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
    if (!config.responseType || typeof (config.responseType) != "string") config.responseType = "html";
    if (!config.valueExtractor) failValidation("this field 'valueExtractor' in the parameter with index " + index + " is required");
    if (config.responseType == "html") {
        if (!(config.valueExtractor instanceof RegExp)) {
            if (typeof (config.valueExtractor) == "object") {
                if (!config.valueExtractor.query || typeof (config.valueExtractor.query) != "string")
                    failValidation("this field 'valueExtractor.query' in the parameter with index " + index + " is required and should be string value");
                if (!config.valueExtractor.nodeIndex) config.valueExtractor.nodeIndex = 0;
                if (!config.valueExtractor.valueLocation) config.valueExtractor.valueLocation = "text";
                if (["text", "value"].indexOf(config.valueExtractor.valueLocation) < 0)
                    failValidation("this field 'valueExtractor.query' in the parameter with index " + index + " should contain 'text' or 'value'");

            } else {
                failValidation("this field 'valueExtractor' in the parameter with index " + index + " is invalid, please check the parameter documentation");
            }
        }
    } else if (config.responseType == "text" && !(config.valueExtractor instanceof RegExp))
        failValidation("this field 'valueExtractor' in the parameter with index " + index + " is invalid, please check the parameter documentation");
    else if (config.responseType == "json" && !(typeof (config.valueExtractor) == "string"))
        if (!config.id) failValidation("this field 'id' in the parameter with index " + index + " is required");
    if (!config.valueValidation) config.valueValidation = "!!value";
    else if (typeof (config.valueValidation) != "string" || typeof (config.valueValidation) != "function") {
        failValidation("this field 'id' in the parameter with index " + index + " should be string or function");
    }
    return config;
}

function findResource(config) {
    var httpConfig = {
        url: config.link,
        protocol: config.protocol,
        port: config.port,
        rejectUnauthorized: false,
        body: config.requestBody,
        form: config.form,
        headers: {
            "content-type": config.contentType
        }
    };
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
        config.responseBody = body;
        d.resolve(config);

    });
    return d.promise;
}

function parse(config) {
    var result, match;
    if (config.responseType == "html") {
        if (config.valueExtractor instanceof RegExp) {
            match = config.responseBody.match(config.valueExtractor);
            if (match && match.length) {
                result = match[1];
            }
        } else {
            var $ = D.htmlParse(config.responseBody);
            var nodes = $(config.valueExtractor.query);
            var targetNode = nodes[config.valueExtractor.nodeIndex];
            if (config.valueExtractor.valueLocation == "text") {
                result = $(targetNode).text();
            } else {
                result = $(targetNode).val();
            }
        }
    } else if (config.responseType == "text") {
        match = config.responseBody.match(config.valueExtractor);
        if (match && match.length) {
            result = match[1];
        }
    } else if (config.responseType == "json") {
        var value = config.responseBody;
        result = eval(config.valueExtractor);
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
function createVariable(config){
    return D.device.create;
}

function findResourceForAll(){
    return D.q.all(httpMonitoringConfig.map(findResource));
}
function parseForAll(configs){
    return configs.map(parse);
}
function valueValidationForAll(configs){
    return configs.map(valueValidation);
}
function fillTable(configs){
    configs.forEach(function(config){
        table.insertRow(
            config.id,
            [
                config.link,
                config.port || (!config.protocol || config.protocol == "http" ? "80" : "443"),
                config.result,
                config.validation
            ]
        );
    });
    return table;
}

function failure(err){
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {

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