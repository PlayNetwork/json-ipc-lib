import 'babel-polyfill';
import 'source-map-support/register';

import * as protocol from 'json-rpc-protocol';
import EventEmitter from 'events';
import log from 'debug';
import net from 'net';

const
	DEFAULT_TIMEOUT = 5000, // 5 seconds
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

export class Client extends EventEmitter {
	constructor (path, options) {
		if (!path) {
			throw new Error('path parameter is required');
		}

		super();

		debug('new JSON-IPC Client: %s', path);

		this.options = initOptions(options);
		this.path = path;
	}

	async call (method, ...args) {
		let
			callback = (args && args.length && typeof args[args.length - 1] === 'function') ?
				args.splice(args.length - 1)[0] :
				function (err, result) {
					if (err) {
						debug(
							'error occurred in JSON-IPC Client: %s (%o)',
							err.message,
							err);

						self.emit(EVENT_ERROR, err);

						return Promise.reject(err);
					}

					return Promise.resolve(result);
				},
			chunks = [],
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
							'writing message to socket connection: %o',
							request);

						socket.write(JSON.stringify(request));
					}
				});

				// set a timeout for a response from the socket
				socket.setTimeout(self.options.timeout);

				// handle inbound response data
				socket.on(EVENT_DATA, (data) => {
					chunks.push(data);

					try {
						response = JSON.parse(chunks.join(''));
						response = protocol.parse(response);
					} catch (ex) {
						debug(
							'unable to fully process message - more data may be awaiting receipt: %s',
							ex.message);

						return;
					}

					// end the socket connection
					socket.end();

					if (response.error) {
						let err = new Error([
							'JSON-IPC Client Exception',
							response.error.message].join(':'));
						err.code = response.error.code;
						err.method = response.error.data;

						debug('error occurred in JSON-IPC Client: %s (%o)', err.message, err);

						return reject(err);
					}

					return resolve(response.result);
				});

				// handle any socket communication errors
				socket.on(EVENT_ERROR, (err) => {
					err.message = [
						'JSON-IPC Client Exception:',
						err.message || 'unable to call remote method'].join(':');
					err.path = self.path;

					debug('error occurred in JSON-IPC Client: %s (%o)', err.message, err);

					return reject(err);
				});

				// handle the timeout
				socket.on(EVENT_TIMEOUT, () => {
					let err = new Error(
						'JSON-IPC Client Exception: timeout occurred communicating with server');
					err.path = self.path;
					err.request = request;

					debug('timeout occurred in JSON-IPC Client: %s (%o)', err.message, err);

					return reject(err);
				});
			})
			.catch((err) => callback(err))
			.then((response) => callback(null, response));
	}
}

export default { Client };