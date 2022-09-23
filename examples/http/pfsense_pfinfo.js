var _var = D.device.createVariable;


var http_config = {
    url: "/",
    protocol: "https",
    rejectUnauthorized: false,
    jar: true
    // followRedirect: true
};


function get_login_form(config) {
    config.url = "/";
    var d = D.q.defer();
    D.device.http.get(config, function (err, response, body) {
        if (err) {
            console.error(err);
            return D.failure();
        }
        d.resolve(body);
    });
    return d.promise;
}

function get_csrf_magic(body) {
    var $ = D.htmlParse(body);
    var csrf_magic_element = $("input[name=__csrf_magic]");
    var csrf_magic = csrf_magic_element[0].attribs.value;
    return csrf_magic;
}

function login(csrf_magic) {
    var d = D.q.defer();
    var config = clone({
        form: {
            "__csrf_magic": csrf_magic,
            "usernamefld": D.device.username(),
            "passwordfld": D.device.password(),
            "login": "Sign+In"
        }

    }, http_config);
    config.url = "/";

    D.device.http.post(config, function (err, response, body) {
        if (err) {
            console.error(err);
            return D.failure();
        }
        delete http_config.body;
        d.resolve();
    });
    return d.promise;
}

function get_pfinfo_csrf_magic() {
    var d = D.q.defer();
    var config = clone({
        url: "/diag_pf_info.php",
    }, http_config);
    D.device.http.get(config, function (err, response, body) {
        if (err) {
            console.error(err);
            return D.failure();
        }
        d.resolve(get_csrf_magic(body));
    });
    return d.promise;
}

function get_pfinfo_body(csrf_magic) {
    var d = D.q.defer();
    var config = clone({
        url: "/diag_pf_info.php",
        form: {
            "__csrf_magic": csrf_magic, "refresh": "yes", "getactivity": "yes"
        }
    }, http_config);
    D.device.http.post(config, function (err, response, body) {
        if (err) {
            console.error(err);
            return D.failure();
        }
        d.resolve(body);
    });
    return d.promise;

}


/**
 * 
 * @param {*} init object initialisation
 * @param {*} object object to clone
 * @returns cloned object
 */
function clone(init, object) {
    var toReturn = JSON.parse(JSON.stringify(object));
    Object.keys(init).forEach(function (key) {
        toReturn[key] = init[key];
    });
    return toReturn;
}

function trim(s) {
    return s.trim().replace(/\s+/g, " ");
}

var em1StatsRegex = new RegExp(
    "Interface Stats for em1\\s+IPv4\\s+IPv6\n" +
    "\\s+Bytes In\\s+(\\d+)\\s+(\\d+)\n" +
    "\\s+Bytes Out\\s+(\\d+)\\s+(\\d+)\n" +
    "\\s+Packets In\n" +
    "\\s+Passed\\s+(\\d+)\\s+(\\d+)\n" +
    "\\s+Blocked\\s+(\\d+)\\s+(\\d+)\n" +
    "\\s+Packets Out\n" +
    "\\s+Passed\\s+(\\d+)\\s+(\\d+)\n" +
    "\\s+Blocked\\s+(\\d+)\\s+(\\d+)\n\n"
    , "m");

function interfacesRegex(interfaceName){
    return new RegExp(
        interfaceName+
        "\\s+Cleared:\\s+([^\n]*)\n"+
        "\\s+References:\\s+(\\d+)\\s*\n"+
        "\\s+In4\\/Pass:\\s+\\[ Packets: (\\d+)\\s+Bytes: (\\d+)\\s+\\]"+
        "\\s+In4\\/Block:\\s+\\[ Packets: (\\d+)\\s+Bytes: (\\d+)\\s+\\]"+
        "\\s+Out4\\/Pass:\\s+\\[ Packets: (\\d+)\\s+Bytes: (\\d+)\\s+\\]"+
        "\\s+Out4\\/Block:\\s+\\[ Packets: (\\d+)\\s+Bytes: (\\d+)\\s+\\]"+
        "\\s+In6\\/Pass:\\s+\\[ Packets: (\\d+)\\s+Bytes: (\\d+)\\s+\\]"+
        "\\s+In6\\/Block:\\s+\\[ Packets: (\\d+)\\s+Bytes: (\\d+)\\s+\\]"+
        "\\s+Out6\\/Pass:\\s+\\[ Packets: (\\d+)\\s+Bytes: (\\d+)\\s+\\]"+
        "\\s+Out6\\/Block:\\s+\\[ Packets: (\\d+)\\s+Bytes: (\\d+)\\s+\\]"
        , "m");
}

