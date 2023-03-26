/** 
 * This driver extracts information for Crestron DM-NVX devices.
 * Communication protocol is https
 * Communicate with https api using USERNAME and PASSWORD
 * Create a tables with specific columns.
 * Return a table with this columns:
 * -------------------------------------
 * Address: The address of the connecting device. This can be an IP address or a host name.
 * Ip id: The IP ID on the DM NVX device used to connect to a control system. This is also the key for the object in the entries collection.
 * Status: The device status.
 * -----------------------------------------
 */

var ipTable, ipTableEntryObject, monitoringList;
var vars = [];
var table = D.createTable(
    "Entry Object",
    [
        { label: "Address" },
        { label: "Ip Id" },
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

// The list of custom driver variables to monitor
function fillConfig() {
    monitoringList = [
        {
            //The maximum number of allowed IP table entries.
            uid: "MaxEntries",
            label: "Max entries",
            execute: extractValue(ipTable.Device.IpTable, "MaxEntries")
        },
        {
            //Used to authenticate with the control system. 
            uid: "Username",
            label: "Username",
            execute: extractValue(ipTable.Device.IpTable, "Username")
        },
        {
            uid: "Version",
            label: "Version",
            execute: extractValue(ipTable.Device.IpTable, "Version")
        }
    ];
}
//Fill the table with data related to ip table  
function fillTable() {
    ipTable.Device.IpTable.Entries.forEach(function (item) {
        var ipId = item.IpId;
        var address = item.Address;
        var status = item.Status;
        var id = item.DeviceId + "/" + item.ModelName;
        table.insertRecord(id, [
            ipId,
            address,
            status
        ]);
    });
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

// load ipTable informations
function loadData() {
    return D.q.all([
        getIpTable()
    ])
        .then(function () {
            fillConfig();
        });
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if data are accessible
 */
function validate() {
    login()
        .then(loadData)
        .then(function () {
            D.success();
        });
}

//Indicate the successful execution for variable list and table
function success() {
    D.success(vars, table);
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to extract monitoring parameters from Crestron API.
 */
function get_status() {
    login()
        .then(loadData)
        .then(fillTable)
        .then(extract)
        .then(success)
        .catch(function (err) {
            console.error(err);
        });
}