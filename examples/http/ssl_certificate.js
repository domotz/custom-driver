
/**
 * This driver checks the status of https certificate for the target device
 * Communication protocol is https
 * return this certificate information:
 *  %Issuer
 *  %Expiry
 *  %Remaining days
 *  %Is valid
 *  %Certificate authorization error
 */

var _var = D.device.createVariable;
var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * 
 * @returns Promise that wait for the https call to the target machine and parse the needed data
 */
function getCertificateData() {
    var d = D.q.defer();
    D.device.http.getTLSCertificate({}, function (err, resp) {
            if (err) {
                console.error(""+err);
                D.failure();
            }
            d.resolve(resp);
        });
    return d.promise;
}

/**
 * 
 * @param {*} data contains the data passed by getCertificateData function to calculate remaining days for the certificate
 * @returns the same data in the input with added remainingDays attribute
 */
function parseDate(data) {
    if(data && data.expiry){
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
    }
    return data;

}

/**
 * 
 * @param {*} data 
 * @returns list of variables to be monitored
 */
function createVars(data) {
    if(!data) D.failure(D.errorType.GENERIC_ERROR);
    D.success([
        _var("issuer", "Issuer", data.issuer),
        _var("expiry", "Expiry", data.expiry),
        _var("remainingDays", "Remaining days", data.remainingDays, "day"),
        _var("valid", "Is valid", data.valid),
        _var("certError", "Certificate authorization error", data.certError),
    ]);
}

function failure(err) {
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure check if the server is reachable over https and check if the necessary data exists
*/
function validate() {
    function call(callback) {
        getCertificateData()
            .then(callback)
            .catch(failure);
    }
    call(function () {
        D.success();
    });
}


/**
* @remote_procedure
* @label Get https certificate info 
* @documentation This procedure make a https call to the target device, extract the necessary data 
* then create variables for %Issuer, %Expiry, %Remaining days, %Is valid, %Certificate authorization error
*/
function get_status() {

    getCertificateData()
        .then(parseDate)
        .then(createVars)
        .catch(failure);
}