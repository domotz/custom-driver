var httpOptions = {
    protocol: 'https',
    jar: true,
    rejectUnauthorized: false,
    url: '/api/edge/data.json?data=dhcp_leases'
}
var loginBody = 'username=' + D.device.username() + '&password=' + D.device.password();
var httpLoginOptions = {
    protocol: 'https',
    rejectUnauthorized: false,
    url: '/',
    body: loginBody,
    jar: true,
}

function cb (error, response, body){
    console.info("Response Code", response.statusCode);
    console.debug("Body", body);
    var jsonBody = JSON.parse(body);
    var leases = jsonBody.output["dhcp-server-leases"]["HomeRouter"]
    var variables = []
    for (var key in leases) {
        var deviceMac = leases[key].mac;
        var uid = deviceMac.replace(/:/g, '');
        var label = key;
        var value = leases[key]['expiration'];
        var variable = D.device.createVariable(
            uid,
            label,
            value,
            "date"
        );
        variables.push(variable);
    }
    D.success(variables);
}
function cbLogin(error, response, body){
    console.debug("Login Response Code", response.statusCode);
    console.debug("Login Response Headers", response.headers);
    D.device.http.get(httpOptions, cb)
}
/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate(){
    D.success()
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status(){
    D.device.http.post(httpLoginOptions, cbLogin)
}