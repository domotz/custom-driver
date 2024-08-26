/**
 * Domotz Custom Driver 
 * Name: Sonicwall - Failover Load Balancing Groups
 * Description: Monitors Sonicwall failover load balancing groups. 
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on SonicWALL TZ370W
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Group Name: failover group name
 *      - Member Name: failover group member name
 *      - IP Address
 *      - Link Status
 *      - Load balancing status
 *      - Probe status
 *      - Main target status
 *      - Alternate target status
 **/

var sonicWallAPIPort = 443;

var table = D.createTable(
    "Failover Load Balancing Groups", [
        { label: "Group Name" },
        { label: "Member Name" },
        { label: "Link Status" },
        { label: "LB Status" },
        { label: "Probe Status" },
        { label: "Main Target Status" },
        { label: "Alternate Target Status" }
    ]
);

//Processes the HTTP response and handles errors
function processResponse(d) {
    return function process(error, response, body) {
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        if (response.statusCode == 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(body);
    };
}

/**
 * Logs in to the SonicWALL device using basic authentication.
 * @returns A promise that resolves on successful login.
 */
function login() {
    var d = D.q.defer();
    var config = {
        url: "/api/sonicos/auth",
        username: D.device.username(),
        password: D.device.password(),
        port: sonicWallAPIPort,
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    };
    D.device.http.post(config, processResponse(d));
    return d.promise;
}

//Retrieves failover load balanging groups from the SonicWALL device
function getFailoverLBgroups() {
    var d = D.q.defer();
    var config = {
        url: "/api/sonicos/reporting/failover-lb/status/members",
        protocol: "https",
        port: sonicWallAPIPort,
        jar: true,
        rejectUnauthorized: false
    };
    D.device.http.get(config, processResponse(d));
    return d.promise;
}

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

//Extracts data from the HTTP response and populates the custom table.
function extractData(body) {
    var data = JSON.parse(body);
    console.info(JSON.stringify(data));
    data.forEach(function (item) {
            var groupName = item.group_name;
            var memberName = item.member_name;
            var recordId = sanitize(groupName ? memberName + groupName : memberName);
            var linkstatus = item.link_status;
            var lbstatus = item.lb_status;
            var probestatus = item.probe_status;
            var maintargetstatus = item.main_target_status;
            var alternatetargetstatus = item.alternate_target_status;

            table.insertRecord(recordId, [
                groupName,
                memberName,
                linkstatus,
                lbstatus,
                probestatus,
                maintargetstatus,
                alternatetargetstatus
            ]);
    });

    D.success(table);
}

/**
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the SonicWALL device.
 */
function validate(){
    login()
        .then(getFailoverLBgroups)
        .then(function (response) {
            if (response) {
                console.info("Data available");
                D.success();
            } else {
                console.error("No data available");
                D.failure(D.errorType.GENERIC_ERROR);
            }
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get Failover Load Balancing Groups
 * @documentation This procedure is used to retrieve Failover Load Balancing Groups from the SonicWALL firewall and populate the custom table.
 */
function get_status() {
    login()
        .then(getFailoverLBgroups)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}