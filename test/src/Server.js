/* eslint no-magic-numbers:0 */
/* eslint no-unused-expressions:0 */
import { Client, Server } from '../../src';
import chai from 'chai';
import fs from 'fs';

const should = chai.should();

describe('Server', () => {
	let
		mockPath = '/tmp/test.sock',
		mockServices = {
			a : {
				lowerCase : (val) => val.toLowerCase()
			},
			b : {
				lowerCasePromise : (val) => Promise.resolve(val.toLowerCase())
			},
			c : {
				asyncLowerCase : (val) => new Promise(
					(resolve) => setTimeout(
						() => resolve(val.toLowerCase()), 500))
			}
		},
		server;

	after(() => {
		process.exit(0);
	});

	describe('#', () => {
		afterEach(async () => {
			if (server && server._listening) {
				await server.close();
			}
		});

		it('should require path parameter', () => {
			(function () {
				server = new Server();
				should.not.exist(server);
			}).should.throw('path parameter is required');
		});

		it('should require methods parameter', () => {
			(function () {
				server = new Server(mockPath);
				should.not.exist(server);
			}).should.throw('methods parameter is required');
		});

		it('should require methods parameter be an object', () => {
			(function () {
				server = new Server(mockPath, 'invalid');
				should.not.exist(server);
			}).should.throw('methods parameter is required');
		});

		it('should properly default options', () => {
			server = new Server(mockPath, mockServices);

			should.exist(server.options);
			server.options.cleanHandleOnListen.should.be.true;
			server.options.excludedMethods.should.have.length(0);
		});
	});

	describe('#close', () => {
		afterEach(async () => {
			if (server && server._listening) {
				await server.close();
			}
		});

		it('should return an Error if server is not listening', () => {
			server = new Server(mockPath, mockServices);

			return server
				.close()
				.then(() => Promise.reject(new Error('expected an error')))
				.catch((err) => {
					should.exist(err);
					err.message.should.contain('server is not listening');
				});
		});

		it('should support callback', (done) => {
			server = new Server(mockPath, mockServices);

			server.close((err) => {
				should.exist(err);
				err.message.should.contain('server is not listening');

				return done();
			});
		});

		it('should emit close event', (done) => {
			server = new Server(mockPath, mockServices);
			server.listen(() => {
				server.on('close', done);
				server.close();
			});
		});

		it('should close connections on close', (done) => {
			server = new Server(mockPath, mockServices);
			server.listen(() => {
				server.connections.push({
					end : done
				});

				server.close();
			});
		});
	});

	describe('#getConnections', () => {
		afterEach(async () => {
			if (server && server._listening) {
				await server.close();
			}
		});

		it('should support callback', (done) => {
			server = new Server(mockPath, mockServices);

			server.listen(() => {
				let client = new Client(mockPath);
				client.call('b.lowerCasePromise', 'TESTING');
			});

			server.on('connection', () => {
				return server.getConnections((err, count) => {
					should.not.exist(err);
					should.exist(count);
					count.should.equal(1);

					return server.close(done);
				});
			});
		});

		it('should return 0 with no connections', async () => {
			// setup the server
			server = new Server(mockPath, mockServices);
			await server.listen();

			let count = await server.getConnections();
			should.exist(count);
			count.should.equal(0);

			// close the server
			await server.close();
		});
	});

	describe('#listen', () => {
		afterEach(async () => {
			if (server && server._listening) {
				await server.close();
			}
		});

		it('should support callback', (done) => {
			server = new Server(mockPath, mockServices);
			server.listen((err) => {
				should.not.exist(err);
				return server.close(done);
			});
		});

		it('should pass through error on listen', async () => {
			server = new Server(
				'/no/path/exists/to/this/location',
				mockServices);

			// attempt to listen... catch the error
			return await server
				.listen()
				.then(() => Promise.reject('expected an Error'))
				.catch((err) => {
					should.exist(err);
					err.message.should.contain('EACCES');

					return Promise.resolve();
				});
		});

		it('should pass through error on listen (callback)', (done) => {
			server = new Server(
				'/no/path/exists/to/this/location',
				mockServices);

			// attempt to listen... catch the error
			server.listen((err) => {
				should.exist(err);
				err.message.should.contain('EACCES');

				return done();
			});
		});

		it('should not remove existing socket file if specified', async () => {
			server = new Server(
				mockPath,
				mockServices,
				{ cleanHandleOnListen : false });

			// create a file...
			await new Promise(
				(resolve, reject) => fs.appendFile(
					mockPath,
					'test',
					(err) => {
						if (err) {
							return reject(err);
						}

						return resolve();
					}));

			// attempt to listen... catch the error
			return await server
				.listen()
				.then(() => Promise.reject('expected an Error'))
				.catch((err) => {
					should.exist(err);
					err.message.should.contain('EADDRINUSE');

					return Promise.resolve();
				});
		});

		it('should emit listening event', (done) => {
			server = new Server(mockPath, mockServices);
			server.listen();
			server.on('listening', () => {
				return server.close(done);
			});
		});

		it('should emit connection event', (done) => {
			server = new Server(mockPath, mockServices);

			server.listen(() => {
				let client = new Client(mockPath);
				client.call('b.lowerCasePromise', 'TESTING');
			});

			server.on('connection', (socket) => {
				should.exist(socket);
				should.exist(socket._readableState);
				socket._readableState.defaultEncoding.should.equal('utf8');
				return server.close(done);
			});
		});

		it('should emit request event', (done) => {
			server = new Server(mockPath, mockServices);

			server.listen(() => {
				let client = new Client(mockPath);
				client.call('b.lowerCasePromise', 'TESTING');
			});

			server.on('request', (request) => {
				should.exist(request);
				request.jsonrpc.should.equal('2.0');
				request.method.should.equal('b.lowerCasePromise');
				request.params[0].should.equal('TESTING');
				should.exist(request.id);

				return server.close(done);
			});
		});

		it('should track connections', (done) => {
			server = new Server(mockPath, mockServices);

			server.listen(() => {
				let client = new Client(mockPath);
				client.call('b.lowerCasePromise', 'TESTING');
			});

			// after socket is closed, ensure 0 connections (Promise)
			server.on('connection', (socket) => {
				return socket.on('end', () => {
					return new Promise(
						(resolve) => {
							setTimeout(resolve, 500);
						})
						.then(() => server.getConnections())
						.then((count) => {
							should.exist(count);
							count.should.equal(0);

							done();
						});
				});
			});

			// once request is received, ensure 1 connection (callback)
			server.on('request', () => {
				return server.getConnections((err, count) => {
					should.not.exist(err);
					should.exist(count);
					count.should.equal(1);
				});
			});
		});
	});
});