
/**
 * This driver checks the status of https certificate for the target device
 * Communication protocol is https
 * return the certificate Issuer, Expiry, Remaining days, Is valid, Certificate authorisation error
 */

var _var = D.device.createVariable;
var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * 
 * @returns Promise that wait for the https call to the target machine and parse the needed data
 */
function getCertificateData() {
    var d = D.q.defer();
    D.device.http.get(
        {
            url: "/",
            headers: {
                connection: "keep-alive",
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
                certError: resp.connection.authorizationError
            });
        });

    return d.promise;
}

/**
 * 
 * @param {*} data contains the data passed by getCertificateData function to calculate remaining days for the certificate
 * @returns the same data in the input with added remainingDays attribute
 */
function parseDate(data){
    var expiryParsed = data.expiry.match(/^(...) (..) (..):(..):(..) (....) GMT$/);
    var month = months.indexOf(expiryParsed[1]);
    var day = expiryParsed[2];
    var hour = expiryParsed[3];
    var min = expiryParsed[4];
    var sec = expiryParsed[5];
    var year = expiryParsed[6];
    var date = new Date();
    date.setUTCFullYear(year, month, day);
    date.setUTCHours(hour, min, sec, 0);
    var diff = Math.floor((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    data.remainingDays = diff <= 0 ? 0 : diff;
    return data;
    
}

/**
 * 
 * @param {*} data 
 * @returns list of variables to be monitored
 */
function createVars(data){
    return [
        _var("issuer", "Issuer", data.issuer),
        _var("expiry", "Expiry", data.expiry),
        _var("remainingDays", "Remaining days", data.remainingDays, "day"),
        _var("valid", "Is valid", data.valid),
        _var("certError", "Certificate authorisation error", data.certError),
    ];
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    function call(callback){
        getCertificateData().then(callback);
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

        getCertificateData()
            .then(parseDate)
            .then(createVars)
            .then(callback);
    }

    call(D.success);
}