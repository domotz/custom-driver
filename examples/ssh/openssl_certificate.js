
/**
 * Domotz Custom Driver 
 * Name: SSL Certificate Expiration check
 * Description: This script checks the SSL certificate status for a list of target servers specified in the 'targetServerHost' and 'targetServerPort' parameters.
 * 
 * Communication protocol is SSH
 * 
 * Tested on Linux Distributions:
 *      - Ubuntu 20.04 LTS
 * Shell Version:
 *      - Bash 5.1.16
 * 
 * Return a table containing the following columns for each server:
 *      - Issuer
 *      - Expiry
 *      - Remaining days
 *      - Is Valid
 *      - Authorization error
 * 
 **/

var table = D.createTable(
    "SSL Certificates",
    [
        { label: "Issuer" },
        { label: "Expiry" },
        { label: "Remaining days", unit: "day" },
        { label: "Is valid" },
        { label: "Authorization error" }
    ]
);

var serversToCheck = D.getParameter('serversToCheck');

var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 30000
};

function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function executeCommand(host) {
    var d = D.q.defer();
    var command = 'echo | openssl s_client -servername ' + host + ' -connect ' + host + ' 2>/dev/null | openssl x509 -enddate -issuer -noout';
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (output, error) {
        if (error) {
            console.error("Command execution error: " + error);
            d.reject(error);
        } else {
            d.resolve(output);
        }
    });
    return d.promise;
}


function parseValidateOutput(output) {
    if (output !== "") {
        console.info("Validation successful");
    } else {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    }
}

/**
* @remote_procedure
* @label Validate SSH connectivity with the device
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as to verify the connectivity.
*/
function validate() {
    var promises = [];
    for (var i = 0; i < serversToCheck.length; i++) {
        var host = serversToCheck[i];
        promises.push(executeCommand(host));
    }
    D.q.all(promises)
        .then(parseValidateOutput)
        .then(D.success)
        .catch(checkSshError);
}

/**
 * @remote_procedure
 * @label Get SSL Certificate
 * @documentation Retrieves and stores SSL certificate information for the specified target servers.
 */
function get_status() {
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    var promises = serversToCheck.map(function (host) {
        return executeCommand(host)
            .then(function (certificateInfo) {
                var issuerRegEx = certificateInfo.match(/O = ([^,]+)/);
                var issuer = issuerRegEx ? issuerRegEx[1] : '-';
                var expiryRegEx = certificateInfo.match(/notAfter=(.+)/);
                var expiry = expiryRegEx ? expiryRegEx[1] : '-';
                var expiryDate = new Date(expiry);
                var currentDate = new Date();
                var remainingDays = Math.ceil((expiryDate - currentDate) / (1000 * 60 * 60 * 24));
                var isValid = remainingDays > 0;
                var authError = "-";
                var server = host.split(":");
                var recordId = server[0].replace(recordIdSanitizationRegex, '').slice(0, 50);
                table.insertRecord(
                    recordId, [issuer, expiry, remainingDays, isValid , authError ]
                );
            })
            .catch(function (err) {
                console.error("Error retrieving SSL certificate for host '" + host + "': " + err);
            });
    });

    D.q.all(promises)
        .then(function () {
            D.success(table);
        })
        .catch(checkSshError);
}