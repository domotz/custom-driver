/**
 * The driver gets AWS RDS instance metrics and uses the script item to make HTTP requests to the CloudWatch API.
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

var region = "ADD_REGION";
var secretKey = "ADD_SECRET_ACCESS_KEY";
var accessKey = "ADD_ACCESS_KEY";
var dbInstanceId = "ADD_DB_INSTANCE_ID";
var monitoringList, instanceInfo;

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
 * Authorization based on: https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html 
 * @returns  HTTP GET request to an AWS RDS API to retrieve information about DB instances. 
 */
function httpGet(params) {
    var d = D.q.defer();
    var service = "rds";
    var method = "GET";
    var data = "";
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
        },
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

/**
 * @returns promise for http response containing instance info
 */
function getInstanceData() {
    var payload = {};
    payload["Action"] = "DescribeDBInstances",
        payload["Version"] = "2014-10-31",
        payload["DBInstanceIdentifier"] = dbInstanceId;
    return httpGet(prepareParams(payload))
        .then(function (data) {
            instanceInfo = data.DescribeDBInstancesResponse.DescribeDBInstancesResult.DBInstances;
        });
}

/**
 * @param {Array} data An array of objects.
 * @param {string} key The name of the property to extract from the objects.
 * @returns The value of the specified key in the first object in the array.
 */
function extractValueByKey(data, key) {
    return function () {
        var filteredData = data.filter(function (item) { return item; });
        if (filteredData.length === 0) {
            return null;
        }
        return filteredData[0][key];
    };
}

// The list of custom driver variables to monitor
function fillConfig() {
    monitoringList = [
        {
            //Contains the name of the compute and memory capacity class of the DB instance.
            uid: "class",
            label: "Class",
            execute: extractValueByKey(instanceInfo, "DBInstanceClass")
        },
        {
            //Provides the date and time the DB instance was created.
            uid: "create_time",
            label: "Create time",
            execute: [extractValueByKey(instanceInfo, "InstanceCreateTime"), function (res) { return new Date(res * 1000); }]
        },
        {
            //Database engine.
            uid: "engine",
            label: "Engine",
            execute: extractValueByKey(instanceInfo, "Engine")
        },
        {
            //Indicates the database engine version.
            uid: "version",
            label: "Engine version",
            execute: extractValueByKey(instanceInfo, "EngineVersion"),
        },
        {
            //The status of a read replica. If the instance isn't a read replica, this is blank.
            uid: "read_replica_state",
            label: "Read replica: State",
            execute: function () {
                var data = instanceInfo.filter(function (item) { return item; })[0].StatusInfos;
                if (data !== null) {
                    var resultat = data.filter(function (obj) { return obj; }).Normal;
                    return resultat;
                }
            }
        },
        {
            //The status of a read replica. If the instance isn't a read replica, this is blank.Status of the DB instance.
            uid: "read_replica_status",
            label: "Read replica: Status",
            execute: function () {
                var data = instanceInfo.filter(function (item) { return item; })[0].StatusInfos;
                if (data !== null) {
                    var resultat = data.filter(function (obj) { return obj; }).Status;
                    return resultat;
                }
            }
        },
        {
            //Specifies the current state of this database.
            uid: "status",
            label: "Status",
            execute: extractValueByKey(instanceInfo, "DBInstanceStatus")
        },
        {
            //Specifies the allocated storage size specified in gibibytes (GiB).
            uid: "allocated",
            label: "Storage: Allocated",
            execute: extractValueByKey(instanceInfo, "AllocatedStorage"),
            unit: "GiB"
        },
        {
            //The upper limit in gibibytes (GiB) to which Amazon RDS can automatically scale the storage of the DB instance.
            uid: "max_allocated",
            label: "Storage: Max allocated",
            execute: function () {
                return (typeof instanceInfo.MaxAllocatedStorage === "undefined") ? -1 : instanceInfo.MaxAllocatedStorage;
            },
            unit: "GiB"
        },
        {
            //Specifies the storage type associated with DB instance.
            uid: "storage_type",
            label: "Storage type",
            execute: extractValueByKey(instanceInfo, "StorageType")
        },
    ];
}

/**
 * @param {[object]} data array of objects 
 *  @returns list of domotz variables
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

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver AWS RDS instance is accessible.
 */
function validate() {
    getInstanceData()
        .then(function () {
            D.success();
        });
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to extract monitoring parameters from AWS RDS.
 */
function get_status() {
    getInstanceData()
        .then(function () {
            fillConfig();
        })
        .then(extract)
        .then(function () {
            D.success(vars);
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
