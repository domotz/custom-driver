/**
 * Domotz Custom Driver
 * Name: Samsung TV status
 * Description: This script monitors and controls the power status of a Samsung TV. It supports scheduling based on specific days and time ranges, with the ability to exclude certain dates.
 *
 * Communication protocol is via Socket TCP/IP using a custom protocol Samsung MDC.
 *
 * Tested on Samsung TV QB43R
 *
 * Creates a custom driver variables:
 *       - Status: The current power state of the TV
 *       - Video Source: The video input being used on the TV
 *
 **/

const POWER_DELAY = 10000;
const TV_STATUS_OFF = 'Standby';
const TV_STATUS_ON = 'On';

const DAYS_OF_THE_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TV_STATUSES = {
    '00': TV_STATUS_OFF, '01': TV_STATUS_ON,
};
const INPUT_SOURCES = {
    '04': 'S-Video',
    '08': 'Component',
    '0c': 'AV1 (AV)',
    '0d': 'AV2',
    '0e': 'Ext, (SCART 1)',
    '18': 'DVI',
    '14': 'PC',
    '1e': 'BNC',
    '1f': 'DVI_VIDEO',
    '20': 'Magicinfo',
    '21': 'HDMI 1',
    '22': 'HDMI 1_PC',
    '23': 'HDMI 2',
    '24': 'HDMI 2_PC',
    '25': 'DisplayPort(DisplayPort1)',
    '26': 'DisplayPort2',
    '27': 'DisplayPort3',
    '31': 'HDMI 3',
    '32': 'HDMI 3_PC',
    '33': 'HDMI 4',
    '34': 'HDMI 4_PC',
    '40': 'TV (DTV)',
    '50': 'Plug In Module',
    '55': 'HTBaseT',
    '56': 'OCM',
    '60': 'Media/MagicInfo S',
    '61': 'WiDi/Screen Mirroring',
    '62': 'Internal/USB',
    '63': 'URL Launcher',
    '64': 'IWB',
    '65': 'Web Browser',
    '66': 'Remote Workspace',
    '67': 'KIOSK',
    '68': 'Multi View',
    '69': 'SmartView+',

};


const POWER_CONTROL_HEX = 0x11;
const INPUT_SOURCE_HEX = 0x14;
const COMMANDS = {
    getStatus: function (deviceId = 0x00) { return new Uint8Array([0xAA, POWER_CONTROL_HEX, deviceId, 0x00, 0x11]);},
    powerOn: function (deviceId = 0x00) { return new Uint8Array([0xAA, POWER_CONTROL_HEX, deviceId, 0x01, 0x01, 0x13]);},
    powerOff: function (deviceId = 0x00) { return new Uint8Array([0xAA, POWER_CONTROL_HEX, deviceId, 0x01, 0x00, 0x12]);},
    reboot: function (deviceId = 0x00) { return new Uint8Array([0xAA, POWER_CONTROL_HEX, deviceId, 0x01, 0x02, 0x14]);},
    getInputSource: function (deviceId = 0x00) { return new Uint8Array([0xAA, INPUT_SOURCE_HEX, deviceId, 0x00, 0x14]);},
};
const COMMAND_TIMEOUT = 29000;

let videoSource = 'N/A';
let tvStatus;

let client;

const responseIndex = {
    header: 0, command: 1, id: 2, dataLength: 3, ackNak: 4, rcmd: 5, firstValue: 6, checksum: -1,

};

/**
 * @description The port of the TV device defaults to 1515
 * @type STRING
 */
const port = D.getParameter('port');

/**
 * @description Start time for TV operation (HH:MM format)
 * @type STRING
 */
const startTime = D.getParameter('startTime');
/**

 /**
 * @description End time for TV operation (HH:MM format)
 * @type STRING
 */
const endTime = D.getParameter('endTime');

/**
 * @description Days of the week when the TV should be active
 * Should be provided as a list of strings, where each string represents a day of the week.
 * Example: ["Monday", "Wednesday", "Friday"]
 * @type LIST
 */
const weekDays = D.getParameter('weekDays');

