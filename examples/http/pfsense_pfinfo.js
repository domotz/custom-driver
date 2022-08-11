/**
 * This driver extract pfinfo information from pfsense web page
 * Communication protocol is https
 * Create multiple monitoring variables for pfinfo
 * Tested under pfsense 2.6.0-RELEASE
 */

var createVar = D.device.createVariable;


var httpConfig = {
    url: "/",
    protocol: "https",
    rejectUnauthorized: false,
    jar: true
    // followRedirect: true
};

/**
 * 
 * @param {*} config http config for pfsense web application
 * @returns Promise wait for html login form
 */
function getLoginForm(config) {
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
 * extract __csrf_magic input to be used for other requests
 * @param {string} body html
 * @returns __csrf_magic value
 */
function getCsrfMagic(body) {
    var $ = D.htmlParse(body);
    var csrfMagicElement = $("input[name=__csrf_magic]");
    var csrfMagic = csrfMagicElement[0].attribs.value;
    return csrfMagic;
}

/**
 * proceed login process
 * @param {string} csrfMagic csrf string to be used for authentication
 * @returns Promise wait until the authentication is done
 */
function login(csrfMagic) {
    var d = D.q.defer();
    var config = clone({
        form: {
            "__csrf_magic": csrfMagic,
            "usernamefld": D.device.username(),
            "passwordfld": D.device.password(),
            "login": "Sign+In"
        }

    }, httpConfig);
    config.url = "/";

    D.device.http.post(config, function (err, response, body) {
        if (err) {
            console.error(err);
            return D.failure();
        }
        delete httpConfig.body;
        d.resolve();
    });
    return d.promise;
}

/**
 * 
 * @returns csrf under pfinfo page
 */
function getPfinfoCsrfMagic() {
    var d = D.q.defer();
    var config = clone({
        url: "/diag_pf_info.php",
    }, httpConfig);
    D.device.http.get(config, function (err, response, body) {
        if (err) {
            console.error(err);
            return D.failure();
        }
        d.resolve(getCsrfMagic(body));
    });
    return d.promise;
}

/**
 * 
 * @param {*} csrfMagic 
 * @returns Promise that wait pfinfo data
 */
function getPfinfoBody(csrfMagic) {
    var d = D.q.defer();
    var config = clone({
        url: "/diag_pf_info.php",
        form: {
            "__csrf_magic": csrfMagic, "refresh": "yes", "getactivity": "yes"
        }
    }, httpConfig);
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
 * @param {*} init object initialization
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

function generateVar(groups, title, c) {
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
    var res = [createVar(uid + "_" + c.col1.replace(/\s+/g, "_"), label + (c.col1 ? " - " + c.col1 : ""), value1, c.col1Unit)];
    if (value2) {
        res.push(createVar(uid + c.col2.replace(/\s+/g, "_"), label + (c.col2 ? " - " + c.col2 : ""), value2, c.col2Unit));
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
 * extract variables from pfinfo body
 */
function extractVariables(lines) {
    // Interface Stats for em1
    var twoColRegex = /^(.*\S)\s+(\S+)\s+(\S*)$/;
    var oneColRegex = /^(.*\S)\s+(\d+\.?\d*).*$/;
    var config = [
        { title: "Interface Stats for em1", col1: "v4", col2: "v6", regex: twoColRegex, start: 6, end: 13 },
        { title: "State Table", col1: "total", col2: "rate", regex: twoColRegex, start: 16, end: 19, col2Unit: "per second" },
        { title: "", col1: "total", col2: "rate", regex: twoColRegex, start: 20, end: 52, col2Unit: "per second" },
        { title: "Syncookies", col1: "", regex: /^(.*\S)\s+(\S+)$/, start: 54, end: 54 },
        { title: "Syncookies", col1: "", regex: oneColRegex, start: 55, end: 58 },
        { title: "Syncookies", col1: "", regex: oneColRegex, start: 59, end: 75, col1Unit: "s" },
        { title: "Syncookies", col1: "", regex: oneColRegex, start: 76, end: 77, col1Unit: "states" },
        { title: "Syncookies", col1: "", regex: oneColRegex, start: 78, end: 78, col1Unit: "s" },
    ];
    config.forEach(function (c) {

        var title = "";
        for (var i = c.start; i <= c.end; i++) {
            var line = lines[i];
            var groups = line.match(c.regex);
            if (groups) {
                var res = generateVar(groups, c.title + (title ? (c.title ? " - " : "") + title.trim() : ""), c);
                _vars.push(res[0]);
                if (res[1])
                    _vars.push(res[1]);
            } else {
                title = line.trim();
            }
        }
    });
}

/**
 * extract info from pfinfo body and build a table that contains interfaces statistics
 */
function extractTable(lines) {
    var lastUid;
    var value;
    for (var i = 90; i < lines.length; i++) {
        var title = lines[i].match(/^(\S+)$/);
        if (title) {
            if(value && value.length){
                
                table.insertRecord(
                    lastUid, value
                );
            }
            lastUid = title[1];
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
    extractVariables(lines);
    extractTable(lines);
    D.success(_vars, table);
}

function failure(error) {
    console.error(error);
    D.failure(D.errorType.GENERIC_ERROR);
}

var exec = [
    getLoginForm,
    getCsrfMagic,
    login,
    getPfinfoCsrfMagic,
    getPfinfoBody
];
function execute(){

    return exec.reduce(D.q.when, D.q(clone({}, httpConfig)));
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