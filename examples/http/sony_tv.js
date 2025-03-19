/**
 * Domotz Custom Driver
 * Name: Sony TV status
 * Description: This script monitors and controls the power status of a Sony TV. It supports scheduling based on specific days and time ranges, with the ability to exclude certain dates.
 *
 * Communication protocol is HTTP
 *
 * Tested on Sony TV FW-50BU35J
 *
 * Creates a custom driver variables:
 *       - Status: The current power state of the TV
 *       - Video Source: The video input being used on the TV
 *
 * Create a custom actions:
 *       - On: Turns the TV on
 *       - Off: Turns the TV off
 *
 **/

const TV_STATUS_OFF = "standby"
const TV_STATUS_ON = "on"
const DAYS_OF_THE_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

let videoSource = "N/A"
let tvStatus

/**
 * @description Pre-Shared Key for Sony API authentication
 * @type SECRET_TEXT
 */
const sonyPreSharedKey = D.getParameter('sonyPreSharedKey')

/**
 * @description Start time for TV operation (HH:MM format)
 * @type STRING
 */
const startTime = D.getParameter('startTime')

/**
 * @description End time for TV operation (HH:MM format)
 * @type STRING
 */
const endTime = D.getParameter('endTime')

/**
 * @description Days of the week when the TV should be active
 * @type LIST
 */
const weekDays = D.getParameter('weekDays')

/**
 * @description Dates to exclude from the scheduling
 * @type LIST
 */
const datesToExclude = D.getParameter('datesToExclude')

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate(){
    retrieveStatus()
        .then(function(){ D.success()})
        .catch(failure)
}

/**
 * @remote_procedure
 * @label Get sony TV power status
 * @documentation This procedure is used to retrieves and publishes the TV power status and video source
 */
function get_status(){
    retrieveStatus()
        .then(applyScheduling)
        .then(retrieveStatus)
        .then(retrieveVideoSource)
        .then(publishStatus)
        .catch(failure)
}

/**
 * Retrieves the current power status of the TV
 * @returns {Promise} Resolves when the status is retrieved
 */
function retrieveStatus() {
    const d = D.q.defer()

    const httpConfig = createBaseHTTPConfig()
    httpConfig.url = "/sony/system"
    httpConfig.body = JSON.stringify({
        method: "getPowerStatus",
        params: [{}],
        id: 1,
        version: "1.0"
    })
    D.device.http.post(httpConfig, function (err, response, body) {
        checkHttpError(err, response, body)
        const responseAsJSON = JSON.parse(body)
        tvStatus = responseAsJSON.result[0].status
        d.resolve()
    })
    return d.promise
}

/**
 * Retrieves the video source of the TV
 * @returns {Promise} Resolves when the video source is retrieved
 */
function retrieveVideoSource() {
    const d = D.q.defer()

    const httpConfig = createBaseHTTPConfig()
    httpConfig.url = "/sony/avContent"
    httpConfig.body = JSON.stringify({
        method: "getPlayingContentInfo",
        params: [{}],
        id: 1,
        version: "1.0"
    })
    D.device.http.post(httpConfig, function (err, response, body) {
        checkHttpError(err, response, body)
        const responseAsJSON = JSON.parse(body)

        if (!responseAsJSON.hasOwnProperty('error'))
            videoSource = extractVideoSource(responseAsJSON)
        d.resolve()
    })
    return d.promise
}

/**
 * Extracts the video source from JSON response data
 * @param {Object} jsonData The response JSON data
 * @returns {string} The extracted video source
 */
function extractVideoSource(jsonData) {
    let videoSource = "N/A"
    if (jsonData.result && jsonData.result.length > 0 && jsonData.result[0].source) {
        const source = jsonData.result[0].source.toUpperCase()
        if (source.includes("TV"))
            videoSource = source
        else if (jsonData.result[0].title)
            videoSource = jsonData.result[0].title.toUpperCase()
    }
    return videoSource
}

