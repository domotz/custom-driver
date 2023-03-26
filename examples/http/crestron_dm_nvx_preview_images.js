/** 
 * This driver extracts information for Crestron DM-NVX devices.
 * Communication protocol is https
 * Communicate with https api using USERNAME and PASSWORD
 * Create a tables with NVX device Images information
 * The Table has the following columns:
 * -------------------------------------
 * FQDN Path: The path to the device using its FQDN (Fully Qualified Domain Name).
 * IPv4 Path: The path to the device using its IPv4 address.
 * Is Image Available: Indicates whether the device will generate a preview image for this resolution (true) or not (false).
 * Size: The generated image size, in bytes.
 * Height: The height of the generated image.
 * Width: The width of the generated image.
 * -----------------------------------------
 */

var previewImages, monitoringList;
var vars = [];
var table = D.createTable(
    "Images",
    [
        { label: "FQDN Path" },
        { label: "IPv4 Path" },
        { label: "Is Image Available" },
        { label: "Size" },
        { label: "Height" },
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
        var recordId = imageList[image].Name.slice(0, 50); // Slice to comply with record ID limit of 50 characters;
        table.insertRecord(recordId, [
            fqdnPath,
            ipv4Path,
            imageAvailable,
            size,
            height,
            width
        ]);
    }
}


//Indicate the successful execution for table
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
        .then(getPreviewImages)
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
 * @label Get Preview Images
 * @documentation This procedure creates the Preview Images table and collects the data for it
 */
function get_status() {
    login()
        .then(getPreviewImages)
        .then(fillTable)
        .then(success)
        .catch(function (err) {
            console.error(err);
        });
}