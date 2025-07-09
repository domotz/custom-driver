/** This file is part of Domotz Collector.
 * Copyright (C) 2021  Domotz Ltd
 *
 * Domotz Collector is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Domotz Collector is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Domotz Collector.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Helper function to extract pseudo-XPath from Javascript Objects
 */

function _extract(object, path) {
    const step = path.shift();
    const ret = object[step];
    if (ret === undefined) {
        throw new Error(step);
    }
    if (path.length === 0) {
        return ret;
    } else {
        try {
            return _extract(ret, path);
        } catch (e) {
            throw new Error(step + '/' + e.message);
        }
    }
}

module.exports.extract = function (object, path) {
    const _path = path.split('/');
    try {
        return _extract(object, _path);
    } catch (e) {
        throw new Error("Path " + e.message + " is undefined (" + path + " requested)");
    }
};