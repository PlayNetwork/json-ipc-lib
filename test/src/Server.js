/* eslint no-magic-numbers:0 */
/* eslint no-unused-expressions:0 */
import { Client, Server } from '../../src';

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
		};

	describe('#', () => {
		it('should require path parameter', () => {
			(function () {
				let server = new Server();
				should.not.exist(server);
			}).should.throw('path parameter is required');
		});

		it('should require methods parameter', () => {
			(function () {
				let server = new Server(mockPath);
				should.not.exist(server);
			}).should.throw('methods parameter is required');
		});

		it('should require methods parameter be an object', () => {
			(function () {
				let server = new Server(mockPath, 'invalid');
				should.not.exist(server);
			}).should.throw('methods parameter is required');
		});

		it('should properly default options', () => {
			let server = new Server(mockPath, mockServices);

			should.exist(server.options);
			server.options.cleanHandleOnListen.should.be.true;
			server.options.excludedMethods.should.have.length(0);
		});
	});

	describe('#close', () => {
		it('should return an Error if server is not listening', () => {
			let server = new Server(mockPath, mockServices);

			return server
				.close()
				.then(() => Promise.reject(new Error('expected an error')))
				.catch((err) => {
					should.exist(err);
					err.message.should.contain('server is not listening');
				});
		});

		it('should support callbacl', (done) => {
			let server = new Server(mockPath, mockServices);

			server.close((err) => {
				should.exist(err);
				err.message.should.contain('server is not listening');

				return done();
			});
		});

		it('should emit close event', (done) => {
			let server = new Server(mockPath, mockServices);
			server.listen(() => {
				server.on('close', done);
				server.close();
			});
		});

		it('should close connections on close', (done) => {
			let server = new Server(mockPath, mockServices);
			server.listen(() => {
				server.connections.push({
					end : done
				});

				server.close();
			});
		});
	});

	describe('#getConnections', () => {
		// should support callback

		// should return 0 with no connections

		// should return count of active connections
	});

	describe('#listen', () => {
		it('should support callback', (done) => {
			let server = new Server(mockPath, mockServices);
			server.listen((err) => {
				should.not.exist(err);
				return server.close(done);
			});
		});

		it('should emit listening event', (done) => {
			let server = new Server(mockPath, mockServices);
			server.listen();
			server.on('listening', () => {
				return server.close(done);
			});
		});

		it('should emit connection event', (done) => {
			let server = new Server(mockPath, mockServices);

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

		it('should emit connection event', (done) => {
			let server = new Server(mockPath, mockServices);

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

		// should track active connections
	});
});