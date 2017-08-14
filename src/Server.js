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
			debug('no available remote methods available for execution');
			return;
		}

		if (!requestedMethod) {
			debug('no remote execution method specified in message');
			return;
		}

		if (excludedMethods.indexOf(requestedMethod) >= 0) {
			debug('method specified in message is excluded from remote execution');
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
			debug('writing response to socket: %s', message);
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

		debug('new JSON-IPC Server: %s', path);

		this._listening = false;
		this.connections = [];
		this.methods = methods;
		this.options = initOptions(options);
		this.path = path;
		this.server = net
			.createServer()
			.on(EVENT_CONNECTION, (socket) => {
				debug('new socket connection detected');
				socket.setEncoding(DEFAULT_ENCODING);
				socket.on(EVENT_READABLE, () => this._handleConnection(socket));
			})
			.on(EVENT_ERROR, (err) => {
				debug(
					'error occurred in JSON-IPC Server: %s (%o)',
					err.message,
					err);

				this.emit(EVENT_ERROR, err);
			})
			.on(EVENT_LISTENING, () => (this._listening = true));
	}

	_handleConnection (socket) {
		let
			existingSocketIndex = this.connections.findIndex(
				(element) => element === socket),
			message,
			methodTarget,
			request,
			result,
			self = this;

		// emit the connection event for new connections
		if (existingSocketIndex < 0) {
			self.emit(EVENT_CONNECTION, socket);
			self.connections.push(socket);

			// remove the connection once the socket has closed
			socket.on(EVENT_CLOSE, () => {
				let index = self.connections.findIndex(
					(element) => element === socket);

				if (index >= 0) {
					self.connections.splice(index, 1);
				}
			});
		}

		while ((message = socket.read()) !== null) {
			debug('message received on socket', message);

			// attempt to parse the inbound JSON-RPC 2.0 message
			try {
				request = protocol.parse(JSON.parse(message));
			} catch (ex) {
				self.emit(EVENT_ERROR, ex);
				return jsonRpcResponse(socket, ex);
			}

			debug(
				'successfully parsed JSON-RPC 2.0 message, method target: %s',
				request.method);

			// emit the request event
			self.emit(EVENT_REQUEST, request);

			// determine the actual method to invoke
			methodTarget = getMethodTarget(
				self.methods,
				self.options.excludedMethods,
				request.method);

			// ensure we have a valid method to execute
			if (!methodTarget) {
				self.emit(EVENT_ERROR, new Error('method target not found'));
				return jsonRpcResponse(
					socket,
					protocol.format.error(
						request.id,
						new protocol.MethodNotFound(request.method)));
			}

			// validate params (if provided) ... only supports Array at this point
			if (request.params && !Array.isArray(request.params)) {
				return jsonRpcResponse(
					socket,
					protocol.format.error(
						request.id,
						new protocol.InvalidParameters('parameters must be an array')));
			}

			// attempt to execute the method
			try {
				result = methodTarget.apply(null, request.params);
			} catch (ex) {
				self.emit(EVENT_ERROR, ex);
				return jsonRpcResponse(
					socket,
					protocol.format.error(
						request.id,
						new protocol.JsonRpcError(ex.message)));
			}

			// handle the result of the method when it returns a Promise
			if (result && result.then && typeof result.then === 'function') {
				/* eslint no-loop-func: 0*/
				return result
					.then((result) => jsonRpcResponse(
						socket,
						protocol.format.response(request.id, result)))
					.catch((err) => {
						self.emit(EVENT_ERROR, err);
						return jsonRpcResponse(
							socket,
							protocol.format.error(
								request.id,
								new protocol.JsonRpcError(err.message)));
					});
			}

			// handle the result of the method when not a Promise...
			return jsonRpcResponse(
				socket,
				protocol.format.response(request.id, result));
		}
	}

	async close (callback) {
		let self = this;

		callback = callback || function (err) {
			if (err && err instanceof Error) {
				self.emit(EVENT_ERROR, err);

				return Promise.reject(err);
			}

			return Promise.resolve(self);
		};

		// error out if not listening...
		if (!self._listening) {
			return Promise
				.resolve()
				.then(() => callback(new Error('server is not listening')));
		}

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

					debug('listening on Unix domain socket: %s', self.path);

					return resolve();
				});
			})
			.then(() => callback(null, self))
			.catch((err) => callback(err));
	}
}

export default { Server };