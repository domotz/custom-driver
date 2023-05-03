/**
 * This file is part of Domotz Agent.
 *
 * @license
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
 * @copyright Copyright (C) Domotz Inc
 */

/**
 * The buffer library is a global type for dealing with binary data directly.
 * It can be constructed in a variety of ways.
 * Buffer objects are used to represent a fixed-length sequence of bytes.
 * <p>The Buffer class is a subclass of JavaScript's Uint8Array class
 * and extends it with methods that cover additional use cases.
 * The API accepts plain Uint8Arrays wherever Buffers are supported as well.</p>
 * {@link https://nodejs.org/docs/latest-v14.x/api/buffer.html}
 * @namespace D._unsafe.buffer
 * */
var fs = require('fs');
var domotzPlatform = require('../lib/platform').factory(fs);

/**
 * Creates a custom driver buffer library sandbox object
 * @constructor
 * @private
 * @readonly
 * @param {Object} myConsole                       - The Domotz Sandbox console
 */
function bufferLibrary(myConsole) {
    return {
        /**
         * Allocates a new Buffer using multiple types of input data (array, arrayBuffer, buffer, object, string)
         * @see {@link https://nodejs.org/docs/latest-v14.x/api/buffer.html#buffer_static_method_buffer_from_array}
         * @memberof D._unsafe.buffer
         * @param {Array.<integer> | ArrayBuffer | SharedArrayBuffer | Unit8array | Buffer | string }  data
         * @param {integer|string}   [offsetOrEncoding=0 | utf8] - Index of first byte to expose or encoding of string
         * @param {integer}  [length]                        - Number of bytes to expose.
         * @returns {Buffer}
         */
        from(data, offsetOrEncoding, length) {
            myConsole.debug('Creating new buffer from: %s', typeof data);
            try {
                if (domotzPlatform.isNodeVersionZero()) {
                    return new Buffer(data, offsetOrEncoding, length);
                }
                return Buffer.from(data, offsetOrEncoding, length);
            } catch (error) {
                myConsole.error('Error creating buffer: %s', error.toString());
            }
        },
        /**
         * Allocates a new buffer of size bytes. If fill is undefined, the Buffer will be zero-filled.
         * A TypeError will be thrown if size is not a number.
         * If size is larger than buffer.constants.MAX_LENGTH or smaller than 0, ERR_INVALID_OPT_VALUE is thrown.
         * @example D._unsafe.buffer.alloc(8,'1') - returns '11111111'
         * @memberof D._unsafe.buffer
         * @see  {@link https://nodejs.org/api/buffer.html#static-method-bufferallocsize-fill-encoding}
         * @param {integer}  length                                      - The desired length of the new Buffer.
         * @param {string | Buffer | Unit8Array | integer}   [fill=0]  - A value to pre-fill the new Buffer with.
         * @param {string}  [encoding=utf8]                            -  If fill is a string, this is its encoding.
         * @returns {Buffer}
         */
        alloc(length, fill, encoding) {
            myConsole.debug('Allocating a new Buffer of %s bytes.', length);
            try {
                if (domotzPlatform.isNodeVersionZero()) {
                    return new Buffer(
                        length, fill, encoding
                    );
                }
                return Buffer.alloc(
                    length, fill, encoding
                );
            } catch (error) {
                myConsole.error('Error allocating a new buffer of bytes: %s', error.toString());
            }

        },
        /**
         * Returns a new Buffer which is the result of concatenating all the Buffer instances in the list together.
         * If the list has no items, or if the length is 0, then a new zero-length Buffer is returned.
         * If length is not provided, it is calculated from the Buffer instances in list by adding their lengths.
         * If length is provided, it is coerced to an unsigned integer. If the combined length of the Buffers in data list exceeds length, the result is truncated to length.
         * @memberof D._unsafe.buffer
         * @see  {@link https://nodejs.org/api/buffer.html#static-method-bufferconcatlist-totallength}
         * @param {Array.<Buffer> | Array.<Unit8Array> } data - List of Buffer or Uint8Array instances to concatenate.
         * @param {integer} length - Total length of the Buffer instances in list when concatenated.
         * @returns {Buffer}
         * */
        concat(data, length) {
            myConsole.debug('Concatenating all the Buffer instances in the list.');
            try {
                return Buffer.concat(data, length);
            } catch (error) {
                myConsole.error('Error concatenating buffer: %s', error.toString());
            }
        }
    };
}

module.exports.bufferLibrary = bufferLibrary;