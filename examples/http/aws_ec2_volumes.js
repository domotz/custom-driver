/**
 * This driver retrieves information about AWS EC2 instances and attached EBS volumes using the DescribeVolumes API action. 
 * Uses HTTPS to communicate with the API, and computes hash-based message authentication codes (HMAC) using the SHA256 algorithm to sign requests.
 *
 * Communication protocol is https
 */

//These functions are used to compute hash-based message authentication codes (HMAC) using a specified algorithm.
function sha256(message) {
    return D.crypto.hash(message, "sha256", null, "hex");
}
function hmac(algo, key, message) {
    key = D._unsafe.buffer.from(key);
    return D.crypto.hmac(message, key, algo, "hex");
}

var accessKey = D.device.username(); //accessKey == username
var secretKey = D.device.password(); //secretKey == password
var region = "ADD_REGION";
var instanceId = "ADD_INSTANCE_ID";
var monitoringList, volumes;
var vars = [];
var volumesList = [];
var attachments = [];

function sign(key, message) {
    var hex = hmac("sha256", key, message);

    if ((hex.length % 2) === 1) {
        throw "Invalid length of a hex string!";
    }
    var result = new Int8Array(hex.length / 2);
    for (var i = 0, b = 0; i < hex.length; i += 2, b++) {
        result[b] = parseInt(hex.substring(i, i + 2), 16);
    }
    return result;
}

function prepareParams(params) {
    var result = [];
    Object.keys(params).sort().forEach(function (key) {
        if (!params[key]) return;
        if (typeof params[key] !== "object") {
            result.push(key + "=" + encodeURIComponent(params[key]));
        }
        else {
            result.push(prepareObject(key, params[key]));
        }
    });
    return result.join("&");
}

/**
 * @returns  HTTP GET request to an AWS EC2 API to retrieve information about DB instances. 
 */
function httpGet(params) {
    var d = D.q.defer();
    var service = "ec2";
    var data = "";
    var method = "GET";
    var amzdate = (new Date()).toISOString().replace(/\.\d+Z/, "Z").replace(/[-:]/g, ""),
        date = amzdate.replace(/T\d+Z/, ""),
        host = service + "." + region + ".amazonaws.com:443",
        device = D.createExternalDevice(service + "." + region + ".amazonaws.com"),
        canonicalUri = "/",
        canonicalHeaders = "content-encoding:amz-1.0\n" + "host:" + host + "\n" + "x-amz-date:" + amzdate + "\n",
        signedHeaders = "content-encoding;host;x-amz-date",
        canonicalRequest = method + "\n" + canonicalUri + "\n" + params + "\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + sha256(data),
        credentialScope = date + "/" + region + "/" + service + "/" + "aws4_request",
        requestString = "AWS4-HMAC-SHA256" + "\n" + amzdate + "\n" + credentialScope + "\n" + sha256(canonicalRequest),
        key = sign("AWS4" + secretKey, date);
    key = sign(key, region);
    key = sign(key, service);
    key = sign(key, "aws4_request");
    var auth = "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + credentialScope + ", " + "SignedHeaders=" + signedHeaders + ", " + "Signature=" + hmac("sha256", key, requestString);
    device.http.get({
        url: canonicalUri + "?" + params,
        protocol: "https",
        headers: {
            "x-amz-date": amzdate,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Content-Encoding": "amz-1.0",
            "Authorization": auth
        }
    },
    function (err, response, body) {
        if (err) {
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        if (response.statusCode === 401 || response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(body);
    });
    return d.promise;
}

/**
 * @returns promise for http response containing EC2 metrics 
 */
function getVolumesData(nextToken) {
    var payload = {};
    payload["Action"] = "DescribeVolumes",
    payload["MaxResults"] = 100,
    payload["Version"] = "2016-11-15",
    payload["Filter.1.Name"] = "attachment.instance-id",
    payload["Filter.1.Value"] = instanceId,
    payload["NextToken"] = nextToken;
    return httpGet(prepareParams(payload))
        .then(function (data) {
            var $ = D.htmlParse(data);
            volumes = $("DescribeVolumesResponse > volumeSet > item").map(function (index, element) {
                var volume = {};
                $(element).children().each(function (index, child) {
                    if (child.tagName == "attachmentset") {
                        $(child).children("item").each(function (index, attachmentElement) {
                            var attachment = {};
                            $(attachmentElement).children().each(function (index, attachmentChild) {
                                attachment[attachmentChild.tagName] = $(attachmentChild).text();
                            });
                            attachments.push(attachment);
                        });
                        volume["attachmentset"] = attachments;
                    } else {
                        volume[child.tagName] = $(child).text();
                    }
                });
                return volume;
            });
            volumesList = volumesList.concat(volumes);
            nextToken = $("DescribeVolumesResponse > nextToken").text();
            if (nextToken) {
                return getVolumesData(instanceId, nextToken)
                    .then(function (volumeList) {
                        return volumes.concat(volumeList);
                    });
            }
            return volumesList;
        });
}
/**
 * @param {string} property The name of the property to extract
 * @returns The specified property from each object in volumesList.
 */
function extractVolumes(property) {
    return function () {
        return filteredData = volumesList.map(function (volume) { return volume[0][property]; });
    };
}

// The list of custom driver variables to monitor
function fillConfig() {
    monitoringList = [
        {
            //The state of the volume.
            uid: "status",
            label: "Status",
            execute: extractVolumes("status"),
        },
        {
            //The device name specified in the block device mapping.
            uid: "device",
            label: "Device",
            execute: function () {
                return statusList = volumesList.map(function (volume) {
                    return volume[0].attachmentset[0].device;
                });
            }
        },
        {
            //The time stamp when volume creation was initiated.
            uid: "create_time",
            label: "Create time",
            execute: extractVolumes("createtime")
        },
        {
            //The time stamp when the attachment initiated.
            uid: "attachment_time",
            label: "Attachment time",
            execute: function () {
                return statusList = volumesList.map(function (volume) {
                    return volume[0].attachmentset[0].attachtime;
                });
            }
        },
        {
            //The attachment state of the volume. 
            uid: "attachment_status",
            label: "Attachment state",
            execute: function () {
                return statusList = volumesList.map(function (volume) {
                    return volume[0].attachmentset[0].status;
                });

            }
        },
    ];
}

/**
* @param {[object]} data array of objects 
* @returns list of domotz variables
*/
function extract(data) {
    vars = monitoringList.map(function (c) {
        var result;
        if (Array.isArray(c.execute)) {
            result = c.execute.reduce(function (a, b) { return b(a); }, data);
        } else if (typeof (c.execute) == "function") {
            result = c.execute(data);
        }
        if (result != null) {
            return D.device.createVariable(c.uid, c.label, result, c.unit, c.type);
        } else {
            return null;
        }
    }).filter(function (v) {
        return v != null;
    });
}

// This function handles errors
function failure(err) {
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver AWS EC2 is accessible.
 */
function validate() {
    getVolumesData()
        .then(function () {
            D.success();
        }).catch(failure);
}

//Indicate the successful execution for variable list.
function success() {
    D.success(vars);
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to extract monitoring parameters from AWS EC2.
 */
function get_status() {
    getVolumesData()
        .then(fillConfig)
        .then(extract)
        .then(success)
        .catch(failure);
}