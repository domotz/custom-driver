/** 
 * This driver extracts information for Crestron DM-NVX devices.
 * Communication protocol is https
 * Communicate with https api using USERNAME and PASSWORD
 * Create a tables for Connected Devices to DM-NVX device
 * The table has the following columns:
 * -------------------------------------
 * Address: The address of the connected device. This can be an IP address or a host name.
 * Model: The model of the connected device.
 * Status: The device status.
 * -----------------------------------------
 */

var ipTable, ipTableEntryObject, monitoringList;
var vars = [];
var table = D.createTable(
    "Connected Devices",
    [
        { label: "Address" },
        { label: "Model" },
        { label: "Status" }
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
 * @returns promise for http response body containig IP table informations for the DM NVX device.
 */
function getIpTable() {
    return httpGet("/Device/IpTable")
        .then(JSON.parse)
        .then(function (data) {
            ipTable = data;
        });
}

/**
 * @param {string} key parameter key
 * @param {object} data for Crestron DM NVX informations
 * @returns extract values of Crestron DM-NVX devices
 */
function extractValue(data, key) {
    return function () {
        return data[key];
    };
}

//Fill the table with data related to ip table  
function fillTable() {
    ipTable.Device.IpTable.Entries.forEach(function (item) {
        var model = item.ModelName;
        var address = item.Address;
        var status = item.Status;
        var recordId = item.IpId;
        table.insertRecord(recordId, [
            address,
            model,
            status
        ]);
    });
}

//Indicate the successful execution of the driver and returns table data.
function success() {
    D.success(table);
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if data are accessible
 */
function validate() {
    login()
        .then(getIpTable)
        .then(fillTable)
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
 * @label Get Device Variables
 * @documentation This procedure is used to extract monitoring parameters from Crestron API.
 */
function get_status() {
    login()
        .then(getIpTable)
        .then(fillTable)
        .then(success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.PARSING_ERROR);
        });
}