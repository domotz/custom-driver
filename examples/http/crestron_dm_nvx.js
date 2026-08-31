/** 
 * This driver extracts information for Crestron DM-NVX devices.
 * Communication protocol is https
 * Communicate with https api using USERNAME and PASSWORD
 * Create a table for stream Receiving or Transmitting information depending on the operational mode of the NVX device.

 * -------------------------------------
 * Columns for the table 'Stream Receive':
 * MulticastAddress: The multicast address of the device connected to the receiving device.
 * InitiatorAddress: The address of the device connected to the receiver.
 * HorizontalResolution: The horizontal resolution of the received stream.
 * VerticalResolution: The vertical resolution of the received stream.
 * 
 * Columns for the table 'Stream Transmit':
 * MulticastAddress: The multicast address of the transmitted stream.
 * StreamLocation: The multicast address of the transmitted stream.
 * ActiveBitrate: The bitrate of the active stream, in Mbps.
 * HorizontalResolution: The horizontal resolution of the stream.
 * VerticalResolution: The vertical resolution of the stream.
 * -----------------------------------------
 */

var deviceInfo, systemVersions, deviceSpecific, streamReceive, streamTransmit, monitoringList;
var vars = [];
var table;
var tableStreamReceive = D.createTable(
    "Stream Receive",
    [
        { label: "MulticastAddress" },
        { label: "InitiatorAddress" },
        { label: "HorizontalResolution" },
        { label: "VerticalResolution" },
    ]
);
var tableStreamTransmit = D.createTable(
    "Stream Transmit",
    [
        { label: "MulticastAddress" },
        { label: "StreamLocation" },
        { label: "ActiveBitrate" },
        { label: "HorizontalResolution" },
        { label: "VerticalResolution" }
    ]
);

/**
 * Utility wrapper function for http get commands
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
        if (err) {
            console.error(err);
        }
        d.resolve(body);
    });
    return d.promise;
}

/**
 * @returns promise for http response body containig system version information for the DM NVX device
 */
function getSystemVersions() {
    return httpGet("/Device/SystemVersions")
        .then(JSON.parse)
        .then(function (data) {
            systemVersions = data;

        });
}

/**
 * @returns promise for http response body containig device specific information.
 */
function getDeviceSpecific() {
    return httpGet("/Device/DeviceSpecific")
        .then(JSON.parse)
        .then(function (data) {
            deviceSpecific = data;
        });
}

/**
 * @returns promise for http response body containig device information for the DM NVX device.  
 */
function getDeviceInfo() {
    return httpGet("/Device/DeviceInfo")
        .then(JSON.parse)
        .then(function (data) {
            deviceInfo = data;
        });
}

/**
 * @returns promise for http response body containig received stream for the DM NVX device.
 */
function getStreamReceive() {
    return httpGet("/Device/StreamReceive")
        .then(JSON.parse)
        .then(function (data) {
            streamReceive = data;
        });
}

/**
 * Function to get the stream transmitting information.
 * @returns promise for http response body containig transmitted stream for the DM NVX device.
 */
function getStreamTransmit() {
    return httpGet("/Device/StreamTransmit")
        .then(JSON.parse)
        .then(function (data) {
            streamTransmit = data;
        });
}

/**
 * Extracts values of Crestron DM-NVX devices
 * @param {string} key parameter key
 * @param {object} data for Crestron DM NVX informations
 * @returns values of Crestron DM-NVX devices
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
            //The device name.
            uid: "Name",
            label: "Name",
            execute: extractValue(deviceInfo.Device.DeviceInfo, "Name")
        },
        {
            //The device model.
            uid: "Model",
            label: "Model",
            execute: extractValue(deviceInfo.Device.DeviceInfo, "Model")
        },
        {
            //The device serial number.
            uid: "SerialNumber",
            label: "Serial number",
            execute: extractValue(deviceInfo.Device.DeviceInfo, "SerialNumber")
        },
        {
            //The component version.
            uid: "Version",
            label: "Version",
            execute: extractValue(deviceInfo.Device.DeviceInfo, "DeviceVersion")
        },
        {
            //The device operational mode.
            uid: "DeviceMode",
            label: "Device mode",
            execute: extractValue(deviceSpecific.Device.DeviceSpecific, "DeviceMode")
        }
    ];
}
//Fill the table with data related to reception or transmission stream according on the device mode  
function fillTable() {
    if (deviceSpecific.Device.DeviceSpecific.DeviceMode === "Receiver") {
        table = tableStreamReceive;
        var recive = streamReceive.Device.StreamReceive.Streams;
        for (var i in recive) {
            var multicastAddress = recive[i].MulticastAddress;
            var initiatorAddress = recive[i].InitiatorAddress;
            var horizontalResolution = recive[i].HorizontalResolution;
            var verticalResolution = recive[i].VerticalResolution;
            var id = "StreamReceive: " + i;
            table.insertRecord(id, [
                multicastAddress,
                initiatorAddress,
                horizontalResolution,
                verticalResolution
            ]);
        }
    } else {
        table = tableStreamTransmit;
        var transmit = streamTransmit.Device.StreamTransmit.Streams;
        for (var t in transmit) {
            var multicastAddresst = transmit[t].MulticastAddress;
            var streamLocationt = transmit[t].StreamLocation;
            var activeBitratet = transmit[t].ActiveBitrate;
            var horizontalResolutiont = transmit[t].HorizontalResolution;
            var verticalResolutiont = transmit[t].VerticalResolution;
            var id1 = "StreamTransmit: " + t;
            table.insertRecord(id1, [
                multicastAddresst,
                streamLocationt,
                activeBitratet,
                horizontalResolutiont,
                verticalResolutiont
            ]);
        }
    }
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
            return D.createVariable(c.uid, c.label, result, c.unit, c.type);
        } else {
            return null;
        }
    }).filter(function (v) {
        return v != null;
    });
}

// Load system version, device‑specific and device informations
// Load StreamReceive info if the device mode "Receiver" else load StreamTransmit info
function loadData() {
    return getDeviceSpecific()
        .then(function () {
            if (deviceSpecific.Device.DeviceSpecific.DeviceMode === "Receiver") {
                return getStreamReceive();
            } else {
                return getStreamTransmit();
            }
        }).then(function () {
            return D.q.all([
                getSystemVersions(),
                getDeviceInfo()
            ]);
        }).then(function () {
            fillConfig();
        });
}


//Indicate the successful execution of the driver and returns the variable list and table data
function success() {
    D.success(vars, table);
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
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to extract monitoring parameters from Crestron DM NVX API.
 * 
 */
function get_status() {
    login()
        .then(loadData)
        .then(fillTable)
        .then(extract)
        .then(success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.PARSING_ERROR);
        });
}
