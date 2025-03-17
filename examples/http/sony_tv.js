const TV_STATUS_OFF = "standby";
const TV_STATUS_ON = "on";

var videoSource;
var tvStatus;

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/function validate(){
    retrieveStatus()
    .then(function(){ D.success()})
    .catch(function(){ D.failure(D.errorType.GENERIC_ERROR) });    
} 

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/function get_status(){
    retrieveStatus()
    .then(applyScheduling)
    .then(retrieveStatus)
    .then(retrieveVideoSource)    
    .then(publishStatus)
    .catch(function(){ D.failure(D.errorType.GENERIC_ERROR) });
}


function retrieveStatus() {
    var d = D.q.defer();    

    const httpConfig = createBaseHTTPConfig();
    httpConfig.url = "/sony/system";
    httpConfig.body = "{" +
                    "\"method\": \"getPowerStatus\"," +
                    "\"params\": [{}],"+
                    "\"id\": 1," +
                    "\"version\": \"1.0\""+
                    "}";

    D.device.http.post(httpConfig, function (err, response, body) {
        checkHttpError(err, response, body);
        var responseAsJSON = JSON.parse(body);

        tvStatus = responseAsJSON.result[0].status

        d.resolve();
    });
    
    return d.promise;    
}

function retrieveVideoSource() {
    var d = D.q.defer();    

    const httpConfig = createBaseHTTPConfig()
    httpConfig.url = "/sony/avContent";    
    httpConfig.body = "{" +
                    "\"method\": \"getPlayingContentInfo\"," +
                    "\"params\": [{}],"+
                    "\"id\": 1," +
                    "\"version\": \"1.0\""+
                    "}"

    D.device.http.post(httpConfig, function (err, response, body) {
        checkHttpError(err, response, body);
        var responseAsJSON = JSON.parse(body);
        
        if (responseAsJSON.hasOwnProperty('error'))
            videoSource = "N/A"
        else
            videoSource = extractVideoSource(responseAsJSON)

        d.resolve();
    });
    
    return d.promise;    
}

function extractVideoSource(jsonData) {
    let videoSource = "N/A";

    if (jsonData.result && jsonData.result.length > 0 && jsonData.result[0].source) {
        const source = jsonData.result[0].source.toUpperCase();
        if (source.includes("TV"))
            videoSource = source;
        else if (jsonData.result[0].title)
            videoSource = jsonData.result[0].title.toUpperCase();
    } 

    return videoSource;
}

function applyScheduling(status) {
    const now = new Date();
    const currentTime = extractTimeInMinutesFromMidnight(now)
    const currentDay = extractDayOfTheWeek(now)
    const currentDate = extractDate(now)
    
    console.info("Scheduled start-time: " + startTime)
    console.info("Scheduled end-time: " + endTime)
    console.info("Scheduled days: " + weekDays)    
    console.info("Exluded days: " + weekDaysToExclude)    

    console.info("Now: " + currentDate)
    console.info("Day: " + currentDay)
    console.info("Time: " + currentTime)

    if (status == TV_STATUS_OFF)
        return turnOnIfSchedulingIsMatched(currentDate, currentDay, currentTime)
    else (status == TV_STATUS_ON)
        return turnOffIfSchedulingIsNotMatched(currentDate, currentDay, currentTime)
 
}

function turnOnIfSchedulingIsMatched(currentDate, currentDay, currentTime) {
    if (weekDays.includes(currentDay) && currentTime >= startTime && currentTime <= endTime && !weekDaysToExclude.includes(currentDate)) 
        return turnOn();
}

function turnOffIfSchedulingIsNotMatched(currentDate, currentDay, currentTime) {
    if (!weekDays.includes(currentDay) || currentTime < startTime || currentTime > endTime || weekDaysToExclude.includes(currentDate)) 
        return turnOff();
}

function turnOn() {
    var d = D.q.defer();    

    const httpConfig = createBaseHTTPConfig()
    httpConfig.url = "/sony/system";
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

function turnOff() {
    var d = D.q.defer();    

    const httpConfig = createBaseHTTPConfig()
    httpConfig.url = "/sony/system";    
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
        D.createVariable("status", "Status", tvStatus ),
        D.createVariable("video-source", "Video Source", videoSource ),        
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
    turnOn()
    .then(function(){ D.success() })
    .catch(function(){ D.failure(D.errorType.GENERIC_ERROR) });
}

/**
* @remote_procedure
* @label Off
* @documentation Turn TV Off
*/
function custom_2(){
    turnOff()
    .then(function(){ D.success() })
    .catch(function(){ D.failure(D.errorType.GENERIC_ERROR) });
}

function getDayName(dayIndex) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[dayIndex];
}

function extractTimeInMinutesFromMidnight(now) {
    return currentTimeMinutes = now.getHours() * 60 + now.getMinutes()
}

function extractDayOfTheWeek(now) {
    return getDayName(now.getDay())
}

function extractDate(now) {
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    
    return month+"/"+day+"/"+year
}

function timeToMinutes(time) {
    var timeParts = time.split(":");
    var hour = parseInt(timeParts[0], 10);
    var minute = parseInt(timeParts[1], 10);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) 
        throw "Invalid time parameter: " + time

    return hour * 60 + minute;
}

function validateDays(days) {
    days.forEach(validateDateString)    
}

function validateDateString(dateString) {
    const datePattern = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/;

    if (!datePattern.test(dateString)) {
        throw "Invalid date format: " + dateString + ". Expected format: MM/DD/YYYY";
    }

    const dateParts = dateString.split("/");
    const month = dateParts[1];
    const day = dateParts[1];
    const year = dateParts[2];

    const dateObject = new Date(year, month - 1, day);

    if (
        dateObject.getFullYear() !== year ||
        dateObject.getMonth() !== month - 1 ||
        dateObject.getDate() !== day
    )        
        throw "Invalid date value: " + dateString + ". Day does not exist for given month";
}

/**
 * @description SonyPreSharedKey
 * @type SECRET_TEXT 
 */
var sonyPreSharedKey = "10051973" //D.getParameter('SonyPreSharedKey');

/**
 * @description startTime
 * @type STRING 
 */
var startTime = timeToMinutes("08:00") // D.getParameter('startTime');

/**
 * @description endTime
 * @type STRING 
 */
var endTime = timeToMinutes("23:59") // D.getParameter('endTime');

/**
 * @description weekDays
 * @type LIST 
 */
var weekDays =  ["Monday", "Tuesday", "Wednesday", "Thursday","Friday", "Saturday","Sunday"] //D.getParameter('weekDays');

/**
 * @description weekDaysToExclude
 * @type LIST 
 */
var weekDaysToExclude = validateDays(["02/31/2025", "05/10/2025"]) // D.getParameter('weekDaysToExclude');