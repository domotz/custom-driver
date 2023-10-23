

/**
 * This driver checks the status of https certificate for a list of devices specified in serversToCheck var
 * Communication protocol is https
 * return a table with this columns:
 * %server name
 * %Issuer, 
 * %Expiry, 
 * %Remaining days, 
 * %Is valid, 
 * %Certificate authorization error
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
var serversToCheck = D.getParameter('serversToCheck');

var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * 
 * @returns Promise wait until all https calls are done to the target servers
 */
function getAllCertificateData() {
    return D.q.all(
        serversToCheck.map(getCertificateData)
    );
}

/**
 * 
 * @param {*} targetServer server to check its https certificate status
 * @returns Promise that wait for the https call to the targetServer and parse the needed data
 */
function getCertificateData(targetServer) {
    var d = D.q.defer();
    var website = D.createExternalDevice(targetServer);
    website.http.getTLSCertificate(
        {
            url: "/",
        }, function (err, resp) {
            if (err) {
                console.error(err);
                return d.resolve();
            }
            resp.server = targetServer;
            d.resolve(resp);
        });

    return d.promise;
}

/**
 * 
 * @param {*} dataList https parsed data for each server in the serversToCheck
 * @returns same dataList with added remainingDays attribute for each data in the list
 */
function parseDates(dataList) {
    return dataList.map(parseDate);
}


/**
 * 
 * @param {*} data contains the data passed by getCertificateData function to calculate remaining days for the certificate
 * @returns the same data in the input with added remainingDays attribute
 */
function parseDate(data) {
    if (!data) return null;
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

function fillTable(dataList) {
    dataList.filter(function (data) { return data; }).forEach(function (data) {
        table.insertRecord(data.server,
            [data.issuer, data.expiry, data.remainingDays, data.valid, data.certError]
        );
    });
    D.success(table);
}

function failure(err) {
    console.error(err);
    D.failure();
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    function verify(callback) {
        getAllCertificateData()
            .then(callback)
            .catch(failure);
    }
    verify(function(){
        D.success();
    });
}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    getAllCertificateData()
        .then(parseDates)
        .then(fillTable)
        .catch(failure);
}