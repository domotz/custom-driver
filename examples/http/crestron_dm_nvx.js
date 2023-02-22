var options = {
    protocol: "https",
    jar: true,
    rejectUnauthorized: false,
};

function get() {
    var d = D.q.defer();
    var config = ({
        url: "/Device/DeviceInfo",
    }, options);
    D.device.http.get(config, function (error, response, body) {
        if (response.statusCode && response.statusCode === 200 && body) {
            console.log(body);
        }
        d.resolve(body);
    });
    return d.promise;
}

function post() {
    var d = D.q.defer();
    var url = "/userlogin.html";
    var config = ({
        url: url,
        form: {
            login: D.device.username(),
            passwd: D.device.password(),
        },
        headers: {
            //"Cookie": "TRACKID=c7ee18f24c509bac5bfe9d13828a6ae87356049228ae05d86fd4b93a0ef96ac8",
            "Origin": D.device.ip(),
            "Referer": D.device.ip() + url
        },
        body: "username=" + D.device.username() + "&&passwd=" + D.device.password(),
    }, options);
    D.device.http.post(config, function (err, response, body) {
        if (err) {
            console.error(err);
            return D.failure();
        }
        if (response.statusCode === 302 && (response.headers["location"] === "/"))
            d.resolve(body);
    });
    return d.promise;
}


function validate() {
    post()
        .then(get)
        .then(function () {
            D.success();
        });
}

function get_status() {
    post()
        .then(get)
        .then(function () {
            D.success();
        })
        .catch(failure);

}