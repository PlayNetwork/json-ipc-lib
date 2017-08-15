import 'babel-polyfill';
import 'source-map-support/register';

import * as protocol from 'json-rpc-protocol';
import EventEmitter from 'events';
import fs from 'fs';
import log from 'debug';
import net from 'net';

const
	DEFAULT_CLEAN_HANDLE_ON_LISTEN = true,
	DEFAULT_ENCODING = 'utf8',
	EVENT_CLOSE = 'close',
	EVENT_CONNECTION = 'connection',
	EVENT_ERROR = 'error',
	EVENT_LISTENING = 'listening',
	EVENT_READABLE = 'readable',
	EVENT_REQUEST= 'request';

const
	cleanHandle = (path) => new Promise((resolve) => fs.unlink(path, () => resolve())),
	debug = log('json-ipc'),
	getMethodTarget = (methods, excludedMethods, requestedMethod) => {
		let methodTarget;

		if (!methods) {
			debug('Server: no available remote methods available for execution');
			return;
		}

		if (!requestedMethod) {
			debug('Server: no remote execution method specified in message');
			return;
		}

		if (excludedMethods.indexOf(requestedMethod) >= 0) {
			debug('Server: method specified in message is excluded from remote execution');
			return;
		}

		// search for target of method
		requestedMethod
			.split(/\./g)
			.forEach((method) => (methodTarget = (methodTarget || methods)[method]));

		return methodTarget;
	},
	initOptions = (options) => {
		options = options || {};

		if (typeof options.cleanHandleOnListen === 'undefined') {
			options.cleanHandleOnListen = DEFAULT_CLEAN_HANDLE_ON_LISTEN;
		}

		if (typeof options.excludedMethods === 'undefined') {
			options.excludedMethods = [];
		}

		return options;
	},
	jsonRpcResponse = (socket, message) => {
		if (socket.writable) {
			debug('Server: writing response to socket: %s', message);
			socket.write(JSON.stringify(message));
		}
	};

export class Server extends EventEmitter {
	constructor (path, methods, options) {
		if (!path) {
			throw new Error('path parameter is required');
		}

		if (!methods || typeof methods !== 'object') {
			throw new Error('methods parameter is required');
		}

		super();

		debug('Server: new JSON-IPC Server: %s', path);

		this._listening = false;
		this.connections = [];
		this.methods = methods;
		this.options = initOptions(options);
		this.path = path;
		this.server = net
			.createServer()
			.on(EVENT_CONNECTION, (socket) => {
				debug('Server: new socket connection detected');
				socket.setEncoding(DEFAULT_ENCODING);
				socket.on(EVENT_READABLE, () => this._handleConnection(socket));
			})
			.on(EVENT_ERROR, (err) => {
				debug(
					'Server: error occurred: %s (%o)',
					err.message,
					err);

				this.emit(EVENT_ERROR, err);
			})
			.on(EVENT_LISTENING, () => (this._listening = true));
	}