/**
 * Applies scheduling logic to determine if the TV should be turned on or off.
 * It checks the current date and time against the specified schedule, including start time, end time, and excluded dates.
 */
function applyScheduling() {
    console.info("dates To Exclude:", datesToExclude)
    validateDates(datesToExclude)
    validateWeekDays(weekDays)

    const now = new Date()
    const currentTime = extractTimeInMinutesFromMidnight(now)
    const currentDay = extractDayOfTheWeek(now)
    const currentDate = extractDate(now)

    const startTimeInMinutes = timeToMinutes(startTime)
    const endTimeInMinutes = timeToMinutes(endTime)

    if (tvStatus === TV_STATUS_OFF)
        return turnOnIfSchedulingIsMatched(currentDate, currentDay, currentTime, startTimeInMinutes, endTimeInMinutes)
    else if(tvStatus === TV_STATUS_ON)
        return turnOffIfSchedulingIsNotMatched(currentDate, currentDay, currentTime, startTimeInMinutes, endTimeInMinutes)
}

/**
 * Checks if the current date and time match the scheduling conditions to turn on the TV.
 * If the current day is in the allowed weekDays list, the time is within rang and the date is not in the exclusion list, the TV is turned on.
 * @param {string} currentDate The current date in MM/DD/YYYY format
 * @param {string} currentDay The current day of the week
 * @param {number} currentTime The current time in minutes since midnight
 * @param {number} startTimeInMinutes The start time in minutes since midnight
 * @param {number} endTimeInMinutes The end time in minutes since midnight
 * @returns {Promise|undefined} A promise that resolves when the TV is turned on, or undefined if conditions are not met
 */
function turnOnIfSchedulingIsMatched(currentDate, currentDay, currentTime, startTimeInMinutes, endTimeInMinutes) {
    if (weekDays.includes(currentDay) && currentTime >= startTimeInMinutes && currentTime <= endTimeInMinutes && !datesToExclude.includes(currentDate))
        return turnOn()
}

/**
 * Checks if the current date and time do not match the scheduling conditions,
 * and turns off the TV if necessary. If the current day is not in the weekDays list,
 * the time is out of range, or the date is in the exclusion list, the TV is turned off
 * @param {string} currentDate The current date in MM/DD/YYYY format
 * @param {string} currentDay The current day of the week
 * @param {number} currentTime The current time in minutes since midnight
 * @param {number} startTimeInMinutes The start time in minutes since midnight
 * @param {number} endTimeInMinutes The end time in minutes since midnight
 * @returns {Promise|undefined} A promise that resolves when the TV is turned off, or undefined if conditions are not met
 */
function turnOffIfSchedulingIsNotMatched(currentDate, currentDay, currentTime, startTimeInMinutes, endTimeInMinutes) {
    if (!weekDays.includes(currentDay) || currentTime < startTimeInMinutes || currentTime > endTimeInMinutes || datesToExclude.includes(currentDate))
        return turnOff()
}

/**
 * Sends an HTTP request to turn on the TV using the Sony API
 * @returns {Promise} Resolves when the TV is successfully turned on
 */
function turnOn() {
    const d = D.q.defer()

    const httpConfig = createBaseHTTPConfig()
    httpConfig.url = "/sony/system"
    httpConfig.body = JSON.stringify({
        method: "setPowerStatus",
        params: [{ status: true }],
        id: 1,
        version: "1.0"
    })
    D.device.http.post(httpConfig, function (err, response, body) {
        checkHttpError(err, response, body)
        d.resolve()
    })
    return d.promise
}

/**
 * Sends an HTTP request to turn off the TV using the Sony API
 * @returns {Promise} Resolves when the TV is successfully turned off
 */
