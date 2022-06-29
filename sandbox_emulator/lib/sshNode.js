/** This file is part of Domotz Agent.
 * Copyright (C) 2020  Domotz Ltd
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
 * Created by Andrea Azzara <a.azzara@domotz.com> on 6/04/2020.
 */


module.exports.factory = function (resourceLocator) {
	var myConsole = resourceLocator.log.decorateLogs();

	var Client = resourceLocator.ssh2.Client;
	var sleep = resourceLocator.q.delay;
	var async = resourceLocator.async;
	var lodash = resourceLocator.lodash;

	var eventEmitter = resourceLocator.events.EventEmitter;

	function sshShellSequence(options, callback) {
		var prompt = options.prompt || '#';
		var promptRegex = options.prompt_regex ? new RegExp(options.prompt_regex) : null;
		var errorPrompt = options.error_prompt;
		var haltOn = options.halt_on || [];
		var interCommandTimeoutMs = options.inter_command_timeout_ms || 1000;
		var globalTimeoutMs = options.global_timeout_ms || 30000;
		var commands = options.commands;

		if (process.version < 'v0.11.12') { //https://github.com/mscdex/ssh2-streams
			myConsole.info('Removing unsupported ciphers/algorithms');
			lodash.pull(options.algorithms.kex,
				'diffie-hellman-group-exchange-sha1',
				'diffie-hellman-group-exchange-sha256',
				'ecdh-sha2-nistp256',
				'ecdh-sha2-nistp384',
				'ecdh-sha2-nistp521',
				'curve25519-sha256@libssh.org');

			lodash.pull(options.algorithms.cipher,
				'aes128-gcm',
				'aes128-gcm@openssh.com',
				'aes256-gcm',
				'aes256-gcm@openssh.com');
		}


		var sshOptions = {
			host: options.host,
			username: options.username,
			port: options.port || 22,
			password: options.password,
			algorithms: {
				kex: options.algorithms.kex,
				cipher: options.algorithms.cipher,
			},
		};

		myConsole.debug('Options: ' + JSON.stringify(options));

		var callbackCalled = false;

		var outputEvent = new eventEmitter();

		var conn = new Client();

		function executeOnStream(stream, command) {
			myConsole.info('executing command: ' + command);
			stream.write(command + '\n');
		}

		function returnError(e) {
			if (!callbackCalled) {
				myConsole.warn('Error ' + JSON.stringify(e));
				callbackCalled = true;
				callback({
					error: e,
					output: null,
				});
			}
		}
		function isCorrectPrompt(promptChunk, promptOutput) {
			return promptChunk.search(promptRegex) > -1 || promptOutput.search(promptRegex) > -1 ||
              promptChunk.indexOf(prompt) > -1 || promptOutput.indexOf(prompt) > -1;
		}
		function isErroneousPrompt(promptChunk, promptOutput) {
			return errorPrompt && (promptChunk.indexOf(errorPrompt) > -1 || promptOutput.indexOf(errorPrompt) > -1);
		}
		conn.on('error', function (e) {
			myConsole.warn('ssh connection error ' + e.message);
			returnError({message: e.message});
		});

		conn.on('end', function () {
			returnError({message: 'disconnected'});
		});

		conn.on('close', function () {
			returnError({message: 'socket closed'});
		});

		conn.on('ready', function () {
			myConsole.debug('ssh Client ready');

			var output = '';

			var resetOutput = function () {
				output = '';
			};

			var timeout = setTimeout(function () {
				returnError({message: 'timeout'});
			}, globalTimeoutMs);


			conn.shell(function (err, stream) {
				if (err) {
					myConsole.warn('stream error' + err.toString());
					return;
				}

				stream.on('readable', function () {
					var chunk;
					while (null !== (chunk = stream.read())) {
						output += chunk;
						if (chunk.length > 0 ) {
							var chunkString = chunk.toString();
							if (isCorrectPrompt(chunkString, output)) {
								outputEvent.emit('shellReady', output);
								resetOutput();
							} else if (isErroneousPrompt(chunkString, output)) {
								outputEvent.emit('shellInError', output);
								resetOutput();
							}
						}
					}
				});
				stream.on('close', function () {
					myConsole.debug('Stream was closed successfully');
					outputEvent.emit('shellReady', 'Stream  Closed');
					conn.end();
				});
				var commandFunctions = [];

				var singleCommandExecutor = function (command, cb) {
					outputEvent.once('shellInError', function (commandErrorResult) {
						myConsole.debug('Shell Resulted in Error: %s', commandErrorResult);
						cb({message: commandErrorResult, command: command}, null);
					});
					sleep(interCommandTimeoutMs).then(function () {
						resetOutput();
						executeOnStream(stream, command);

						outputEvent.once('shellReady', function (commandResult) {
							var b64Output = Buffer(commandResult).toString('base64');
							var halt = haltOn.filter(function (stopString) {
								return commandResult.indexOf(stopString) > -1;
							});
							if (halt.length > 0) {
								cb({message: 'halted on', command: command, halted_on: b64Output});
								return;
							}
							myConsole.info('command %s completed', command);
							myConsole.verbose('command %s output: ', commandResult);
							cb(null, b64Output);
						});
					});
				};

				commands.forEach(function (item) {
					commandFunctions.push(singleCommandExecutor.bind(null, item));
				});

				async.series(commandFunctions, function (err, result) {
					stream.end();
					conn.end();
					if (err && !callbackCalled) {
						returnError(err);
					} else {
						myConsole.info('Sequence done');
						myConsole.verbose(JSON.stringify(result));
						if (!callbackCalled) {
							clearTimeout(timeout);
							callbackCalled = true;
							callback({
								error: null,
								output: result,
							});
						} else {
							myConsole.warn('sequence complete but timeout expired, result is ignored');
						}
					}

				});
			});
		});

		conn.connect(sshOptions);
	}

	function executor(command, payload, myConsole, deferred) {
		var e = {
			callbackCalled: false,
			timeout: payload.timeout || payload.ttl || 2000,
			sshOptions: {
				host: payload.host,
				username: payload.username || payload.user,
				port: payload.port || 22,
				password: payload.password,
				algorithms: payload.algorithms
			},
			connection: new Client(),
			timeoutTimer: null,
			_stdout: '',
			_stderr: ''
		};
		myConsole.debug('Options: ' + JSON.stringify(e.sshOptions));

		// Entry point - only method to be called outside tests
		e.start = function () {
			var conn = e.connection;
			conn.on('ready', e._executeCommand);
			conn.on('error', e._handleConnectionError);

			e.timeoutTimer = setTimeout(e._killForTimeout, e.timeout);
			conn.connect(e.sshOptions);
		};

		e._executeCommand = function () {
			console.info('Connection to host %s established', e.sshOptions.host);
			e.connection.exec(command, e._onCommandRunning);
		};

		e._onCommandRunning = function (err, stream) {
			if (err) {
				e._end(undefined, err);
				return;
			}
			stream.on('close', e._onCommandExited);
			stream.on('data', e._stdoutArrived);
			stream.stderr.on('data', e._stderrArrived);
		};

		e._stdoutArrived = function (data) {
			e._stdout += data;
		};
		e._stderrArrived = function (data) {
			e._stderr += data;
		};

		e._onCommandExited = function (code, signal) {
			var conn = e.connection;
			myConsole.debug('Execution terminated: exit code=' + code + ', signal=' + signal);
			conn.end();
			if (e.callbackCalled) {
				myConsole.info('Callback already called, probably due to a timeout, ignoring outcome');
				return;
			}
			var stdout = (e._stdout || '').trim();
			var stderr = (e._stderr || '').trim();
			if (code === 0) {
				e._end(stdout, undefined);
			} else {
				var exception = new Error(stderr);
				exception.code = code;
				exception.output = stdout;
				e._end(undefined, exception);
			}
		};
		e._handleConnectionError = function (error) {
			myConsole.warn('SSH Connection error: \'%s\'', error.message);
			e._transformErrorForWorker(error);
			e._end(undefined, error);
		};

		e._transformErrorForWorker = function (error) {
			// Calculate the error code that ssh returns in similar situations
			if (error.message === 'All configured authentication methods failed') {
				error.code= 5;
				error.message = 'Permission denied';
			} else {
				error.code= {
					'ECONNREFUSED': 255
				}[error.message] || 255;
			}
		};

		e._killForTimeout = function () {
			e._end(undefined, new Error('Timeout of ' + e.timeout + 'ms expired'));
			e.connection.end();
		};

		e._end = function (output, error) {
			if (e.callbackCalled) {
				myConsole.debug('Duplicate call to ssh exec end: output=%s, error=%s', output, error);
				return;
			}
			e.callbackCalled = true;
			clearTimeout(e.timeoutTimer);
			if (error) {
				deferred.reject(error);
			} else {
				deferred.resolve(output);
			}
		};

		return e;
	}

	/**
   * Executes a command via ssh on a remote host
   * @param command - the command to execute
   * @param payload - options such as host, username, password etc.
   * @param correlationId - unique id of the message, for trace logging
   * @returns promise
   */
	function exec(command, payload, correlationId) {
		var localConsole = console;

		localConsole.info('Executing command: \'%s\'', command);

		var deferred = resourceLocator.q.defer();

		executor(command, payload, localConsole, deferred).start();

		return deferred.promise;
	}

	return {
		sshShellSequence: sshShellSequence,
		exec: exec,
		// Testing purpose
		_executor: executor

	};
};