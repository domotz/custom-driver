/**
 * This driver extracts information for pfinfo using pfsense web application
 * The communication protocol is HTTPS
 * This driver create a dynamic list of variables showing all the information displayed in pfinfo page under pfsense web application
 * Tested under pfsense 2.6.0-RELEASE
 * *************************************************
 * list of variables are:
 * %em1 Bytes In ipv4
 * %em1 Bytes Out ipv4
 * %em1 packets in passed ipv4
 * %em1 packets in blocked ipv4
 * %em1 packets out passed ipv4
 * %em1 packets out blocked ipv4
 * %em1 Bytes In ipv6
 * %em1 Bytes Out ipv6
 * %em1 packets in passed ipv6
 * %em1 packets in blocked ipv6
 * %em1 packets out passed ipv6
 * %em1 packets out blocked ipv6
 * {@link totalRateParams}
 * %State Table:
 *     %current entries
 *     %searches
 *     %inserts
 *     %removals
 * %Source Tracking Table
 *     %current entries
 *     %searches
 *     %inserts
 *     %removals
 * %Counters
 *     %match
 *     %bad-offset
 *     %fragment
 *     %short
 *     %normalize
 *     %memory
 *     %bad-timestamp
 *     %congestion
 *     %ip-option
 *     %proto-cksum
 *     %state-mismatch
 *     %state-insert
 *     %state-limit
 *     %src-limit
 *     %synproxy
 *     %map-failed
 * %Limit Counters
 *     %max states per rule
 *     %max-src-states
 *     %max-src-nodes
 *     %max-src-conn
 *     %max-src-conn-rate
 *     %overload table insertion
 *     %overload flush states
 *     %synfloods detected
 *     %syncookies sent
 *     %syncookies validated * %states        hard limit
 * {@link otherParams}
 * %src-nodes     hard limit
 * %frags         hard limit
 * %table-entries hard limit
 * %tcp.first
 * %tcp.opening
 * %tcp.established
 * %tcp.closing
 * %tcp.finwait
 * %tcp.closed
 * %tcp.tsdiff
 * %udp.first
 * %udp.single
 * %udp.multiple
 * %icmp.first
 * %icmp.error
 * %other.first
 * %other.single
 * %other.multiple
 * %frag
 * %interval
 * %adaptive.start
 * %adaptive.end
 * %src.track"
 * *******************************************
 * The table is defined in {@link table}
 */

var _var = D.device.createVariable;
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
var otherParams = [
    "states        hard limit",
    "src-nodes     hard limit",
    "frags         hard limit",
    "table-entries hard limit",
    "tcp.first",
    "tcp.opening",
    "tcp.established",
    "tcp.closing",
    "tcp.finwait",
    "tcp.closed",
    "tcp.tsdiff",
    "udp.first",
    "udp.single",
    "udp.multiple",
    "icmp.first",
    "icmp.error",
    "other.first",
    "other.single",
    "other.multiple",
    "frag",
    "interval",
    "adaptive.start",
    "adaptive.end",
    "src.track"
];

