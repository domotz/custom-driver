var _var = D.device.createVariable;
/**
 * This Driver collects status and daily statistics information for pi-hole https://pi-hole.net/
 * Communication protocol is HTTP.
 * Creates a four custom driver variables.
 */
var httpOptions = {
    url: '/admin/api.php?' +
        'getCacheInfo' +
        '&summary' +
        '&auth=' + D.device.password()
}

function validateHttpResponse(error, response) {
    var errorMessage = null;
    if (error) {
        console.error(error);
        errorMessage = D.errorType.RESOURCE_UNAVAILABLE;
    }
    if (response.statusCode === 401 || response.statusCode === 403) {
        errorMessage = D.errorType.AUTHENTICATION_ERROR;
    } else if (response.statusCode >= 400) {
        errorMessage = D.errorType.GENERIC_ERROR;
    }
    if (errorMessage) {
        D.failure(error);
    }
}

function createVariables(data) {
    var variables = []
    variables.push(
        _var('status', "Status", data.status)
    )
    variables.push(
        _var('blocked_daily_perc', "Blocked Daily %", parseFloat(data.ads_percentage_today) + '', unit = '%')
    )
    variables.push(
        _var('blocked_daily', "Blocked Daily", parseInt(data.ads_blocked_today.replace(/,/g, '')) + '')
    )
    variables.push(
        _var('daily_total', "Daily Total Queries", parseInt(data.dns_queries_all_types.replace(/,/g, '')) + '')
    )
    var relative = data.gravity_last_updated.relative
    if (relative) {
        variables.push(
            _var('db_update_since', "Days since last DB update",
                relative.days + relative.hours/24,  '', 'days'
            )
        )
    }

    return variables
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation Performs validations by executing http call towards the known API
 */
function validate() {
    D.device.http.get(httpOptions, function (error, response, body) {
        validateHttpResponse(error, response)
        var res = JSON.parse(body)

        D.success(createVariables(res))
    });
}


/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation Creates Variables for Status, Daily blocked percentage, Daily Blocked number and Daily Total Queries.
 */
function get_status() {
    D.device.http.get(httpOptions, function (error, response, body) {
        validateHttpResponse(error, response)
        var res = JSON.parse(body)

        D.success(createVariables(res))
    });
}