var syncookiesRegex = new RegExp(
    "Syncookies\n" +
    "\\s+mode\\s+(\\S+)\n"
    , "m");

/**
 * 
 * @param {string} title 
 * @param {[string]} params 
 * @returns 
 */
function totalRateStatsRegex(title, params) {
    var regexBuilder = "\n" + title + ".*\n";
    params.forEach(function (p) {
        regexBuilder += "\\s+" + p + "\\s+(\\d+)\\s+(\\S*)\n";
    });
    return new RegExp(regexBuilder, "im");
}

var totalRateParams = [
    { title: "State Table", params: ["current entries", "searches", "inserts", "removals"] },
    { title: "Source Tracking Table", params: ["current entries", "searches", "inserts", "removals"] },
    {
        title: "Counters", params: [
            "match",
            "bad-offset",
            "fragment",
            "short",
            "normalize",
            "memory",
            "bad-timestamp",
            "congestion",
            "ip-option",
            "proto-cksum",
            "state-mismatch",
            "state-insert",
            "state-limit",
            "src-limit",
            "synproxy",
            "map-failed",
        ]
    },
    {
        title: "Limit Counters",
        params: [
            "max states per rule",
            "max-src-states",
            "max-src-nodes",
            "max-src-conn",
            "max-src-conn-rate",
            "overload table insertion",
            "overload flush states",
            "synfloods detected",
            "syncookies sent",
            "syncookies validated"
        ]
    }
];

function extractParameterValue(body, paramName, valueParserFn){
    var regex = new RegExp(paramName+"\\s+([^\n]*)\n");
    var match= body.match(regex);
    var value;
    if(match) value = match[1];
    if(value) return (valueParserFn ? valueParserFn(value) : {value: value, unit: ""});
}

/**
 * 
 * @param {string} value 
 * @returns value and unit "s"
 */
function secondUnitParser(value){
    return {value: value.substring(0, value.length - 1), unit: "s"};
}

/**
 * 
 * @param {string} value 
 * @returns value and unit "states"
 */
function statesUnitParser(value){
    var valueUnit = value.split(" ");
    return {value: valueUnit[0], unit: valueUnit[1]};
}

function create_var(groups, title, c) {
    var uid = title.toLowerCase().replace(" - ", "_").replace(/\s+/g, "_") + "_" + trim(groups[1]).replace(/\s+/g, "_");
    var label = title + " - " + trim(groups[1]);
    var value1 = groups[2].match(/^(\d*\.?\d*).*$/)[1];
    if (!value1) {
        value1 = groups[2];
    }
    var value2;
    if (groups[3]) {
        value2 = groups[3].match(/^(\d*\.?\d*).*$/)[1];
    }
    var res = [_var(uid + "_" + c.col1.replace(/\s+/g, "_"), label + (c.col1 ? " - " + c.col1 : ""), value1, c.col1_unit)];
    if (value2) {
        res.push(_var(uid + c.col2.replace(/\s+/g, "_"), label + (c.col2 ? " - " + c.col2 : ""), value2, c.col2_unit));
    }
    return res;
}