function interfacesRegex(interfaceName) {
    return new RegExp(
        interfaceName +
        "\\s+Cleared:\\s+([^\n]*)\n" +
        "\\s+References:\\s+(\\d+)\\s*\n" +
        "\\s+In4\\/Pass:\\s+\\[ Packets: (\\d+)\\s+Bytes: (\\d+)\\s+\\]" +
        "\\s+In4\\/Block:\\s+\\[ Packets: (\\d+)\\s+Bytes: (\\d+)\\s+\\]" +
        "\\s+Out4\\/Pass:\\s+\\[ Packets: (\\d+)\\s+Bytes: (\\d+)\\s+\\]" +
        "\\s+Out4\\/Block:\\s+\\[ Packets: (\\d+)\\s+Bytes: (\\d+)\\s+\\]" +
        "\\s+In6\\/Pass:\\s+\\[ Packets: (\\d+)\\s+Bytes: (\\d+)\\s+\\]" +
        "\\s+In6\\/Block:\\s+\\[ Packets: (\\d+)\\s+Bytes: (\\d+)\\s+\\]" +
        "\\s+Out6\\/Pass:\\s+\\[ Packets: (\\d+)\\s+Bytes: (\\d+)\\s+\\]" +
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

var http_config = {
    url: "/",
    protocol: "https",
    rejectUnauthorized: false,
    jar: true
};

/**
 * get the html login page
 * @param {*} config http config
 * @returns promise for html login page
 */
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

/**
 * extract a code used for login
 * @param {*} body html login page 
 * @returns csrf_magic code
 */
function get_csrf_magic(body) {
    var $ = D.htmlParse(body);
    var csrf_magic_element = $("input[name=__csrf_magic]");
    var csrf_magic = csrf_magic_element[0].attribs.value;
    return csrf_magic;
}

/**
 * 
 * @param {*} csrf_magic csrf code used to make login
 * @returns promise processing login and add cookie to http config
 */
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

/**
 * 
 * @returns promise contains csrf_magic code to query pfinfo page
 */
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

/**
 * 
 * @param {*} csrf_magic code to query pfinfo page
 * @returns promise for html pfinfo page
 */
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
        if(!body || body.indexOf("Hostid") < 0){
            D.failure(D.errorType.AUTHENTICATION_ERROR);
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

/**
 * 
 * @param {*} body pfinfo page
 * @param {*} paramName parameter name to extract from pfinfo page
 * @returns the value of the parameter and it's unit
 */
function extractParameterValue(body, paramName) {
    var regex = new RegExp(paramName + "\\s+([^\n]*)\n");
    var match = body.match(regex);
    var value = "";
    if (match) value = match[1];
    if (value) {
        var valueUnit = value.split(" ");
        if (valueUnit.length == 2) {
            return { value: valueUnit[0], unit: valueUnit[1] };
        }
        if (value.indexOf("s") >= 0) return { value: value.substring(0, value.length - 1), unit: "s" };
        return { value: value };
    }
}



/**
 * This function extracts variables from the pfinfo page
 * @param {string} body 
 */
function extract_variables(body) {
    // extract em1 interface stats
    var match = body.match(em1StatsRegex);
    if (match) {
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
    totalRateParams.forEach(function (p) {
        var regex = totalRateStatsRegex(p.title, p.params);
        match = body.match(regex);
        if (match) {
            for (var i = 1; i < match.length; i += 2) {
                var j = (i - 1) / 2;
                var variableIdPartial = p.title.replace("table", "tbl");
                _vars.push(_var(variableIdPartial + "_" + p.params[j] + "_total", p.title + ": " + p.params[j] + " (total)", match[i]));
                _vars.push(_var(p.title + "_" + p.params[j] + "_rate", p.title + ": " + p.params[j] + " (rate)", match[i + 1].substring(0, match[i + 1].length - 2), "s"));
            }
        }
    });

    match = body.match(syncookiesRegex);
    if (match) _vars.push(_var("syncookies", "syncookies", match[1]));

    otherParams.forEach(function (p) {
        var val = extractParameterValue(body, p);
        _vars.push(_var(p.trim().replace("table", "tbl"), p.trim(), val.value, val.unit));
    });
}

/**
 * 
 * @param {string} body 
 */
function extract_table(body) {
    // get interfaces
    var index = body.indexOf("\nall");
    var toParse = body.substring(index);
    var reg = /\n(\S+.*)\n/gm;
    var interfaces = [];
    var result;
    while ((result = reg.exec(toParse)) !== null) {
        interfaces.push(result[1]);
    }
    interfaces.forEach(function (interface) {
        var inRegEx = interfacesRegex(interface);
        var match = toParse.match(inRegEx);
        if (match) {
            var values = [];
            for (var i = 1; i < match.length; i++) {
                values.push(match[i]);
            }
            table.insertRecord(interface, values);
        }
    });
}

function success(result) {
    result = result.replace(/<p\/>/gm, "");
    extract_variables(result);
    extract_table(result);
    D.success(_vars, table);
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
* @documentation This procedure is used to validate if the driver can login to pfsense webpage and get the pfinfo page
*/
function validate() {
    execute().then(function () {
        D.success();
    });
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving pfinfo page and extract many monitoring parameters specified in the top documentation
*/
function get_status() {
    execute()
        .then(success)
        .catch(failure);

}