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
 * 
 * Returned by D.crypto.createCipher.<p>
 * Instances of the Cipher object are used to encrypt data.<br>
 * The object can be used in one of two ways:
 * <ul>
 *      <li> As a stream that is both readable and writable, where plain unencrypted data is written to produce encrypted data on the readable side.</li>
 *      <li> Using the cipher.update() and cipher.final() methods to produce the encrypted data.</li>
 * </ul>
 * @namespace D.crypto.Cipher
*/
/**
 * Returned by D.crypto.createDecipher.<p>
 * Instances of the Decipher object are used to decrypt data.<br>
 * The object can be used in one of two ways:
 * <ul>
 *      <li> As a stream that is both readable and writable, where plain encrypted data is written to produce unencrypted data on the readable side</li>
 *      <li> Using the decipher.update() and decipher.final() methods to produce the unencrypted data.</li>
 * </ul>
 * @namespace D.crypto.Decipher
*/
const crypto = require('crypto');
/**
 * Creates and returns a Cipher object and its supported functions, with the given algorithm, key and initialization vector.
 * @constructor
 * @private
 * @readonly
 * @param {Object} myConsole              - The Domotz Sandbox console
 * @param {string} algorithm              - The cipher algorithm
 * @param {string} key                    - The cipher key
 * @param {string} initializationVector   - The initialization vector
 */
function createCipherObject(myConsole, algorithm, key, initializationVector) {
    var cipher = null;
    try {
        cipher = crypto.createCipheriv(algorithm, key, initializationVector);
    } catch (error){
        myConsole.error('Error creating Cipher: %s', error.toString());
    }
    return {
        /**
         * Updates the cipher with data.<br>
         * The cipher.update() method can be called multiple times with new data until cipher.final() is called.<br>
         * Calling cipher.update() after cipher.final() will result in an error being thrown.<p>
         * Input Encoding options:
         * <ul>
         *      <li> If the inputEncoding argument is given, the data argument is a string using the specified encoding.</li>
         *      <li> If the inputEncoding argument is not given, data must be a Buffer.</li>
         * </ul>
         * Output Encoding options:
         * <ul>
         *      <li> If the outputEncoding is specified, a string using the specified encoding is returned.</li>
         *      <li> If no outputEncoding is provided, a Buffer is returned.</li>
         * </ul>
         * @example 
         * D.crypto.createCipher('sha1', 'key', 'initialization vector').update('data', 'binary', 'binary')
         * @memberof D.crypto.Cipher
         * @param {string|Buffer}       data               - The data object.
         * @param {binary|ascii|utf8}   [inputEncoding]    - The encoding of the data.<br>If data is a Buffer this argument is ignored.
         * @param {binary|base64|hex}   [outputEncoding]    - The encoding of the return value.<br>The output encoding specifies the output format of the enciphered data, and can be 'binary', 'base64' or 'hex'.<br>If no encoding is provided, then a buffer is returned.
         * @readonly
         * @function
         * @return    {string|Buffer}                      - Returns the enciphered contents, and can be called many times with new data as it is streamed.
        */
        update: function(data, inputEncoding, outputEncoding){
            return cipher.update(data, inputEncoding, outputEncoding);
        },
        /**
         * Returns any remaining enciphered contents.<br>
         * If no encoding is provided, then a Buffer is returned.<p>
         * Once the cipher.final() method has been called, the Cipher object can no longer be used to encrypt data.<br>
         * Attempts to call cipher.final() more than once will result in an error being thrown.
         * @example 
         * D.crypto.createCipher('sha1', 'key', 'initialization vector').final('binary')
         * @memberof D.crypto.Cipher
         * @param {binary|base64|hex}   [outputEncoding]    - The encoding of the return value.<br>Can be 'binary', 'base64' or 'hex'. <br>If no encoding is provided, then a buffer is returned.
         * @readonly
         * @function
         * @return    {string|Buffer}                      - Any remaining enciphered contents
        */
        final: function(outputEncoding){
            return cipher.final(outputEncoding);
        },
        /**
         * When using block encryption algorithms, the Cipher class will automatically add padding to the input data to the appropriate block size.<p>
         * To disable the default padding call cipher.setAutoPadding(false).<br>
         * When autoPadding is false, the length of the entire input data must be a multiple of the cipher's block size or cipher.final() will throw an error. <br>
         * Disabling automatic padding is useful for non-standard padding, for instance using 0x0 instead of PKCS padding.<p>
         * The cipher.setAutoPadding() method must be called before cipher.final().
         * @example 
         * D.crypto.createCipher('sha1', 'key', 'initialization vector').setAutoPadding(false)
         * @memberof D.crypto.Cipher
         * @param {bool}   [autoPadding=true]    - The auto padding boolean flag.
         * @readonly
         * @function
        */        
        setAutoPadding: function(autoPadding){
            cipher.setAutoPadding(autoPadding);
        }
    }
}

