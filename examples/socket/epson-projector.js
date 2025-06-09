/**
 * Domotz Custom Driver
 * Name: Epson Projector - PJLink Monitoring
 * Description: This script monitors and controls the power status and lamp hours of an Epson Projector.
 *
 * Communication protocol is "TCP/IP"
 *
 * Tested on EPSON L630U
 *
 * Creates a custom driver variables:
 *       - Status: The current power state of the projector
 *       - Lamp Hours: Cumulative hours of lamp usage
 *
 * Creates custom actions:
 *       - On: Turns the projector on
 *       - Off: Turns the projector off
 *
 **/

const COMMAND_TIMEOUT = 20000;

const AUTH = 'PJLINK';
const INFO = '%1INF2';
const LAMP = '%1LAMP';
const POWER = '%1POWR';
const ON = ' 1\r';
const OFF = ' 0\r';
const QUERY = ' ?\r';

const POWER_STATUS = {
    '0': 'Power Off',
    '1': 'Power On',
    '2': 'Cooling',
    '3': 'Warm Up',
};

const ERRORS = {
    'OK': null,
    'ERR1': 'Undefined command',
    'ERR2': 'Out of parameter',
    'ERR3': 'Unavailable time',
    'ERR4': 'Projector/Display failure',
    'ERRA': 'Authorization failed',
    'ERRM': 'Command reply mismatch',
    'ERRD': 'Not connected',
};

const COMMANDS = {
    'POWER_ON': POWER + ON,
    'POWER_OFF': POWER + OFF,
    'LAMP_HOURS': LAMP + QUERY,
    'SEARCH': '%2SRCH\r',
    'CHECK_SECURITY': 'PJLINK 2\r\n',
    'INFO': INFO + QUERY,
};


/**
 * @description Default TCP Port
 * @type NUMBER
 */
var defaultTcpPort = D.getParameter('defaultTcpPort');
/**
 * @description Projector password
 * @type SECRET_TEXT
 */
var pwd = D.getParameter('pwd');

/**
 *
 * @returns {Promise<Socket>}
 * @private
 */
function _connectToProjector() {
    const d = D.q.defer();
    const ip = D.device.ip();
    console.info('Connecting to projector at IP: ', ip);
    const client = net.createConnection({
        host: ip,
        port: defaultTcpPort,
    });
    d.resolve(client);
    return d.promise;
}

/**
 *
 * @param data
 * @returns {{cmd: string, args: string[], authVersion: null, err: null}}
 */
function parseResponse(data) {
    const read = data.toString().trim();
    const cmd = read.slice(0, 6);
    let args = read.slice(7);
    let err = null;
    let authVersion = null;
    if (ERRORS[args]) {
        err = ERRORS[args];
    }
    if (cmd === AUTH) {
        args = args.split(' ');
        if (!err) {
            if (args[0] === '1') {
                if (args[1].length === 8) {
                    authVersion = '1';
                }
            }
            if (args[0] === '0') {
                authVersion = '0';
            }
        }
    }

    return {
        cmd: cmd,
        args: args,
        authVersion: authVersion,
        err: err,
    };
}

function calcDigest(input) {
    return D.crypto.hash(input.trim() + pwd, 'md5', 'utf8', 'hex');
}

/**
 * @param client{Socket}
 * @param responseObject{{cmd: string, args: string[], authVersion: null, err: null}}
 * @param command{string}
 */
function executeAuthenticatedCommand(client, responseObject, command) {
    const serverHash = responseObject.args[1];
    const authString = calcDigest(serverHash);
    client.write(authString + command);
}

/**
 *
 * @param responseObject{{cmd: string, args: string[], authVersion: null, err: null}}
 */
function handleLampHours(responseObject) {
    const results = [];
    const stats = responseObject.args.split(' ');
    const hasMultipleLamps = stats.length > 2;
    for(let i = 0; i < stats.length; i += 2) {
        const lampHours = stats[i];
        const powerStatus = stats[i+1];
        const suffix = hasMultipleLamps ? i/2 + 1 : '';
        const uidPowerStatus = 'power-status' + suffix;
        const labelPowerStatus = 'Power Status' + suffix;
        const uidLampHour = 'lamp-hour' + suffix;
        const labelLampHour = 'Lamp Hour' + suffix;
        results.push(D.createVariable(uidPowerStatus, labelPowerStatus, POWER_STATUS[powerStatus], null, D.valueType.STRING));
        results.push(D.createVariable(uidLampHour, labelLampHour, lampHours, 'Hours', D.valueType.STRING));
    }

    return results;
}

/**
 *
 * @param responseObject{{cmd: string, args: string[], authVersion: null, err: null}}
 * @returns {[]}
 */
function handlePowerResponse(responseObject) {
    if (ERRORS[responseObject.args]) {
        console.error(ERRORS[responseObject.args]);
    } else {
        console.info('Success');
    }
}

/**
 *
 * @param client{Socket}
 * @param command{string}
 * @returns {Promise<Socket>}
 */
function executeCommand(client, command) {
    const d = D.q.defer();
    if (!client) {
        console.error('Client is not defined');
        d.reject('Client is not defined');
        return d.promise;
    }
    client.setTimeout(COMMAND_TIMEOUT);
    client.on('timeout', function () {
        console.warn('Socket Timeout');
        client.end();
        d.resolve();
        return d.promise;
    });
    client.on('data', function (data) {
        const responseObject = parseResponse(data);
        if (responseObject.err) {
            console.error('Error:', responseObject.err);
            d.reject(responseObject.err);
            client.end();
        }
        switch (responseObject.cmd) {
        case AUTH:
            if (responseObject.authVersion === '1') {
                executeAuthenticatedCommand(client, responseObject, command);
            }
            if (responseObject.authVersion === '0') {
                client.write(command);
            }
            break;
        case LAMP:
            client.end();
            d.resolve(handleLampHours(responseObject));
            break;
        case POWER:
            d.resolve(handlePowerResponse(responseObject));
            client.end();
            break;
        case INFO:
            client.end();
            console.info(responseObject.args);
            d.resolve();
        default:
            client.write(command);
            break;
        }

    });
    return d.promise;
}


function handleError(err) {
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
 * @remote_procedure
 * @label Turn Off
 * @documentation Turn Projector Off
 */
function custom_1() {
    _connectToProjector()
        .then(function (client) {return executeCommand(client, COMMANDS.POWER_OFF);})
        .then(D.success)
        .catch(handleError);
}

/**
 * @remote_procedure
 * @label Turn On
 * @documentation Turn Projector On
 */
function custom_2() {
    _connectToProjector()
        .then(function (client) {return executeCommand(client, COMMANDS.POWER_ON);})
        .then(D.success)
        .catch(handleError);
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */function validate() {
    _connectToProjector()
        .then(function (client) {return executeCommand(client, COMMANDS.INFO);})
        .then(D.success)
        .catch(handleError);
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used for retrieving device * variables data
 */function get_status() {
    _connectToProjector()
        .then(function (client) {return executeCommand(client, COMMANDS.LAMP_HOURS);})
        .then(D.success)
        .catch(handleError);
}
