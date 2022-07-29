
var _var = D.device.createVariable;

var server_name = "192.168.1.55";
var server_port = "443";
var cert_detail_cmd = [
    "cert=$(echo | openssl s_client -connect " + server_name + ":" + server_port + ")",
    "echo \"$cert\" | grep -i \"Verify return code\"",
    "echo \"$cert\" | openssl x509 -noout -issuer",
    "echo \"$cert\" | openssl x509 -noout -enddate",
    "echo \"$cert\" | openssl x509 -noout -checkend 0 | echo $?"
];
var ssh_config = {
    username: D.device.username(),
    password: D.device.password(),
    port: 27123,
    timeout: 5000,
    command: cert_detail_cmd.join(";")
};

function get_certificate() {
    var d = D.q.defer();

    D.device.sendSSHCommand(ssh_config, function (out, err) {
        if (err) {
            console.error("error while executing command: " + command);
            console.error(err);
            D.failure();
        }
        d.resolve(out.split("\n"));
    });
    return d.promise;
}

function extract_data(lines) {
    var status_message = lines[0].match(/^Verify return code: (\d+) \((.*)\)$/i);
    var status = status_message[1];
    var message = status_message[2];
    var issuer = lines[1].match(/^.*O = ([^,]*).*$/)[1];
    var expiry_date = lines[2].match(/^notAfter=(.*)$/)[1];
    var expired = !!parseInt(lines[3]);
    return [
        _var("cert_valid", "Is valid", status == 0),
        _var("cert_status", "Status", message),
        _var("cert_issuer", "Issued by", issuer),
        _var("cert_expiry_date", "Expires", expiry_date),
        _var("cert_expired", "Is expired", expired)
    ];
}

function execute(callback) {

    get_certificate()
        .then(extract_data)
        .then(callback).catch(function (err) {
            console.error(err);
            D.failure();
        });
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    execute(function (result) {
        D.success(result);
    });
}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    execute(function (result) {
        D.success(result);
    });
}