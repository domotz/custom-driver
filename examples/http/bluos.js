/**
 * This Driver is an example on how to read STATUS and issue a command to a BluOS Device.
 * Communication protocol is HTTP.
 * 
 * Default TCP port can be changed setting the "SERVICE_PORT" variable. 
 * In case of a 4 zones BluOS player, each zone can be accessed via a different TCP port (11000,11010,11020,11030).
 * You can create dedicated instances of this script, one for each zone, and set the corresponding TCP port. 
 */

var SERVICE_PORT = 11000;
var REBOOT_PORT = 80;

var _var = D.device.createVariable;

function callBluOSAPI(url, processBluOSResponseCallback, port = SERVICE_PORT, httpMethod = "GET") {
    var httpOptions = {
        url: url,
        port: port
    };

    function httpCallback(error, response, body) {
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        else if (response.statusCode != 200) {
            console.error("Unexpected response status code: " + response.statusCode);
            D.failure(D.errorType.GENERIC_ERROR);
        }        
        else 
            processBluOSResponseCallback(body);
     };

    if (httpMethod === 'GET')
        D.device.http.get(httpOptions, httpCallback);
    else if (httpMethod === 'POST')   
        D.device.http.post(httpOptions, httpCallback);
    else
    {
        console.error("Unexpected HTTP method " + httpMethod);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * @remote_procedure
 * @label Validate BluOS device
 * @documentation This procedure is used to validate the presence of a BluOS device by checking the availability of status service
 */
function validate(){
     function validateStatusCallback(body) {
             var $ = D.htmlParse(body, {xml: true});
             D.success([_var("state", "State", $('state').text())]);
    };
    callBluOSAPI("/Status", validateStatusCallback);
} 

function decodeBoolean(booleanCode)
{
    if (booleanCode === "1")
        return "true";
    else
        return "false";
}

function decodeRepeat(repeatCode)
{
    if (repeatCode === "0")
        return "play queue";
    else if (repeatCode === "1")
        return "track";
    else if (repeatCode === "2")
        return "off";
    else 
        return "unexpected repeat value"
}

function decodeShuffle(shuffleCode)
{
    if (shuffleCode === "0")
        return "off";
    else if (shuffleCode === "1")
        return "always";
    else if (shuffleCode === "2")        
        return "once";
    else 
        return "unexpected shuffle value"
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used for updating the status EdgeRouter Device Custom Driver Variables for the DHCP leases
 */
function get_status() {
    function processStatusCallback(body) {
        var variables = [];
        var $ = D.htmlParse(body, {xml: true});

        variables.push(
            _var("canMovePlayback", "Can Move Playback", $('canMovePlayback').text()),
            _var("canSeek", "Can Seek", decodeBoolean($('canSeek').text())),
            _var("cursor", "Cursor", $('cursor').text()),
            _var("db", "dB", $('db').text(), "dB"),
            _var("image", "Image", $('image').text()),
            _var("indexing", "Indexing", $('indexing').text()),
            _var("mid", "Mid", $('mid').text()),
            _var("mode", "Mode", $('mode').text()),
            _var("mute", "Mute", decodeBoolean($('mute').text())),
            _var("pid", "Status Pid", $('pid').text()),
            _var("preset_id", "Preset Id", $('preset_id').text()),
            _var("quality", "Quality", $('quality').text()),
            _var("repeat", "Repeat", decodeRepeat($('repeat').text())),
            _var("shuffle", "Shuffle", decodeShuffle($('shuffle').text())),
            _var("sid", "Sid", $('sid').text()),
            _var("song", "Song", $('song').text()),
            _var("state", "State", $('state').text()),
            _var("stationImage", "Station Image", $('stationImage').text()),
            _var("streamFormat", "Stream Format", $('streamFormat').text()),
            _var("streamUrl", "Stream URL", $('streamUrl').text()),
            _var("syncStat", "Sync Stat", $('syncStat').text()),
            _var("title1", "Title 1", $('title1').text()),
            _var("title2", "Title 2", $('title2').text()),
            _var("title3", "Title 3", $('title3').text()),
            _var("volume", "Volume", $('volume').text(), "%"),
            _var("secs", "Seconds", $('secs').text(), "secs")
        );
        D.success(variables);
    }
    callBluOSAPI("/Status", processStatusCallback);
}
 
function executeAction(url, port = SERVICE_PORT, httpMethod = "GET") {
    function actionCallback(body) {
        console.log("EXECUTED");
        console.log(body)

        var $ = D.htmlParse(body, {xml: true});
        console.log("Changing State and reporting the result");
        console.log($('state').text());
        D.success();
    }
 
    console.log("Executing the API to change state");
    callBluOSAPI(url, actionCallback, port, httpMethod);
}
 
/**
 * @remote_procedure
 * @label Change to the Preset ID 1
 * @documentation Change to Preset ID 1 action
 */
function custom_1() {
    executeAction("/Preset?id=1");
}

/**
 * @remote_procedure
 * @label Change to the Preset ID 2
 * @documentation Change to Preset ID 2 action
 */
function custom_2() {
    executeAction("/Preset?id=2");
}

/**
 * @remote_procedure
 * @label Change to the Preset ID 3
 * @documentation Change to Preset ID 3 action
 */
function custom_3() {
    executeAction("/Preset?id=3");
 }
 
/**
 * @remote_procedure
 * @label Volume UP
 * @documentation Volume UP action
 */
function custom_4() {
    executeAction("/Volume?db=5");
 }

/**
 * @remote_procedure
 * @label Volume DOWN
 * @documentation Volume DOWN action
 */
function custom_5() {
    executeAction("/Volume?db=-5");
 }

/**
 * @remote_procedure
 * @label Play Pause
 * @documentation Play Pause action
 */
function custom_6() {
    executeAction("/Pause?toggle=1");
 }

/**
 * @remote_procedure
 * @label Reboot
 * @documentation Reboot action
 */
function custom_7() {
    executeAction("/reboot?yes=yes", REBOOT_PORT, "POST");
}