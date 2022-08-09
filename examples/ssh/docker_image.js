
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

function get_docker_images() {
    var d = D.q.defer();
    D.device.sendSSHCommand(ssh_config, function (res, err) {
        if (err) {
            console.error(err);
            D.failure();
        }
        var images = res.split("\n").map(function (json_string) {
            return JSON.parse(json_string);
        });
        d.resolve(images);
    });

    return d.promise;
}

function convert_to_kB(value) {
    if (!value || value === "N/A") return null;
    var val = value.substring(0, value.length - 2);
    var unit = value.substring(value.length - 2, value.length);
    switch (unit.toLowerCase()) {
    case "mb": return val * 1000;
    case "gb": return val * 1000000;
    default: return val;
    }
}

function fill_table(images) {
    images.forEach(function (image) {
        table.insertRecord(image.ID, [
            image.Repository,
            image.CreatedAt,
            image.CreatedSince,
            image.Digest,
            convert_to_kB(image.SharedSize),
            convert_to_kB(image.Size),
            image.Tag,
            convert_to_kB(image.UniqueSize),
            convert_to_kB(image.VirtualSize),
            image.Containers
        ]);
    });
    D.success(table);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    D.success();
}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    get_docker_images()
        .then(fill_table)
        .catch(console.error);
}