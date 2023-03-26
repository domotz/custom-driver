/** 
 * This driver extracts information for Crestron DM-NVX devices.
 * Communication protocol is https
 * Communicate with https api using USERNAME and PASSWORD
 * Create a tables with specific columns.
 * Return a table with this columns:
 * -------------------------------------
 * FQDN Path: The path to the device using its FQDN (Fully Qualified Domain Name).
 * Height: The height of the generated image.
 * IPv4 Path: The path to the device using its IPv4 address.
 * Is Image Available: Indicates whether the device will generate a preview image for this resolution (true) or not (false).
 * Size: The generated image size, in bytes.
 * Width: The width of the generated image.
 * -----------------------------------------
 */

var previewImages, monitoringList;
var vars = [];
var table = D.createTable(
    "Images",
    [
        { label: "FQDN Path" },
        { label: "Height" },
        { label: "IPv4 Path" },
        { label: "Is Image Available" },
        { label: "Size" },
        { label: "Width" },
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
 * @returns promise for http response body containig preview images.
 */
function getPreviewImages() {
    return httpGet("/Device/Preview")
        .then(JSON.parse)
        .then(function (data) {
            previewImages = data.Device.Preview;
        });
}

//Fill the table with data related to discovered streams  
function fillTable() {
    var imageList = previewImages.ImageList;
    for (var image in imageList) {
        var fqdnPath = imageList[image].FQDNPath;
        var height = imageList[image].Height;
        var ipv4Path = imageList[image].IPv4Path;
        var imageAvailable = imageList[image].IsImageAvailable;
        var size = imageList[image].Size;
        var width = imageList[image].Width;
        var id = imageList[image].Name;
        table.insertRecord(id, [
            fqdnPath,
            height,
            ipv4Path,
            imageAvailable,
            size,
            width]);
    }
}

// load the preview image informations
function loadData() {
    return D.q.all([
        getPreviewImages()
    ]);
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

//Indicate the successful execution for table
function success() {
    D.success(table);
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
        .then(success)
        .then(function () {
            D.success();
        })
        .catch(function (err) {
            console.error(err);
        });
}