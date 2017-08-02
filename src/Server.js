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
	EVENT_CONNECTION = 'connection',
	EVENT_ERROR = 'error',
	EVENT_READABLE = 'readable',
	EVENT_REQUEST= 'request';

const
	cleanHandle = (path) => fs.unlink((path), () => Promise.resolve()),
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
		super();

		debug('new JSON-IPC Server: %s', path);

		this.methods = methods;
		this.options = initOptions(options);
		this.path = path;
		this.server = net
			.createServer()
			.on(EVENT_CONNECTION, (socket) => {
				debug('new socket connection detected');
				socket.setEncoding(DEFAULT_ENCODING);
				socket.on(EVENT_READABLE, () => this._readMessage(socket));
			})
			.on(EVENT_ERROR, (err) => debug(
				'error occurred in JSON-IPC Server: %s (%o)',
				err.message,
				err));
	}

	async listen (callback) {
		callback = callback || function (err, server) {
			if (err && err instanceof Error) {
				self.emit(EVENT_ERROR, err);

				return Promise.reject(err);
			}

			return Promise.resolve(server);
		};

		let self = this;

		// remove server handle on listen if specified
		if (self.options.cleanHandleOnListen) {
			await cleanHandle(self.path);
		}

		return await new Promise((resolve, reject) => self.server.listen(self.path, (err) => {
				if (err) {
					err.message = [
						'JSON-IPC Server Exception:',
						err.message || 'unable to start server'].join(':');
					err.path = self.path;

					self.emit(EVENT_ERROR, err);
					return reject(err);
				}

				debug('listening on Unix domain socket: %s', self.path);

				return resolve();
			}))
			.catch((err) => callback(err))
			.then(() => callback(null, self));
	}

	_readMessage (socket) {
		let
			message,
			methodTarget,
			request,
			result,
			self = this;

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
}

export default { Server };