/**
 * Creates and returns a Decipher object and its supported functions, with the given algorithm, key and initialization vector.
 * @constructor
 * @private
 * @readonly
 * @param {Object} myConsole              - The Domotz Sandbox console
 * @param {string} algorithm              - The cipher algorithm
 * @param {string} key                    - The cipher key
 * @param {string} initializationVector   - The initialization vector
 */
function createDecipherObject(myConsole, algorithm, key, initializationVector) {
    var decipher = null;
    try {
        decipher = crypto.createDecipheriv(algorithm, key, initializationVector);
    } catch (error){
        myConsole.error('Error creating Decipher: %s', error.toString());
    }
    return {
        /**
         * Updates the decipher with data.<br>
         * The decipher.update() method can be called multiple times with new data until decipher.final() is called.<br>
         * Calling decipher.update() after decipher.final() will result in an error being thrown.<p>
         * Input Encoding options:
         * <ul>
         *      <li> If the inputEncoding argument is given, the data argument is a string using the specified encoding.</li>
         *      <li> If the inputEncoding argument is not given, data must be a Buffer.</li>
         *      <li> If data is a Buffer then inputEncoding is ignored.</li>
         * </ul>
         * Output Encoding options:
         * <ul>
         *      <li> If the outputEncoding is specified, a string using the specified encoding is returned.</li>
         *      <li> If no outputEncoding is provided, a Buffer is returned.</li>
         * </ul>
         * @example 
         * D.crypto.createDecipher('sha1', 'key', 'initialization vector').update('data', 'binary', 'binary')
         * @memberof D.crypto.Decipher
         * @param {string|Buffer}       data               - The data object.
         * @param {binary|ascii|utf8}   [inputEncoding]    - The encoding of the data string.<br>If data is a Buffer this argument is ignored.
         * @param {binary|base64|hex}   [outputEncoding]    - The encoding of the return value.<br>The output encoding specifies the output format of the enciphered data, and can be 'binary', 'base64' or 'hex'.<br>If no encoding is provided, then a buffer is returned.
         * @readonly
         * @function
         * @return    {string|Buffer}                      - Returns the deciphered data
        */
        update: function(data, inputEncoding, outputEncoding){
            return decipher.update(data, inputEncoding, outputEncoding);
        },
        /**
         * Returns any remaining plaintext which is deciphered.<br>
         * If outputEncoding is specified, a string is returned. If an outputEncoding is not provided, a Buffer is returned.<p>
         * Once the decipher.final() method has been called, the Decipher object can no longer be used to decrypt data.<br>
         * Attempts to call decipher.final() more than once will result in an error being thrown.
         * @example 
         * D.crypto.createDecipher('sha1', 'key', 'initialization vector').final('binary')
         * @memberof D.crypto.Decipher
         * @param {binary|base64|hex}   [outputEncoding]    - The outputEncoding specifies the output format of the enciphered data, and can be 'binary', 'base64' or 'hex'.<br>If no encoding is provided, then a buffer is returned.
         * @readonly
         * @function
         * @return    {string|Buffer}                      - Any remaining deciphered data
        */
        final: function(outputEncoding){
            return decipher.final(outputEncoding);
        },
        /**
         * When data has been encrypted without standard block padding, calling decipher.setAutoPadding(false) will disable automatic padding to prevent decipher.final() from checking for and removing padding.<br>
         * Turning auto padding off will only work if the input data's length is a multiple of the cipher's block size.<p>
         * The decipher.setAutoPadding() method must be called before decipher.final().
         * @example 
         * D.crypto.createDecipher('sha1', 'key', 'initialization vector').setAutoPadding(false)
         * @memberof D.crypto.Decipher
         * @param {bool}   [autoPadding=true]    - The auto padding boolean flag.
         * @readonly
         * @function
        */        
        setAutoPadding: function(autoPadding){
            decipher.setAutoPadding(autoPadding);
        }
    }
}

/**
 * Creates a custom driver crypto library sandbox object
 * @constructor
 * @private
 * @readonly
 * @param {Object} myConsole                       - The Domotz Sandbox console
 */