/**
 * @description Dates to exclude from the scheduling
 * Provide the dates as an array of strings in MM/DD/YYYY format.
 * Example: ["03/22/2025", "03/23/2025"]
 * Use ["None"] if you don't want to exclude any dates.
 * @type LIST
 */
const datesToExclude = D.getParameter('datesToExclude');

/**
 *
 * @returns {Promise<*>}
 * @private
 */

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    validateDates(datesToExclude);
    validateWeekDays(weekDays);
    validateTime(startTime);
    validateTime(endTime);
    _createConnection()
    .then(getStatus)
    .then(success)
    .catch(failure);
}

/**
 * @remote_procedure
 * @label Get sony TV power status
 * @documentation This procedure is used to retrieves and publishes the TV power status and video source
 */
function get_status() {
    _createConnection()
    .then(getStatus)
    .then(applyScheduling)
    .then(getStatus)
    .then(getInputSource)
    .then(publishStatus)
    .catch(failure);
}

/**
 * @remote_procedure
 * @label Turn On
 * @documentation Turns the TV on
 */
function custom_1(){
    _createConnection()
    .then(turnOn)
    .then(getStatus)
    .then(getInputSource)
    .then(publishStatus)
    .catch(failure);

}
/**
 * @remote_procedure
 * @label Turn Off
 * @documentation Turns the TV off
 */
function custom_2(){
    _createConnection()
    .then(turnOn)
    .then(getStatus)
    .then(getInputSource)
    .then(publishStatus)
    .catch(failure);
}

function _createConnection() {
    const d = D.q.defer();
    const ip = D.device.ip();
    console.info('Connecting to TV at IP: ', ip);
    client = net.Socket();
    client.connect(port, ip);
    client.on('connect', function () {
        client.setTimeout(COMMAND_TIMEOUT);
        client.on('timeout', function () {
            console.warn('Socket Timeout');
            d.reject('Socket Timeout');
            return d.promise;
        });
        d.resolve(client);

    });
    return d.promise;
}

/**
 *
 * @returns {Promise<*>}
 */
function getStatus() {
    const d = D.q.defer();
    if (!client) {
        console.error('Client is not defined');
        d.reject('Client is not defined');
        return d.promise;
    }
    console.info('Sending getStatus command to TV');
    client.write(COMMANDS.getStatus());
    client.on('data', function (data) {
        const response = parseResponse(data);
        if (!response.values || response.values.length !== 1) {
            console.error('Failed to parse response data');
            d.reject('Failed to parse response data');
            return;
        }

        if (isResponseFor(POWER_CONTROL_HEX, response.command)) {
            tvStatus = TV_STATUSES[response.values[0]];
            console.info('TV Status:', tvStatus);
            d.resolve();
        }
    });
    client.on('error', function (err) {
        console.error('Socket Error:', err);
        d.reject(err);
    });
    return d.promise;
}

/**
 * Applies scheduling logic to determine if the TV should be turned on or off.
 * It checks the current date and time against the specified schedule, including start time, end time, and excluded dates.
 */
function applyScheduling() {
    let excludedDates = Array.isArray(datesToExclude) && datesToExclude.length && typeof datesToExclude[0] === 'string' &&
    datesToExclude[0].toLowerCase() !== 'none' ? datesToExclude : [];
    console.info('dates To Exclude:', datesToExclude);

    validateDates(excludedDates);
    validateWeekDays(weekDays);

    const now = new Date();
    const currentTime = extractTimeInMinutesFromMidnight(now);
    const currentDay = extractDayOfTheWeek(now);
    const currentDate = extractDate(now);

    const startTimeInMinutes = timeToMinutes(startTime);
    const endTimeInMinutes = timeToMinutes(endTime);

    console.info('TV Status: ' + tvStatus);

    if (tvStatus === TV_STATUS_OFF) {
        return turnOnIfSchedulingIsMatched(currentDate, currentDay, currentTime, startTimeInMinutes, endTimeInMinutes);
    } else if (tvStatus === TV_STATUS_ON || tvStatus === TV_STATUS_ACTIVE) {
        return turnOffIfSchedulingIsNotMatched(currentDate, currentDay, currentTime, startTimeInMinutes, endTimeInMinutes);
    }
}

