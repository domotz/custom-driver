/**
 * This file is part of Domotz Agent.
 * Copyright (C) 2016  Domotz Ltd
 *
 * Domotz Agent is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Domotz Agent is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Domotz Agent.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Created by Tommaso Latini <tommaso@domotz.com> on 03/03/16.
 */

module.exports.execute = function (path, message, resourceLocator, callback) {
	var cmd = require(path).command(message, resourceLocator);
	cmd.describe();
	cmd.execute(callback ? callback : function (_, err) {
		if (err) {
			console.warn('Error on execution: ' + JSON.stringify(err));
		}
	});
};

module.exports.extractFromOptions = function (options, field, defaultValue) {
	var value;
	if (options[field]) {
		value = options[field];
		delete options[field];
	} else {
		value = defaultValue;
	}
	return value;
};

module.exports.getResponse = function (response, error) {
	return {
		response: response,
		error: error
	};
};