function cryptoLibrary(myConsole) {
    return {
        /**
         * This is a utility function for creating hash digests of data.
         * @example 
         * // returns '4130d2b39ca35eaf4cb95fc846c21ee6a39af698154a83a586ee270a0d372139' for the generated hash digest with 'utf8' input encoding and 'hex' output encoding.
         * D.crypto.hash('my data', 'sha256', 'utf8', 'hex')
         * @memberof D.crypto
         * @param {string|Buffer}       data               - The data object.<br>If data is a Buffer then inputEncoding is ignored.
         * @param {string}              algorithm          - The cipher algorithm is dependent on the available algorithms supported by the version of OpenSSL on the agent's host platform.<p>Examples are 'sha1', 'md5', 'sha256', 'sha512', 'aes192', etc
         * @param {binary|ascii|utf8}   [inputEncoding]    - The encoding of the data string.
         * @param {binary|base64|hex}   [outputEncoding]   - The encoding of the return value.<br>If no encoding is provided, then a buffer is returned.
         * @readonly
         * @function
         * @return    {string|Buffer}
         */
        hash: function (data, algorithm, inputEncoding, outputEncoding) {
            myConsole.debug("Creating hash with algorithm '%s', input encoding '%s', output encoding '%s'", algorithm, inputEncoding, outputEncoding);
            var hash = crypto.createHash(algorithm);
            hash.update(data, inputEncoding);
            return hash.digest(outputEncoding);
        },
        /**
         * This is a utility function for creating cryptographic HMAC digests.
         * @example 
         * // returns '049f32be4f33a698204529818c1b676d460c9cb2f6901457d012a6646127ae31' for the generated HMAC digest with hex output encoding
         * D.crypto.hmac('my data', 'my secret', 'sha256', 'hex')
         * @memberof D.crypto
         * @param {string}              data               - The data string
         * @param {string}              key                - The HMAC key to be used.
         * @param {string}              algorithm          - The cipher algorithm is dependent on the available algorithms supported by the version of OpenSSL on the agent's host platform.<p>Examples are 'sha1', 'md5', 'sha256', 'sha512', 'aes192', etc
         * @param {binary|base64|hex}   [outputEncoding]   - The output encoding.<br>If no encoding is provided, then a buffer is returned.
         * @readonly
         * @function
         * @return    {string|Buffer}
         */
        hmac: function (data, key, algorithm, outputEncoding) {
            myConsole.debug("Creating HMAC with algorithm '%s'", algorithm);
            var hmac = crypto.createHmac(algorithm, key);
            hmac.update(data);
            return hmac.digest(outputEncoding);
        },
        /**
         * Creates and returns a Cipher object with the given algorithm, key and initialization vector.
         * Used for encrypting data.
         * This is a wrapper of the node's crypto library 'crypto.createCipheriv'.<br>
         * For more information check the official node documentation:<br>
         * {@link https://nodejs.org/docs/latest-v14.x/api/crypto.html#crypto_crypto_createcipheriv_algorithm_key_iv_options}
         * @example 
         * // returns the Cipher object
         * D.crypto.createCipher('aes-128-ecb', 'the key', 'the initialization vector')
         * @memberof D.crypto
         * @param {string}              algorithm             - The algorithm is dependent on the available algorithms supported by the version of OpenSSL on the agent's host platform. Examples are 'sha1', 'md5', 'sha256', 'sha512', 'aes192', etc
         * @param {string|Buffer}       key                   - The key to be used. Must be 'binary' encoded strings or buffers.
         * @param {string|Buffer}       initializationVector  - The initialization vector. Must be 'binary' encoded strings or buffers.
         * @readonly
         * @function
         * @return    {Cipher}                             
         */
        createCipher: function(algorithm, key, initializationVector){
            myConsole.debug("Creating Cipher using algorithm '%s'", algorithm);
            return createCipherObject(myConsole, algorithm, key, initializationVector);
        },
        /**
         * Creates and returns a decipher object, with the given algorithm, key and initialization vector. This is the mirror of the D.createCipher().
         * Used for decrypting data.
         * This is a wrapper of the node's crypto library 'crypto.createDecipheriv'.<br>
         * For more information check the official node documentation:<br>
         * {@link https://nodejs.org/docs/latest-v14.x/api/crypto.html#crypto_crypto_createdecipheriv_algorithm_key_iv_options}
         * @example 
         * // returns the Decipher object
         * D.crypto.createDecipher('aes-128-ecb', 'the key', 'the initialization vector')
         * @memberof D.crypto
         * @param {string}              algorithm             - The algorithm is dependent on the available algorithms supported by the version of OpenSSL on the agent's host platform. Examples are 'sha1', 'md5', 'sha256', 'sha512', 'aes192', etc
         * @param {string|Buffer}       key                   - The key to be used. Must be 'binary' encoded strings or buffers.
         * @param {string|Buffer}       initializationVector  - The initialization vector. Must be 'binary' encoded strings or buffers.
         * @readonly
         * @function
         * @return    {Decipher}
         */
        createDecipher: function(algorithm, key, initializationVector){
            myConsole.debug("Creating Decipher using algorithm '%s'", algorithm);
            return createDecipherObject(myConsole, algorithm, key, initializationVector);
        },
        /**
         * Synchronous PBKDF2 (Password-Based Key Derivation Function) Returns derivedKey or throws an error.
         * * @example 
         * // returns the Derived key
         * D.crypto.pbkdf2Sync('the password', 'the salt', 100, 10)
         * @memberof D.crypto
         * @param  {string}  password    - The password
         * @param  {string}  salt        - The random bit of data added to the password before it is run through the hashing algorithm.
         * @param  {integer} iterations  - The number of iterations for the key and salt mixing.<br>Higher iterrations count makes guessing the key harder.
         * @param  {integer} keyLength   - The number of output bytes to be used for the algorithm.
         * @return {string}              - Derived key
         */
        pbkdf2Sync: function(password, salt, iterations, keyLength){
            return crypto.pbkdf2Sync(password, salt, iterations, keyLength);
        }
    };
}

module.exports.cryptoLibrary = cryptoLibrary;
