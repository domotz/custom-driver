var crypto = require("crypto");
var region = "YOUR_REGION";
var accessKeyId = "YOUR_ACCESS_KEY_ID";
var secretAccessKey = "YOUR_SECRET_ACCESS_KEY";
var method = "POST";
var service = "ce";
var host = service + "." + region + ".amazonaws.com";
var path = "/";
var headers = {
    "Content-Type": "application/x-amz-json-1.0",
    "X-Amz-Target": "AWSInsightsIndexService.GetCostAndUsage",
    "X-Amz-Date": new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ""),
    "Host": host
};
console.log("X-Amz-Date:", headers["X-Amz-Date"]);
var body = JSON.stringify({
    TimePeriod: {
        Start: "2022-02-01",
        End: "2022-02-28"
    },
    Granularity: "DAILY",
    Metrics: [
        "BlendedCost"
    ]
});

var canonicalHeaders = Object.keys(headers)
    .sort()
    .map(function (key) { key.toLowerCase() + ":" + headers[key] + "\n"; })
    .join("");
var signedHeaders = Object.keys(headers).sort().join(";");
var canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders, crypto.createHash("sha256").update(body).digest("hex")
].join("\n");

var datestamp = headers["X-Amz-Date"].substring(0, 8);
var credentialScope = [datestamp, region, service, "aws4_request"].join("/");
var stringToSign = ["AWS4-HMAC-SHA256", headers["X-Amz-Date"], credentialScope, crypto.createHash("sha256").update(canonicalRequest).digest("hex")
].join("\n");

var kDate = crypto.createHmac("sha256", "AWS4" + secretKey).update(datestamp).digest();
var kRegion = crypto.createHmac("sha256", kDate).update(region).digest();
var kService = crypto.createHmac("sha256", kRegion).update(service).digest();
var kSigning = crypto.createHmac("sha256", kService).update("aws4_request").digest();
var signature = crypto.createHmac("sha256", kSigning).update(stringToSign).digest("hex");
console.log(signature);
var authorizationHeader = [
    "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + credentialScope,
    "SignedHeaders=" + signedHeaders,
    "Signature=" + signature
].join(", ");
headers["Authorization"] = authorizationHeader;

function getBillingMetrics() {
    var d = D.q.defer();
    D.device.http.post({
        url: path,
        protocol: "https",
        method: method,
        headers: headers,
        body: body
    },
        function (err, response, body) {
            if (err) {
                D.failure(D.errorType.GENERIC_ERROR);
            }
            if (response.statusCode == 404) {
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            }
            if (response.statusCode == 401) {
                D.failure(D.errorType.AUTHENTICATION_ERROR);
            }
            if (response.statusCode != 200) {
                D.failure(D.errorType.GENERIC_ERROR);
            }
            d.resolve(JSON.parse(body));
        });
    return d.promise;
}
function validate() {
    getBillingMetrics()
        .then(function () {
            D.success();
        });
}

function get_status() {
    getBillingMetrics()
        .then(function () {
            D.success();
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

