/**
 * The driver to monitor TLS/SSL certificate on the website.
 * Communication protocol is https.
 * Returns this information of a certificate of the requested site:
 *      Validation result: The certificate validation result
 *      Version: The version of the encoded certificate.
 *      Serial number: Is a positive integer assigned by the CA to each certificate. 
 *      Signature algorithm: The algorithm identifier for the algorithm used by the CA to sign the certificate.
 *      Valid from: The date on which the certificate validity period begins.
 *      Expires on: The date on which the certificate validity period ends.
 *      Fingerprint: The Certificate Signature is the hash of the entire certificate in DER form.
 *      Subject: The field identifies the entity associated with the public key stored in the subject public key field.
 *      Subject alternative name: Extension allows identities to be bound to the subject of the certificate
 *      Issuer: The field identifies the entity that has signed and issued the certificate.
 */

var crypto = require("crypto");
var _var = D.device.createVariable;

//Promise that will be resolved with the certificate information after the HTTPS call is made to the target device.
function getCertificateData() {
    var d = D.q.defer();
    D.device.http.get({
        url: "/",
        protocol: "https",
        headers: {
            "keep-alive": "true"
        },
        port: 443,
    }, function (error, response) {
        if (error) {
            console.error(error);
            D.failure();
        }
        var certificate = response.socket.getPeerCertificate();
        if (!certificate) {
            return d.reject("Unable to retrieve certificate");
        }
        var isSelfSigned = certificate.issuer.commanName === certificate.subject.commanName;
        var validFromDate = new Date(certificate.valid_from);
        var validToDate = new Date(certificate.valid_to);
        var isValid = validFromDate <= new Date() && validToDate >= new Date();
        var isValidButSelfSigned = isSelfSigned && isValid;
        var validity = isValidButSelfSigned ? "valid-but-self-signed" : (isValid ? "valid" : "invalid");
        if (validity !== "valid" && validity !== "valid-but-self-signed") {
            d.resolve({
                message: "Certificate verification failed"
            });
            return;
        }
        //var version = certificate.version;
        var serialNumber = certificate.serialNumber;
        //var signatureAlgorithm = certificate.signatureAlgorithm;
        var validFrom = certificate.valid_from;
        var validTo = certificate.valid_to;
        var fingerprint = crypto.createHash("sha256").update(certificate.fingerprint).digest("hex");
        var subject = certificate.subject.CN;
        var subjectAltName = certificate.subjectaltname;
        var issuer = certificate.issuer.CN;

        d.resolve({
            validation: validity,
            message: "Certificate verified successfully",
            //version: version,
            serialNumber: serialNumber,
            //signatureAlgorithm: signatureAlgorithm,
            validFrom: validFrom,
            validTo: validTo,
            fingerprint: fingerprint,
            subject: subject,
            subjectAltName: subjectAltName,
            issuer: issuer,

        });
    });
    return d.promise;
}

/**
 * @param {*} data 
 * @returns list of variables to be monitored
 */
function createVars(data) {
    var vars;
    if (data.message === "Certificate verified successfully") {
        vars = [
            _var("validation", "Validation result", data.validation),
            //_var("self_signed", "Self signed", data.selfSigned),
            //_var("version", "Version", data.version),
            _var("serial_number", "Serial number", data.serialNumber),
            //_var("signature_algorithm", "Signature algorithm", data.signatureAlgorithm),
            _var("not_before", "Valid from", data.validFrom),
            _var("not_after", "Expires on", data.validTo),
            _var("fingerprint", "Fingerprint", data.fingerprint),
            _var("subject", "Subject", data.subject),
            _var("alternative_names", "Subject alternative name", data.subjectAltName),
            _var("issuer", "Issuer", data.issuer),
        ];
    } else {
        vars = [
            _var("validation", "Validation result", data.validation),
        ];
    }
    D.success(vars);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure check if the server is reachable over https and check if the necessary data exists
*/
function validate() {
    getCertificateData()
        .then(function () {
            D.success();
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
* @remote_procedure
* @label Get https certificate info 
* @documentation This procedure make a https call to the target device, extract the necessary data 
* then create variables for 
*/
function get_status() {
    getCertificateData()
        .then(createVars)
        .then(function () {
            D.success();
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
} 