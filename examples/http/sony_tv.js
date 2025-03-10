/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/function validate(){
    retrieveTVStatus()
    .then(function(){ D.success()})
    .catch(function(){ D.failure(D.errorType.GENERIC_ERROR) });    
} 

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/function get_status(){
    retrieveTVStatus()
    .then(publishStatus)
    .catch(function(){ D.failure(D.errorType.GENERIC_ERROR) });
}


function retrieveTVStatus() {
    var d = D.q.defer();    

    const httpConfig = createBaseHTTPConfig()
    httpConfig.body = "{" +
                    "\"method\": \"getPowerStatus\"," +
                    "\"params\": [{}],"+
                    "\"id\": 1," +
                    "\"version\": \"1.0\""+
                    "}"

    D.device.http.post(httpConfig, function (err, response, body) {
        checkHttpError(err, response, body);
        var responseAsJSON = JSON.parse(body);

        d.resolve(responseAsJSON.result[0].status);
    });
    
    return d.promise;    
}

function turnOnTV() {
    var d = D.q.defer();    

    const httpConfig = createBaseHTTPConfig()
    httpConfig.body = "{" +
                    "\"method\": \"setPowerStatus\"," +
                    "\"params\": [{ \"status\": true }],"+
                    "\"id\": 1," +
                    "\"version\": \"1.0\""+
                    "}"

    D.device.http.post(httpConfig, function (err, response, body) {
        checkHttpError(err, response, body);
        d.resolve();
    });
    
    return d.promise;    
}

function turnOffTV() {
    var d = D.q.defer();    

    const httpConfig = createBaseHTTPConfig()
    httpConfig.body = "{" +
                    "\"method\": \"setPowerStatus\"," +
                    "\"params\": [{ \"status\": false }],"+
                    "\"id\": 1," +
                    "\"version\": \"1.0\""+
                    "}"

    D.device.http.post(httpConfig, function (err, response, body) {
        checkHttpError(err, response, body);
        d.resolve();
    });
    
    return d.promise;    
}

function publishStatus(status)
{
    var variables = [    
        D.createVariable("status", "Status", status ),
    ];
    
    D.success(variables);
}

function checkHttpError(err, response, body) {
        console.info(body);
        if (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        if (response.statusCode === 401 || response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        if (response.statusCode != 200 && response.statusCode != 202 && response.statusCode != 204) {
            console.error(body);
            D.failure(D.errorType.GENERIC_ERROR);
        }
}

function createBaseHTTPConfig() {
    return {
        url: "/sony/system",
        headers: {
            "Content-Type": "application/json",
            "X-Auth-PSK": sonyPreSharedKey
        }
    }
}
/**
* @remote_procedure
* @label On
* @documentation Turn TV On
*/
function custom_1(){
    turnOnTV()
    .then(function(){ D.success() })
    .catch(function(){ D.failure(D.errorType.GENERIC_ERROR) });
}

/**
* @remote_procedure
* @label Off
* @documentation Turn TV Off
*/
function custom_2(){
    turnOffTV()
    .then(function(){ D.success() })
    .catch(function(){ D.failure(D.errorType.GENERIC_ERROR) });
}

