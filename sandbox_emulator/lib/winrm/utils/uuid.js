/**
 * This file is part of Domotz Collector.
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
 * Creates a random UUID (version 4), as specified in
 * https://tools.ietf.org/html/rfc4122 - Section 4.4
 */
const crypto = require('crypto');

module.exports.uuid4 = function () {
    var randomBytes = crypto.randomBytes(16).toJSON(); //   The UUID format is 16 octets
    randomBytes = randomBytes.data || randomBytes;
// Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved
// to zero and one, respectively
    randomBytes[8] = randomBytes[8] & 0xBF | 0x80;
// Set the four most significant bits (bits 12 through 15) of the
// time_hi_and_version field to the 4-bit version number from
// Section 4.1.3. [0 1 0 0]
    randomBytes[6] = randomBytes[6] & 0x0F | 0x40;

    function hex(array) {
        return Array.from(array, function (byte) {
            return ('0' + (byte & 0xFF).toString(16)).slice(-2);
        }).join('');
    }

    return hex(randomBytes.slice(0, 4)) + '-' +
        hex(randomBytes.slice(4, 6)) + '-' +
        hex(randomBytes.slice(6, 8)) + '-' +
        hex(randomBytes.slice(8, 10)) + '-' +
        hex(randomBytes.slice(10, 16));
};
