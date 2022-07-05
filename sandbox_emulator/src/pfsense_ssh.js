
var _var = D.device.createVariable;

var ssh_config = {
	username: D.device.username(),
	password: D.device.password(),
	port: 22,
	timeout: 20000
};

var ntp_status_cmd = 'ntpq -p | awk \'{print $1 ";" $2 ";" $7}\'';
var dns_servers_cmd = 'grep "nameserver" /etc/resolv.conf | awk \'{system("dig +tries=1 @" $2 " google.com > /dev/null; echo " $2 ":$?")}\'';

function clone(init, object) {
	var toReturn = JSON.parse(JSON.stringify(object));
	Object.keys(init).forEach(function (key) {
		toReturn[key] = init[key];
	});
	return toReturn;
}

function exec_command(command, callback) {
	var config = clone({ command: command }, ssh_config);
	D.device.sendSSHCommand(config, function (out, err) {
		if (err) {
			console.error('error while executing command: ' + command);
			console.error(err);
			D.failure();
		}
		callback(out.split('\n'));
	});
}

function to_bin(n) {
	return n && parseInt(n).toString(2) || '';
}

function get_ntp_status() {
	return new Promise(function (resolve) {

		exec_command(ntp_status_cmd, function (results) {
			var vars = [];
			for (var i = 2; i < results.length; i++) {
				var result = results[i].split(';');
				var uid = result[0];
				var label = 'NTP: '+result[0] + ' (' + result[1] + ')';
				var success = result[2];
				var binSuccess = to_bin(success[2]) + to_bin(success[1]) + to_bin(success[0]);
				var successPrencent = (binSuccess.split('1').length - 1) / 8;
				vars.push(_var(uid, label, successPrencent * 100, '%'));
			}
			resolve(vars);
		});
	});
}

function get_dns_servers() {
	return new Promise(function (resolve) {
		exec_command(dns_servers_cmd, function (results) {
			var vars = [];
			results.forEach(function (r) {
				var dns_status = r.split(':');
				vars.push(_var('dns_' + dns_status[0], 'DNS(' + dns_status[0] + ')', dns_status[1] == 0 ? 'on' : 'off'));
			});
			resolve(vars);
		});
	});

}


/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
	D.success();
}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
	Promise.all([get_dns_servers(),get_ntp_status()]).then(function(results){
		var vars = [];
		results.forEach(function(result){
			result.forEach(function(myvar){
				vars.push(myvar);
			});
		});
		D.success(vars);
	});
}