
/**
 * 
 * @param {[function]} arrayFn An array of functions that will be executed in the same time, each function should have a callback as parameter
 * @param {function} callback This function is called when all functions in arrayFn are done
 */

function execute_all(arrayFn, callback) {
    if (arrayFn.length == 0) {
        callback([]);
    }
    var length = arrayFn.length;
    var results = new Array(length);
    var finished = 0;
    arrayFn.forEach(function (fn, index) {
        fn(function (result) {
            results[index] = result;
            if (++finished == length) {
                callback(results);
            }
        });
    });
}

/**
 * 
 * @param {[function]} arrayFn An array of functions that will be executed one by one, each function shoud have 2 parameters:
 * the first parameter will contain the last result passed by the previous function in it's callback (null for the first one)
 * the second parameter will contain the callback, you can pass a parameter to the next function
 * @param {function} This function is called when all functions in arrayFn are done
 */
function execute_seq(arrayFn, callback) {
    var _this = this;
    var callbackResult = null;
    function executeNext(functionIndex) {
        if (functionIndex == arrayFn.length) return callback.apply(_this, [callbackResult]);
        arrayFn[functionIndex].apply(_this, [callbackResult, function (result) {
            callbackResult = result;
            executeNext.apply(_this, [++functionIndex]);
        }]);
    }
    executeNext.apply(_this, [0]);
}

/**
 * 
 * @param {*} init object initialisation
 * @param {*} object object to clone
 * @returns cloned object
 */
function clone(init, object){
    var toReturn = JSON.parse(JSON.stringify(object));
    Object.keys(init).forEach(function(key){
        toReturn[key] = init[key];
    });
    return toReturn;
}