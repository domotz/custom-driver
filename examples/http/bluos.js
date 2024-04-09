**
 * This Driver is an example on how to read STATUS and issue a command to the POWERRNODE / Lenbrook
 * Communication protocol is HTTP.
 */
var port = D.getParameter("port")
var _var = D.device.createVariable;
function validate(){
    function callback(error, response, body) {
        var variables = [];
        var $ = D.htmlParse(body, {xml: true});
        variables.push(
            D.createVariable("state", "State", $('state').text()));
        D.success(variables);
    };
    var httpOptions = {
        url: "/Status",
        port: port
    }
    D.device.http.get(httpOptions, callback);    
} 
/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used for updating the status EdgeRouter Device Custom Driver Variables for the DHCP leases
 */
function get_status() {
    function callback(error, response, body) {
        var variables = [];
        var $ = D.htmlParse(body, {xml: true});
        variables.push(
            _var("canMovePlayback", "Can Move Playback", $('canMovePlayback').text()),
            _var("canSeek", "Can Seek", $('canSeek').text()),
            _var("cursor", "Cursor", $('cursor').text()),
            _var("db", "dB", $('db').text()),
            _var("image", "Image", $('image').text()),
            _var("indexing", "Indexing", $('indexing').text()),
            _var("mid", "Mid", $('mid').text()),
            _var("mode", "Mode", $('mode').text()),
            _var("mute", "Mute", $('mute').text()),
            _var("pid", "Status Pid", $('pid').text()),
            _var("preset_id", "Preset Id", $('preset_id').text()),
            _var("quality", "Quality", $('quality').text()),
            _var("repeat", "Repeat", $('repeat').text()),
            _var("shuffle", "Shuffle", $('shuffle').text()),
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
            _var("volume", "Volume", $('volume').text()),
            _var("secs", "Seconds", $('secs').text()));
        D.success(variables);
    };
    var httpOptions = {
        url: "/Status",
        port: port
    }
    D.device.http.get(httpOptions, callback);
}
function actionCallback(error, response, body){
    console.log(body)
    var $ = D.htmlParse(body, {xml: true});
    console.log("Changing State and reporting the result");
    console.log($('state').text());
    D.success();
}
function executeAction(url){
    var httpOptions = {
        url: url,
        port: port
    }
    console.log("Executing the API to change state");
    D.device.http.get(httpOptions, actionCallback);    
    console.log("EXECUTED");
}
/**
* @remote_procedure
* @label Change to the Preset ID 1
* @documentation Preset ID 1 action
*/
function custom_1(){
    executeAction("/Preset?id=1")
}
/**
* @remote_procedure
* @label Change to the Preset ID 2
* @documentation Preset ID 2 action
*/
function custom_2(){
    executeAction("/Preset?id=2")
}
/**
* @remote_procedure
* @label Change to the Preset ID 3
* @documentation Change to Preset 3 action
*/
function custom_3(){
    executeAction("/Preset?id=3")
}
/**
* @remote_procedure
* @label Volume UP
* @documentation Volume UP action
*/
function custom_4(){
    executeAction("/Volume?db=5")
}
/**
* @remote_procedure
* @label Volume DOWN
* @documentation Volume DOWN action
*/
function custom_5(){
    executeAction("/Volume?db=-5")
}
/**
* @remote_procedure
* @label Play Pause
* @documentation Play Pause action
*/
function custom_6(){
    executeAction("/Pause?toggle=1")
}
/**
* @remote_procedure
* @label Reboot
* @documentation Reboot action
*/
function custom_7(){
    executeAction("/reboot?yes=yes")
}