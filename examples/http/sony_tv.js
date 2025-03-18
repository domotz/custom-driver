const TV_STATUS_OFF = "standby";
const TV_STATUS_ON = "on";
const DAYS_OF_THE_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

var videoSource = "N/A"
var tvStatus;

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/function validate(){
    retrieveStatus()
    .then(function(){ D.success()})
    .catch(failure);    
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
    .catch(failure);
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
        
        if (!responseAsJSON.hasOwnProperty('error'))
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

function applyScheduling() {
    console.info(datesToExclude)
    
    validateDates(datesToExclude);
    validateWeekDays(weekDays);

    const now = new Date();
    const currentTime = extractTimeInMinutesFromMidnight(now)
    const currentDay = extractDayOfTheWeek(now)
    const currentDate = extractDate(now)
    
    const startTimeInMinutes = timeToMinutes(startTime);
    const endTimeInMinutes = timeToMinutes(endTime)

    if (tvStatus == TV_STATUS_OFF)
        return turnOnIfSchedulingIsMatched(currentDate, currentDay, currentTime, startTimeInMinutes, endTimeInMinutes)
    else (tvStatus == TV_STATUS_ON)
        return turnOffIfSchedulingIsNotMatched(currentDate, currentDay, currentTime, startTimeInMinutes, endTimeInMinutes)
 
}

function turnOnIfSchedulingIsMatched(currentDate, currentDay, currentTime, startTimeInMinutes, endTimeInMinutes) {
    if (weekDays.includes(currentDay) && currentTime >= startTimeInMinutes && currentTime <= endTimeInMinutes && !datesToExclude.includes(currentDate)) 
        return turnOn();
}

function turnOffIfSchedulingIsNotMatched(currentDate, currentDay, currentTime, startTimeInMinutes, endTimeInMinutes) {
    if (!weekDays.includes(currentDay) || currentTime < startTimeInMinutes || currentTime > endTimeInMinutes || datesToExclude.includes(currentDate)) 
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
    .catch(failure);
}

/**
* @remote_procedure
* @label Off
* @documentation Turn TV Off
*/
function custom_2(){
    turnOff()
    .then(function(){ D.success() })
    .catch(failure);
}

function extractTimeInMinutesFromMidnight(now) {
    return currentTimeMinutes = now.getHours() * 60 + now.getMinutes()
}

function extractDayOfTheWeek(now) {
    return DAYS_OF_THE_WEEK[now.getDay()]
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

function validateDates(dates) {
    dates.forEach(validateDate)    
}

function validateDate(dateString) {
    const datePattern = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/;

    if (!datePattern.test(dateString))
        throw "Invalid date format: " + dateString + ". Expected format: MM/DD/YYYY";
}

function validateWeekDays(daysOfTheWeek)
{
    daysOfTheWeek.forEach(function(day) {
        if (!DAYS_OF_THE_WEEK.includes(day))
            throw "Invalid day: "+ day 
    });
}

function failure(err) {
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}
