// var snmp = require("net-snmp");
require('dotenv').config();
var device = require('../lib/device').device;

global.D = {
	success: function (vars) {
		if (!vars) return;
		vars.forEach(function (v) {
			console.log(v.label, '=', v.value);
		});
	},
	failure: function (msg) {
		console.error(msg);
		process.exit(1);
	},
	errorType: {
		MISSING_DEVICE_ERROR: 'No device was found for execution',
		RESOURCE_UNAVAILABLE: 'The Resource you are trying to access is not available',
		AUTHENTICATION_ERROR: 'Authentication with the device has failed',
		PARSING_ERROR: 'Failed to parse the response',
		TIMEOUT_ERROR: 'The remote call has resulted in a timeout',
		IMPORT_NOT_ALLOWED: 'Import statements are not allowed in the sandbox enviroment',
		REQUIRE_NOT_ALLOWED: 'Require statements are not allowed in the sandbox enviroment',
		GENERIC_ERROR: 'Generic/Unknown error has occurred',
	},
	device: device({ max_var_id_len: 50 }),
	/*device: {
    http: {

    },
    createSNMPSession: snmp.createSessionForDevice,
    createSNMPSession: function() {
      var session = snmp.createSession(process.env.SNMP_SERVER, process.env.SNMP_COMMUNITY_STRING);
      return {
        get: function(oids, cb) {
          return session.get(oids, function (error, varbinds) {
            if (error) cb(null, error)
            else {
              var result = {}
              for (var i = 0; i < varbinds.length; i++) {
                if (snmp.isVarbindError(varbinds[i])) {
                  cb(null, snmp.varbindError(varbinds[i]));
                  break
                }else if(varbinds[i].type == 4){
                  result[varbinds[i].oid] = varbinds[i].value.toString()
                }else if(Buffer.isBuffer(varbinds[i].value)){
                  result[varbinds[i].oid] = parseInt(varbinds[i].value.toString("hex"), 16)
                } else {
                  result[varbinds[i].oid] = varbinds[i].value.toString()
                }
              }

              cb(result)
            }
            session.close()

          })
        },
        walk: function(oid, cb) {
          var result = {}
          return session.walk(oid,
            function (varbinds) {
              for (var i = 0; i < varbinds.length; i++) {
                if (snmp.isVarbindError(varbinds[i])) {
                  cb(null, snmp.varbindError(varbinds[i]));
                  break
                } else {
                  if(!varbinds[i].oid.startsWith(oid)) continue;
                  result[varbinds[i].oid] = varbinds[i].value.toString()
                }
              }

            },
            function (error) {
              if (error) return cb(null, error)
              cb(result)
            })
        }
      }
    },
    createVariable: function(uid, label, value, unit) {
      if(!uid || uid.length>50){
        console.error("invalid uid" + uid)
        process.exit(1)
      }
      return {
        uid: uid, label: label, value: value, unit: unit
      }
    }
  }*/

};