function turnOff() {
    const d = D.q.defer()

    const httpConfig = createBaseHTTPConfig()
    httpConfig.url = "/sony/system"
    httpConfig.body = JSON.stringify({
        method: "setPowerStatus",
        params: [{ status: false }],
        id: 1,
        version: "1.0"
    })
    D.device.http.post(httpConfig, function (err, response, body) {
        checkHttpError(err, response, body)
        d.resolve()
    })
    return d.promise
}

/**
 * Publishes the TV status and video source as device variables
 */
function publishStatus(){
    D.success([
        D.createVariable("status", "Status", tvStatus ),
        D.createVariable("video-source", "Video Source", videoSource )
    ])
}

/**
 * Handles HTTP errors and fails the process if an error is encountered
 * @param {object} err The error object returned from the HTTP request
 * @param {object} response The HTTP response object
 * @param {string} body The response body
 */
function checkHttpError(err, response, body) {
    if (err) {
        console.error(err)
        D.failure(D.errorType.GENERIC_ERROR)
    }
    if (response.statusCode === 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    }
    if (response.statusCode === 401 || response.statusCode === 403) {
        D.failure(D.errorType.AUTHENTICATION_ERROR)
    }
    if (response.statusCode !== 200 && response.statusCode !== 202 && response.statusCode !== 204) {
        console.error(body)
        D.failure(D.errorType.GENERIC_ERROR)
    }
}

/**
 * Creates a base HTTP configuration object with required headers
 * @returns {object} HTTP configuration object
 */
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
        .catch(failure)
}

/**
 * @remote_procedure
 * @label Off
 * @documentation Turn TV Off
 */
function custom_2(){
    turnOff()
        .then(function(){ D.success() })
        .catch(failure)
}

/**
 * Extracts the time in minutes from midnight for the given Date object
 * @param {Date} now The Date object to extract time from
 * @returns {number} The time in minutes since midnight
 */
function extractTimeInMinutesFromMidnight(now) {
    return now.getHours() * 60 + now.getMinutes()
}

/**
 * Extracts the day of the week from a given Date object
 * @param {Date} now The Date object to extract the day from
 * @returns {string} The day of the week
 */
function extractDayOfTheWeek(now) {
    return DAYS_OF_THE_WEEK[now.getDay()]
}

/**
 * Extracts the date in MM/DD/YYYY format from a given Date object
 * @param {Date} now The Date object to extract the date from
 * @returns {string} The date in MM/DD/YYYY format
 */
function extractDate(now) {
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const year = now.getFullYear()

    return month+"/"+day+"/"+year
}

/**
 * Converts a time string in HH:MM format to minutes
 * @param {string} time The time string in HH:MM format
 * @returns {number} The time in minutes
 */
function timeToMinutes(time) {
    const timeParts = time.split(":")
    const hour = parseInt(timeParts[0], 10)
    const minute = parseInt(timeParts[1], 10)

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59)
        throw "Invalid time parameter: " + time

    return hour * 60 + minute
}

/**
 * Validates an array of date strings
 * @param {Array} dates An array of date strings to validate
 */
function validateDates(dates) {
    dates.forEach(validateDate)
}

/**
 * Validates a single date string
 * @param {string} dateString The date string to validate in MM/DD/YYYY format
 */
function validateDate(dateString) {
    const datePattern = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/

    if (!datePattern.test(dateString))

        throw "Invalid date format: " + dateString + ". Expected format: MM/DD/YYYY"
}

/**
 * Validates an array of weekdays to ensure they are valid days of the week
 * @param {Array} daysOfTheWeek An array of days to validate
 */
function validateWeekDays(daysOfTheWeek) {
    daysOfTheWeek.forEach(function(day) {
        if (!DAYS_OF_THE_WEEK.includes(day))
            throw "Invalid day: "+ day
    })
}

/**
 * Handles failures by logging the error and triggering a failure response
 * @param {string} err The error message to log and handle
 */
function failure(err) {
    console.error(err)
    D.failure(D.errorType.GENERIC_ERROR)
}