var _vars = [];
var table = D.createTable("Pfsense interface statistics", [
    { label: "Cleared" },
    { label: "References" },
    { label: "In4/Pass (Packets)", unit: "packet" },
    { label: "In4/Pass (Bytes)", unit: "byte" },
    { label: "In4/Block (Packets)", unit: "packet" },
    { label: "In4/Block (Bytes)", unit: "byte" },
    { label: "Out4/Pass (Packets)", unit: "packet" },
    { label: "Out4/Pass (Bytes)", unit: "byte" },
    { label: "Out4/Block (Packets)", unit: "packet" },
    { label: "Out4/Block (Bytes)", unit: "byte" },
    { label: "In6/Pass (Packets)", unit: "packet" },
    { label: "In6/Pass (Bytes)", unit: "byte" },
    { label: "In6/Block (Packets)", unit: "packet" },
    { label: "In6/Block (Bytes)", unit: "byte" },
    { label: "Out6/Pass (Packets)", unit: "packet" },
    { label: "Out6/Pass (Bytes)", unit: "byte" },
    { label: "Out6/Block (Packets)", unit: "packet" },
    { label: "Out6/Block (Bytes)", unit: "byte" },
]);

/**
 * This function extracts variables from the http body
 * @param {string} body 
 */
function extract_variables(body) {
    // extract em1 interface stats
    var match = body.match(em1StatsRegex);
    if(match){
        _vars.push(_var("em1_bytes_in_ipv4", "em1 Bytes In ipv4", match[1]));
        _vars.push(_var("em1_bytes_out_ipv4", "em1 Bytes Out ipv4", match[3]));
        _vars.push(_var("em1_packets_in_passed_ipv4", "em1 packets in passed ipv4", match[5]));
        _vars.push(_var("em1_packets_in_blocked_ipv4", "em1 packets in blocked ipv4", match[7]));
        _vars.push(_var("em1_packets_out_passed_ipv4", "em1 packets out passed ipv4", match[9]));
        _vars.push(_var("em1_packets_out_blocked_ipv4", "em1 packets out blocked ipv4", match[11]));
        _vars.push(_var("em1_bytes_in_ipv6", "em1 Bytes In ipv6", match[2]));
        _vars.push(_var("em1_bytes_out_ipv6", "em1 Bytes Out ipv6", match[4]));
        _vars.push(_var("em1_packets_in_passed_ipv6", "em1 packets in passed ipv6", match[6]));
        _vars.push(_var("em1_packets_in_blocked_ipv6", "em1 packets in blocked ipv6", match[8]));
        _vars.push(_var("em1_packets_out_passed_ipv6", "em1 packets out passed ipv6", match[10]));
        _vars.push(_var("em1_packets_out_blocked_ipv6", "em1 packets out blocked ipv6", match[12]));
    }

    // extract totalRateParams variables
    totalRateParams.forEach(function(p){
        var regex = totalRateStatsRegex(p.title, p.params);
        var a = () => {};
        var ff = "";
    });
}

function extract_table(lines) {
    var last_uid;
    var value;
    for (var i = 90; i < lines.length; i++) {
        var title = lines[i].match(/^(\S+)/);
        if (lines[i] && lines[i][0] !== " ") {
            if (value && value.length) {

                table.insertRecord(
                    last_uid, value
                );
            }
            last_uid = title[1];
            value = [];
        } else {
            var match = lines[i].trim().match(/^.*\[ Packets: (\d+).*Bytes: (\d+).*\]$/);
            if (!match) {
                match = lines[i].trim().match(/^.*:\s+(.*)/);
                if (match) {
                    value.push(match[1]);
                } else {
                    value.push(null);
                }
            } else {
                value.push(match[1]);
                value.push(match[2]);
            }
        }
    }
}

function success(result) {
    result = result.replace(/<p\/>/gm, "");
    // var lines = result.split("\n");
    extract_variables(result);
    // extract_table(result);
    D.success(_vars);//, table);
}

function failure(error) {
    console.error(error);
    D.failure(D.errorType.GENERIC_ERROR);
}

var exec = [
    get_login_form,
    get_csrf_magic,
    login,
    get_pfinfo_csrf_magic,
    get_pfinfo_body
];
function execute() {

    return exec.reduce(D.q.when, D.q(clone({}, http_config)));
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    execute().then(function () {
        D.success();
    });
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    execute()
        .then(success)
        .catch(failure);

}