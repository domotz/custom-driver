

/**
 * This driver checks the status of https certificate for a list of devices specified in servers_to_check var
 * Communication protocol is https
 * return a table contains the certificate [Issuer, Expiry, Remaining days, Is valid, Certificate authorisation error] for each server listed
 */

var table = D.createTable(
    "SSL Certificates",
    [
        { label: "Issuer" },
        { label: "Expiry" },
        { label: "Remaining days", unit: "day" },
        { label: "Is valid" },
        { label: "Auth error" },
    ]
);

// list of servers to check the status of their https certificate
var servers_to_check = ["domotz.com", "google.com", "twitter.com"];

var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * 
 * @returns Promise wait until all https calls are done to the target servers
 */
function get_all_certficate_data() {
    return D.q.all(
        servers_to_check.map(get_certificate_data)
    );
}

/**
 * 
 * @param {*} target_server server to check its https certificate status
 * @returns Promise that wait for the https call to the target_server and parse the needed data
 */
function get_certificate_data(target_server) {
    var d = D.q.defer();
    var website = D.createExternalDevice(target_server);
    website.http.get(
        {
            url: "/",
            headers: {
                connection: "keep-alive",
            },
            rejectUnauthorized: false,
            protocol: "https"
        }, function (err, resp) {
            if (err) {
                console.error(err);
                D.failure();
            }
            var data = null;
            if(resp && resp.connection && resp.connection.getPeerCertificate){
                var cert = resp.connection.getPeerCertificate();
                if(cert && Object.keys(cert).length)
                    data = {
                        server: target_server,
                        issuer: cert.issuer.O,
                        expiry: cert.valid_to,
                        valid: !resp.connection.authorizationError,
                        cert_error: resp.connection.authorizationError
                    };
            } 
            d.resolve(data);
        });

    return d.promise;
}

/**
 * 
 * @param {*} data_list https parsed data for each server in the servers_to_check
 * @returns same data_list with added remaining_days attribute for each data in the list
 */
function parse_dates(data_list) {
    return data_list.map(parse_date);
}


/**
 * 
 * @param {*} data contains the data passed by get_certificate_data function to calculate remaining days for the certificate
 * @returns the same data in the input with added remaining_days attribute
 */
function parse_date(data) {
    if(!data) return null;
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

function fill_table(data_list) {
    data_list.filter(function(data) { return data; }).forEach(function (data) {
        table.insertRecord(data.server,
            [data.issuer, data.expiry, data.remaining_days, data.valid, data.cert_error]
        );
    });
    return table;
}

function failure(err){
    console.error(err);
    D.failure();
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    get_all_certficate_data()
        .then(D.success)
        .catch(failure);
}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    get_all_certficate_data()
        .then(parse_dates)
        .then(fill_table)
        .then(D.success)
        .catch(failure);
}