/** 
 * This driver extracts information for Crestron DM-NVX devices.
 * Communication protocol is https
 * Communicate with https api using USERNAME and PASSWORD
 * Create a tables  for Discovered Streaming information ('Discovered Streams').
 * Return a table with these columns:
 * -------------------------------------
 * Session name: The session name.
 * Bitrate: The stream bitrate in Mbps.
 * Resolution: The stream resolution.
 * Multicast adress: The multicast address.
 * -----------------------------------------
 */

var discoveredStreams;
var table = D.createTable(
    "Discovered Streams",
    [
        { label: "Session name" },
        { label: "Bitrate" },
        { label: "Resolution" },
        { label: "Multicast adress" },
    ]
);

/**
 * @returns a promise containing the body of the login page.
 */
function login() {
    var d = D.q.defer();
    D.device.http.post({
        url: "/userlogin.html",
        protocol: "https",
        form: {
            login: D.device.username(),
            passwd: D.device.password(),
        },
        jar: true,
        rejectUnauthorized: false
    }, function (err, res, body) {
        d.resolve(body);
    });

    return d.promise;
}

/**
 * @returns a promise containing the body of the response.
 */
function httpGet(url) {
    var d = D.q.defer();
    var config = {
        url: url,
        protocol: "https",
        jar: true,
        rejectUnauthorized: false
    };
    D.device.http.get(config, function (error, response, body) {
        if (response.statusCode && response.statusCode === 200 && body)
            d.resolve(body);
    });
    return d.promise;
}

/**
 * @returns promise for http response body containig discoveres streaams informations.
 */
function getDiscoveredStreams() {
    return httpGet("/Device/DiscoveredStreams")
        .then(JSON.parse)
        .then(function (data) {
            discoveredStreams = data.Device.DiscoveredStreams;
        });
}

//Fill the table with data related to discovered streams  
function fillTable() {
    var stream = discoveredStreams.Streams;
    for (var uuid in stream) {
        var sessionName = stream[uuid].SessionName;
        var bitrate = stream[uuid].Bitrate;
        var resolution = stream[uuid].Resolution;
        var multicastAddress = stream[uuid].MulticastAddress;
        var recordId = stream[uuid].UniqueId;
        table.insertRecord(recordId, [
            sessionName,
            bitrate,
            resolution,
            multicastAddress
        ]);
    }
}

//Indicate the successful execution for the get status and returns the table data
function success() {
    D.success(table);
}

/**
 * @remote_procedure
 * @label Validate DM-NVX Device
 * @documentation This procedure is used to validate if the data needed for the retrieval is accessible
 */
function validate() {
    login()
        .then(getDiscoveredStreams)
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
 * @label Get Discovered Streams
 * @documentation This procedure is used to extract monitoring parameters from Crestron API.
 */
function get_status() {
    login()
        .then(getDiscoveredStreams)
        .then(fillTable)
        .then(success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.PARSING_ERROR);
        });
}