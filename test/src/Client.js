/* eslint no-magic-numbers:0 */
/* eslint no-unused-expressions:0 */
import { Client, Server } from '../../src';

describe('Client', () => {
	let
		mockPath = '/tmp/test.sock',
		mockServices = {
			a : {
				throwError : (message) => Promise.reject(new Error(message))
			},
			b : {
				lowerCasePromise : (val) => Promise.resolve(val.toLowerCase())
			},
			c : {
				waitToReturn : (duration, val) => new Promise((resolve) => setTimeout(
					() => resolve(val),
					duration))
			},
			d : {
				falsePromise : () => Promise.resolve(false),
				truePromise : () => Promise.resolve(true)
			}
		};

	describe('#', () => {
		it('should require path parameter', () => {
			(function () {
				let client = new Client();
				should.not.exist(client);
			}).should.throw('path parameter is required');
		});

		it('should properly default options', () => {
			let client = new Client(mockPath);

			should.exist(client.options);
			should.exist(client.options.timeout);
			client.options.timeout.should.equal(5000);
		});
	});

	describe('#call', () => {
		it('should require method', () => {
			let client = new Client(mockPath);
			client
				.call()
				.then(() => Promise.reject('expected error'))
				.catch((err) => {
					should.exist(err);
					err.message.should.contain('method parameter is required');

					return Promise.resolve();
				});
		});

		it('should handle errors from service', async () => {
			let
				client = new Client(mockPath),
				err,
				server = new Server(mockPath, mockServices);

			await server.listen();

			try {
				let result = await client.call('a.throwError', 'surface errors test');
				should.not.exist(result);
			} catch (ex) {
				err = ex;
			}

			should.exist(err);
			err.message.should.contain('surface errors test');

			await server.close();
		});

		it('should handle missing methods as an error', async () => {
			let
				client = new Client(mockPath),
				err,
				server = new Server(mockPath, mockServices);

			await server.listen();

			try {
				let result = await client.call('a.methodDoesNotExist');
				should.not.exist(result);
			} catch (ex) {
				err = ex;
			}

			should.exist(err);
			err.message.should.contain('method not found');

			await server.close();
		});

		it('should accept arguments', (done) => {
			let
				client = new Client(mockPath),
				server = new Server(mockPath, mockServices);

			server.listen();

			server.on('listening', () => {
				client.call('b.lowerCasePromise', 'TESTING', (err, val) => {
					should.not.exist(err);
					should.exist(val);
					val.should.equal('testing');

					return server.close(done);
				});
			});
		});

		it('should expose error event for connection errors', (done) => {
			let client = new Client(mockPath);

			// not calling server.listen so that there is no open socket

			client.call('a.throwError', 'test error event', (err) => {
				should.exist(err);
				err.message.should.contain('ENOENT /tmp/test.sock');

				return done();
			});
		});

		it('should support asynchronous server methods', async () => {
			let
				client = new Client(mockPath),
				server = new Server(mockPath, mockServices);

			await server.listen();

			let result = await client.call('c.waitToReturn', 100, 'testing response');

			should.exist(result);
			result.should.equal('testing response');

			await server.close();
		});

		it('should support asynchronous server methods returning boolean true', async () => {
			let
				client = new Client(mockPath),
				server = new Server(mockPath, mockServices);

			await server.listen();

			let result = await client.call('d.truePromise');

			should.exist(result);
			result.should.equal(true);

			await server.close();
		});

		it('should support asynchronous server methods returning boolean false', async () => {
			let
				client = new Client(mockPath),
				server = new Server(mockPath, mockServices);

			await server.listen();

			let result = await client.call('d.falsePromise');

			should.exist(result);
			result.should.equal(false);

			await server.close();
		});

		it('should support timeout', async () => {
			let
				client = new Client(mockPath, { timeout : 500 }),
				err,
				server = new Server(mockPath, mockServices);

			await server.listen();

			try {
				await client.call('c.waitToReturn', 1000, 'testing response');
			} catch (ex) {
				err = ex;
			}

			should.exist(err);
			err.message.should.contain('timeout occurred waiting for response');

			await server.close();
		});
	});
});
