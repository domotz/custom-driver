
/**
 * This driver extracts docker images information
 * The communication protocol is SSH
 * This driver show a table with images details:
 * -------------------------------
 * %Id
 * %Repository
 * %Created At
 * %Created Since
 * %Digest
 * %Shared Size
 * %Size
 * %Tag
 * %Unique Size
 * %Virtual Size
 * %Containers
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
        { label: "Repository" },
        { label: "Created At" },
        { label: "Created Since" },
        { label: "Digest" },
        { label: "Shared Size", unit: "kB" },
        { label: "Size", unit: "kB" },
        { label: "Tag" },
        { label: "Unique Size", unit: "kB" },
        { label: "Virtual Size", unit: "kB" },
        { label: "Containers" },
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
 * fill monitoring table with data related to docker images
 * @param {[string]} images 
 */
function fillTable(images) {
    images.forEach(function (image) {
        table.insertRecord(image.ID, [
            image.Repository,
            image.CreatedAt,
            image.CreatedSince,
            image.Digest,
            convertToKB(image.SharedSize),
            convertToKB(image.Size),
            image.Tag,
            convertToKB(image.UniqueSize),
            convertToKB(image.VirtualSize),
            image.Containers
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
        .then(fillTable)
        .catch(failure);
}