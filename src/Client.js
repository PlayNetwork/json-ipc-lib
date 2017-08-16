import 'babel-polyfill';
import 'source-map-support/register';

import * as protocol from 'json-rpc-protocol';
import log from 'debug';
import net from 'net';

const
	DEFAULT_TIMEOUT = 5000, // 5 seconds
	EVENT_CLOSE = 'close',
	EVENT_CONNECT = 'connect',
	EVENT_DATA = 'data',
	EVENT_ERROR = 'error',
	EVENT_TIMEOUT = 'timeout';

const
	debug = log('json-ipc'),
	initOptions = (options) => {
		options = options || {};

		if (typeof options.timeout === 'undefined') {
			options.timeout = DEFAULT_TIMEOUT;
		}

		return options;
	};

export class Client {
	constructor (path, options) {
		if (!path) {
			throw new Error('path parameter is required');
		}

		debug('Client: new JSON-IPC Client: %s', path);

		this.options = initOptions(options);
		this.path = path;
	}

	async call (method, ...args) {
		if (!method || typeof method !== 'string') {
			throw new Error('method parameter is required');
		}

		let
			callback = (args && args.length && typeof args[args.length - 1] === 'function') ?
				args.splice(args.length - 1)[0] :
				function (err, result) {
					if (err && err instanceof Error) {
						debug(
							'Client: error occurred: %s (%o)',
							err.message,
							err);

						return Promise.reject(err);
					}

					return Promise.resolve(result);
				},
			request = typeof method === 'string' ?
				protocol.format.request(
					Date.now(),
					method,
					args) :
				method,
			response,
			self = this;

		return await new Promise((resolve, reject) => {
				// connect to the Unix domain socket and transmit the request
				let socket = net.createConnection(self.path, () => {
					if (socket.writable) {
						debug(
							'Client: writing message to socket connection: %o',
							request);

						socket.write(JSON.stringify(request));
					}
				});

				// set a timeout for a response from the socket
				debug('Client: setting command timeout to %dms', self.options.timeout);
				socket.setTimeout(
					self.options.timeout,
					() => {
						debug('Client: timeout occurred on socket');
						socket.destroy(new Error('timeout occurred waiting for response'));
					});

				// log when the socket is closed for discerning users...
				socket.on(EVENT_CLOSE, (withError) => {
					debug(
						'Client: socket connection with server closed (connection error: %s)',
						withError);

					// the error handler will have already responded
					if (withError) {
						return;
					}

					// resolve when a result is received
					if (response && response.result) {
						return resolve(response.result);
					}

					debug('Client: no JSON-RPC response received: %o', response);

					return resolve();
				});

				socket.on(EVENT_CONNECT, () => debug(
					'Client: socket connection established at path %s to call method: ',
					self.path,
					method));

				// handle inbound response data
				socket.on(EVENT_DATA, (data) => {
					debug('Client: response received on socket (%s)', data);

					try {
						response = JSON.parse(data);
						response = protocol.parse(response);
					} catch (ex) {
						// close the socket with Error
						return socket.destroy(ex);
					}

					debug(
						'Client: successfully parsed JSON-RPC 2.0 response for method target: %s',
						method);

					if (response.error) {
						// close the socket with Error
						return socket.destroy(response.error);
					}

					// close socket
					return socket.destroy();
				});

				socket.on('drain', () => debug('Client: drain'));

				// handle any socket communication errors
				socket.on(EVENT_ERROR, (err) => {
					debug('Client: error occurred on call: %s (%o)', err.message, err);

					// ensure the error is an instance of Error
					// v1.0.2 - fix for Errors not properly surfaced to client.call
					if (!(err instanceof Error)) {
						let caught = new Error(err.message);
						caught.code = err.code;
						err = caught;
					}

					err.message = [
						'JSON-IPC Client Exception:',
						err.message || 'unable to call remote method'].join(':');
					err.path = self.path;

					// ensure the socket is closed
					if (!socket.destroyed) {
						return socket.destroy(err);
					}

					return reject(err);
				});

				socket.on(EVENT_TIMEOUT, () => debug(
					'Client: socket timeout occurred calling method: %s', method));
			})
			.then((response) => callback(null, response))
			.catch((err) => callback(err));
	}
}

export default { Client };