	async _handleConnection (socket) {
		let
			existingSocketIndex = this.connections.findIndex(
				(element) => element === socket),
			message,
			methodTarget,
			result,
			self = this,
			startTime;

		// emit the connection event for new connections
		if (existingSocketIndex < 0) {
			debug('Server: connection handler activated with new socket');

			self.emit(EVENT_CONNECTION, socket);
			self.connections.push(socket);

			// remove the connection once the socket has closed
			socket.on(EVENT_CLOSE, (withError) => {
				debug(
					'Server: detected socket close (method: %s, withError: %s)',
					socket.request ? socket.request.method : 'undefined',
					withError);

				let index = self.connections.findIndex(
					(element) => element === socket);

				if (index >= 0) {
					self.connections.splice(index, 1);
				}
			});
		}

		/* eslint no-await-in-loop: 0 */
		while ((message = socket.read()) !== null) {
			debug('Server: message received on socket (%s)', message);

			// attempt to parse the inbound JSON-RPC 2.0 message
			try {
				socket.request = protocol.parse(JSON.parse(message));
			} catch (ex) {
				self.emit(EVENT_ERROR, ex);
				return jsonRpcResponse(socket, ex);
			}

			debug(
				'Server: successfully parsed JSON-RPC 2.0 message, method target: %s',
				socket.request.method);

			// emit the request event
			self.emit(EVENT_REQUEST, socket.request);

			// determine the actual method to invoke
			methodTarget = getMethodTarget(
				self.methods,
				self.options.excludedMethods,
				socket.request.method);

			// ensure we have a valid method to execute
			if (!methodTarget) {
				self.emit(EVENT_ERROR, new Error('method target not found'));
				return jsonRpcResponse(
					socket,
					protocol.format.error(
						socket.request.id,
						new protocol.MethodNotFound(socket.request.method)));
			}

			// validate params (if provided) ... only supports Array at this point
			if (socket.request.params && !Array.isArray(socket.request.params)) {
				return jsonRpcResponse(
					socket,
					protocol.format.error(
						socket.applyrequest.id,
						new protocol.InvalidParameters('parameters must be an array')));
			}

			// attempt to execute the method
			try {
				debug(
					'Server: executing method %s with parameters: %o',
					socket.request.method,
					socket.request.params);

				startTime = Date.now();
				result = methodTarget.apply(null, socket.request.params);
			} catch (ex) {
				debug(
					'Server: error executing method %s: %s (%o)',
					socket.request.method,
					ex.message,
					ex);

				self.emit(EVENT_ERROR, ex);
				return jsonRpcResponse(
					socket,
					protocol.format.error(
						socket.request.id,
						new protocol.JsonRpcError(ex.message)));
			}

			// handle synchronous results
			if (result && (!result.then || typeof result.then !== 'function')) {
				debug('Server: method %s returned synchronously', socket.request.method);

				// handle the result of the method when not a Promise...
				return jsonRpcResponse(
					socket,
					protocol.format.response(socket.request.id, result));
			}

			debug('Server: method %s returned a Promise', socket.request.method);

			// wait for the result
			/* eslint no-loop-func: 0 */
			return result
				.then((value) => {
					debug(
						'Server: completed method %s in %dms',
						socket.request.method,
						Date.now() - startTime);

					return jsonRpcResponse(
						socket,
						protocol.format.response(socket.request.id, value));
				})
				.catch((ex) => {
					debug(
						'Server: error returned when executing method %s after %dms: %s (%o)',
						socket.request.method,
						Date.now() - startTime,
						ex.message,
						ex);

					self.emit(EVENT_ERROR, ex);
					return jsonRpcResponse(
						socket,
						protocol.format.error(
							socket.request.id,
							new protocol.JsonRpcError(ex.message)));
				});
		}
	}

	async close (callback) {
		let self = this;

		debug('Server: close method called');

		callback = callback || function (err) {
			if (err && err instanceof Error) {
				self.emit(EVENT_ERROR, err);

				return Promise.reject(err);
			}

			return Promise.resolve(self);
		};

		// error out if not listening...
		if (!self._listening) {
			debug('Server: close method called, but server is not presently listening');

			return Promise
				.resolve()
				.then(() => callback(new Error('server is not listening')));
		}

		debug('Server: ending %d active connections', self.connections.length);

		// iterate through each connection and close it...
		self.connections.forEach((socket) => socket.end());

		// stop listening...
		self._listening = false;
		self.emit(EVENT_CLOSE);

		// remove the pipe file
		return await cleanHandle(self.path)
			.then(() => callback())
			.catch((err) => callback(err));
	}

	async getConnections (callback) {
		let self = this;

		debug('Server: getConnections method called');

		callback = callback || function (err, count) {
			if (err) {
				return Promise.reject(err);
			}

			return Promise.resolve(count);
		};

		return Promise
			.resolve()
			.then(() => callback(null, self.connections.length));
	}

	async listen (callback) {
		let self = this;

		debug('Server: listen method called');

		callback = callback || function (err, server) {
			if (err && err instanceof Error) {
				self.emit(EVENT_ERROR, err);

				return Promise.reject(err);
			}

			return Promise.resolve(server);
		};

		// remove server handle on listen if specified
		if (self.options.cleanHandleOnListen) {
			await cleanHandle(self.path);
		}

		return await new Promise(
			(resolve, reject) => {
				self.on(EVENT_ERROR, reject);

				self.server.listen(self.path, () => {
					self.emit(EVENT_LISTENING);

					debug('Server: listening on Unix domain socket: %s', self.path);

					return resolve();
				});
			})
			.then(() => callback(null, self))
			.catch((err) => callback(err));
	}
}

export default { Server };