/**
 * Validates an array of date strings
 * @param {Array|['None']} dates An array of date strings to validate
 */
function validateDates(dates) {
    if (Array.isArray(dates) && (dates.length === 1 && dates[0].toLowerCase() === 'none')) {
        return;
    }
    dates.forEach(validateDate);
}

/**
 * Validates a single date string
 * @param {string} dateString The date string to validate in MM/DD/YYYY format
 */
function validateDate(dateString) {
    const datePattern = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(\d{4})$/;

    if (!datePattern.test(dateString)) {
        throw 'Invalid date format: ' + dateString + '. Expected format: MM/DD/YYYY';
    }
}


/**
 * Publishes the TV status and video source as device variables
 */
function publishStatus() {
    client.end();
    D.success([
        D.createVariable('status', 'Status', tvStatus),
        D.createVariable('video-source', 'Video Source', videoSource),
    ]);
}

/**
 *
 * @param {Array<string>} hexArray
 * @returns {boolean}
 */
function calculateChecksum(hexArray) {
    const checksum = hexArray.at(-1);
    const sum = hexArray.slice(1, -1)
    .reduce(function (acc, val) {
        return acc + convertToHexNumber(val);
    }, 0);
    return sum.toString(16).slice(-2) === checksum.toString(16);
}

/**
 *
 * @param {number} expectedCommand
 * @param {string} actualCommand
 * @returns {boolean}
 */
function isResponseFor(expectedCommand, actualCommand) {
    return expectedCommand.toString(16) === actualCommand;
}

/**
 *
 * @param  data
 * @returns {{values: string[], command: *}}
 */
function parseResponse(data) {
    const hexArray = data.toString('hex').match(/.{1,2}/g);
    if (convertToChar(hexArray[responseIndex.ackNak]) === 'N') {
        console.error('Received NACK response');
        throw 'Received NACK response';
    }
    if (!calculateChecksum(hexArray)) {
        console.error('Checksum validation failed');
        throw 'Checksum validation failed';
    }
    const dataLength = convertToHexNumber(hexArray[responseIndex.dataLength]);
    return {
        values: hexArray.slice(responseIndex.firstValue, responseIndex.firstValue + dataLength - 2), command: hexArray[responseIndex.rcmd],
    };
}

/**
 *
 * @param {string} val
 * @returns {string}
 */
function convertToChar(val) {
    return String.fromCharCode(parseInt(val, 16));
}

function convertToHexNumber(val) {
    return Number('0x' + val);
}

/**
 * Validates an array of weekdays to ensure they are valid days of the week
 * @param {Array} daysOfTheWeek An array of days to validate
 */
function validateWeekDays(daysOfTheWeek) {
    daysOfTheWeek.forEach(function (day) {
        if (!DAYS_OF_THE_WEEK.includes(day)) {
            throw 'Invalid day: ' + day;
        }
    });
}

/**
 *
 * @param {String} time in HH:MM format
 */
function validateTime(time) {
    if (!time || !/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
        throw 'Invalid time format: ' + time + '. Expected format: HH:MM';
    }
}

/**
 * Extracts the time in minutes from midnight for the given Date object
 * @param {Date} now The Date object to extract time from
 * @returns {number} The time in minutes since midnight
 */
function extractTimeInMinutesFromMidnight(now) {
    return now.getHours() * 60 + now.getMinutes();
}

/**
 * Extracts the day of the week from a given Date object
 * @param {Date} now The Date object to extract the day from
 * @returns {string} The day of the week
 */
function extractDayOfTheWeek(now) {
    return DAYS_OF_THE_WEEK[now.getDay()];
}

/**
 * Extracts the date in MM/DD/YYYY format from a given Date object
 * @param {Date} now The Date object to extract the date from
 * @returns {string} The date in MM/DD/YYYY format
 */
function extractDate(now) {
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();

    return month + '/' + day + '/' + year;
}

/**
 * Converts a time string in HH:MM format to minutes
 * @param {string} time The time string in HH:MM format
 * @returns {number} The time in minutes
 */
