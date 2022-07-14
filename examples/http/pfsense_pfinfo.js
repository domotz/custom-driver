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

function extract_variables(lines) {
    // Interface Stats for em1
    var two_col_regex = /^(.*\S)\s+(\S+)\s+(\S*)$/;
    var one_col_regex = /^(.*\S)\s+(\d+\.?\d*).*$/;
    var config = [
        { title: "Interface Stats for em1", col1: "v4", col2: "v6", regex: two_col_regex, start: 6, end: 13 },
        { title: "State Table", col1: "total", col2: "rate", regex: two_col_regex, start: 16, end: 19, col2_unit: "per second" },
        { title: "", col1: "total", col2: "rate", regex: two_col_regex, start: 20, end: 52, col2_unit: "per second" },
        { title: "Syncookies", col1: "", regex: /^(.*\S)\s+(\S+)$/, start: 54, end: 54 },
        { title: "Syncookies", col1: "", regex: one_col_regex, start: 55, end: 58 },
        { title: "Syncookies", col1: "", regex: one_col_regex, start: 59, end: 75, col1_unit: "s" },
        { title: "Syncookies", col1: "", regex: one_col_regex, start: 76, end: 77, col1_unit: "states" },
        { title: "Syncookies", col1: "", regex: one_col_regex, start: 78, end: 78, col1_unit: "s" },
    ];
    config.forEach(function (c) {

        var title = "";
        for (var i = c.start; i <= c.end; i++) {
            var line = lines[i];
            var groups = line.match(c.regex);
            if (groups) {
                var res = create_var(groups, c.title + (title ? (c.title ? " - " : "") + title.trim() : ""), c);
                _vars.push(res[0]);
                if (res[1])
                    _vars.push(res[1]);
            } else {
                title = line.trim();
            }
        }
    });
}

function extract_table(lines) {
    var last_uid;
    var value;
    for (var i = 90; i < lines.length; i++) {
        var title = lines[i].match(/^(\S+)$/);
        if (title) {
            if(value && value.length){
                
                table.insertRecord(
                    last_uid, value
                );
            }
            last_uid = title[1];
            value = [];
        } else {
            var match = lines[i].trim().match(/^.*\[ Packets: (\d+).*Bytes: (\d+).*\]$/);
            if(!match){
                match = lines[i].trim().match(/^.*:\s+(.*)/);
                if(match){
                    value.push(match[1]);
                }else{
                    value.push(null);
                }
            }else{
                value.push(match[1]);
                value.push(match[2]);
            }
        }
    }
}

function success(result) {
    result = result.replace(/<p\/>/gm, "");
    var lines = result.split("\n");
    extract_variables(lines);
    extract_table(lines);
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
function execute(){

    return exec.reduce(D.q.when, D.q(clone({}, http_config)));
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    execute().then(function(){
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