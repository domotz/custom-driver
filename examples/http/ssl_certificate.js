
var _var = D.device.createVariable;

var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function get_certificate_data() {
    var d = D.q.defer();
    D.device.http.get(
        {
            url: "/",
            headers: {
                // connection: "keep-alive",
            },
            rejectUnauthorized: false,
            protocol: "https"
        }, function (err, resp) {
            if(err){
                console.error(err);
                D.failure();
            }
            var cert = resp.connection.getPeerCertificate();
            d.resolve({
                issuer: cert.issuer.O,
                expiry: cert.valid_to,
                valid: !resp.connection.authorizationError,
                cert_error: resp.connection.authorizationError
            });
        });

    return d.promise;
}

function parse_date(data){
    var expiry_parsed = data.expiry.match(/^(...) (..) (..):(..):(..) (....) GMT$/);
    var month = months.indexOf(expiry_parsed[1]);
    var day = expiry_parsed[2];
    var hour = expiry_parsed[3];
    var min = expiry_parsed[4];
    var sec = expiry_parsed[5];
    var year = expiry_parsed[6];
    var date = new Date();
    date.setUTCFullYear(year, month, day);
    date.setUTCHours(hour, min, sec, 0);
    var diff = Math.floor((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    data.remaining_days = diff <= 0 ? 0 : diff;
    return data;
    
}

function create_vars(data){
    return [
        _var("issuer", "Issuer", data.issuer),
        _var("expiry", "Expiry", data.expiry),
        _var("remaining_days", "Remaining days", data.remaining_days, "day"),
        _var("valid", "Is valid", data.valid),
        _var("cert_error", "Certificate authorisation error", data.cert_error),
    ];
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    function call(callback){
        get_certificate_data().then(callback);
    }
    call(D.success);
}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    function call(callback){

        get_certificate_data()
            .then(parse_date)
            .then(create_vars)
            .then(callback);
    }

    call(D.success);
}