function timeToMinutes(time) {
    const timeParts = time.split(':');
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw 'Invalid time parameter: ' + time;
    }

    return hour * 60 + minute;
}

/**
 * Turns on the TV by sending the powerOn command
 * If the response is valid, it resolves the promise and reconnects to the TV after a delay.
 * @returns {Promise}
 */
function turnOn() {
    const d = D.q.defer();
    if (!client) {
        console.error('Client is not defined');
        d.reject('Client is not defined');
        return d.promise;
    }
    console.info('Sending powerOn command to TV');
    client.write(COMMANDS.powerOn());
    client.on('data', function (data) {
        const response = parseResponse(data);
        if (!response.values || response.values.length !== 1) {
            console.error('Failed to parse response data');
            d.reject('Failed to parse response data');
            return;
        }
        if (isResponseFor(POWER_CONTROL_HEX, response.command)) {
            reconnectAfterPowerCommand(d);
        }
    });
    return d.promise;
}

/**
 * Turns off the TV by sending the powerOff command
 * @returns {Promise}
 */
function turnOff() {
    const d = D.q.defer();
    if (!client) {
        console.error('Client is not defined');
        d.reject('Client is not defined');
        return d.promise;
    }
    console.info('Sending powerOff command to TV');
    client.write(COMMANDS.powerOff());
    client.on('data', function (data) {
        const response = parseResponse(data);
        if (!response.values || response.values.length !== 1) {
            console.error('Failed to parse response data');
            d.reject('Failed to parse response data');
            return;
        }
        if (isResponseFor(POWER_CONTROL_HEX, response.command)) {
            reconnectAfterPowerCommand(d);
        }
    });
    return d.promise;
}

/**
 *
 * @param {*} d
 */
function reconnectAfterPowerCommand(d) {
    client.end();
    delayFor(POWER_DELAY)()
    .then(function () {
        _createConnection()
        .then(function () {
            d.resolve();
        })
        .catch(failure);
    })
    .catch(failure);
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
    if (weekDays.includes(currentDay) && currentTime >= startTimeInMinutes && currentTime <= endTimeInMinutes &&
        !datesToExclude.includes(currentDate)) {
        console.info('Scheduling conditions matched, turning on the TV');
        return turnOn();
    }
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
    if (!weekDays.includes(currentDay) || currentTime < startTimeInMinutes || currentTime > endTimeInMinutes ||
        datesToExclude.includes(currentDate)) {
        console.info('Scheduling conditions not matched, turning off the TV');
        return turnOff();
    }
}

/**
 * Handles failures by logging the error and triggering a failure response
 * @param {string} err The error message to log and handle
 */
function failure(err) {
    client.end();
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function success(){
    D.success()
    client.end();
}
/**
 *
 * @param {number} ms
 * @returns {function(): Promise}
 */
function delayFor(ms) {
    return function () {
        const d = D.q.defer();
        console.log('starting delay for', ms, 'ms');
        setTimeout(function () {
            d.resolve();
            console.log('delay completed');
        }, ms);
        return d.promise;
    };
}

/**
 *
 * @returns {Promise}
 */
function getInputSource() {
    const d = D.q.defer();
    if (!client) {
        console.error('Client is not defined');
        d.reject('Client is not defined');
        return d.promise;
    }
    if (tvStatus === TV_STATUS_OFF) {
        console.warn('TV is off, cannot get input source');
        videoSource = 'N/A';
        d.resolve();
        return d.promise;
    }
    console.info('Sending getInputSource command to TV');
    client.write(COMMANDS.getInputSource());
    client.on('data', function (data) {
        const response = parseResponse(data);
        if (!response.values || response.values.length !== 1) {
            console.error('Failed to parse response data');
            d.reject('Failed to parse response data');
            return;
        }
        if (isResponseFor(INPUT_SOURCE_HEX, response.command)) {
            videoSource = INPUT_SOURCES[response.values[0]] || 'N/A';
            console.info('Video Source:', videoSource);
            d.resolve();
        }

    });
    return d.promise;
}


