
/**
 * This driver extracts docker images information
 * The communication protocol is SSH
 * This driver show a table with images details:
 * -------------------------------
 * %Id: the repository
 * %Latest Tag
 * %Latest Image ID
 * %Latest Image Created Since
 * %Latest Image Created Date
 * %Latest Image Size
 * %Total Images Size
 * %Total number of Images
 * -------------------------------
 * Tested under Docker version 19.03.15, build 99e3ed8919
 */


var ssh_config = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 10000,
    command: "docker image ls --format \"{{ json . }}\""
};
var table = D.createTable(
    "Docker images",
    [
        { label: "Latest Tag" },
        { label: "Latest Image ID" },
        { label: "Latest Image Created Since" },
        { label: "Latest Image Created Date" },
        { label: "Latest Image Size", unit: "kB" },
        { label: "Total Images Size", unit: "kB" },
        { label: "Total number of Images" },
    ]
);

function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 2) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
 * 
 * @returns Promise wait for docker images result
 */
function getDockerImages() {
    var d = D.q.defer();
    D.device.sendSSHCommand(ssh_config, function (out, err) {
        if (err) checkSshError(err);
        var images = out.split("\n").map(function (json_string) {
            return JSON.parse(json_string);
        });
        d.resolve(images);
    });

    return d.promise;
}

/**
 * 
 * @param {string} value 
 * @returns convert value to KB
 */
function convertToKB(value) {
    if (!value || value === "N/A") return null;
    var val = value.substring(0, value.length - 2);
    var unit = value.substring(value.length - 2, value.length);
    switch (unit.toLowerCase()) {
    case "mb": return val * 1000;
    case "gb": return val * 1000000;
    default: return val;
    }
}

/**
 * 
 * @param {[object]} jsonImages list of docker images
 * @returns docker images grouped by repository
 */
function groupImagesByRepository(jsonImages) {
    return jsonImages
        .map(function (image) {
            // parsing creation date
            var dateMatch = image.CreatedAt.match(/^(....)-(..)-(..) (..):(..):(..).*$/);
            var date = new Date();
            date.setFullYear(dateMatch[1], dateMatch[2], dateMatch[3]);
            date.setHours(dateMatch[4], dateMatch[5], dateMatch[6]);
            image.createAtTimestamp = date.getTime();
            image.sizeKb = convertToKB(image.Size);
            return image;
        })
        .sort(function (a, b) {
            return b.createAtTimestamp - a.createAtTimestamp;
        })
        .reduce(function (a, b) {
            var val = a[b.Repository] || [];
            val.push(b);
            a[b.Repository] = val;
            return a;
        }, {});

}


/**
 * fill monitoring table with data related to docker 
 * %Id: the repository
 * %Latest Tag
 * %Latest Image ID
 * %Latest Image Created Since
 * %Latest Image Created Date
 * %Latest Image Size
 * %Total Images Size
 * %Total number of Images
 * @param {[string]} images 
 */
function fillTable(images) {
    Object.keys(images).forEach(function (repository) {
        var image = images[repository][0];
        var totalSize = images[repository].reduce(function (a, b) { return a + b.sizeKb; }, 0);
        table.insertRecord(repository, [
            image.Tag,
            image.ID,
            image.CreatedSince,
            image.CreatedAt,
            image.sizeKb,
            totalSize,
            images[repository].length,
        ]);
    });
    D.success(table);
}

function failure(err) {
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if docker server is reachable and the ssh command is running successfully
*/
function validate() {
    getDockerImages()
        .then(function () { D.success(); })
        .catch(failure);
}


/**
* @remote_procedure
* @label Get docker process info
* @documentation This procedure is used for retrieving docker images and generate a table containing different information about the images
*/
function get_status() {
    getDockerImages()
        .then(groupImagesByRepository)
        .then(fillTable)
        .catch(failure);
}