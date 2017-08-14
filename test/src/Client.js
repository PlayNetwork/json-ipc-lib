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
				asyncLowerCase : (val) => new Promise(
					(resolve) => setTimeout(
						() => resolve(val.toLowerCase()), 500))
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
				server = new Server(mockPath, mockServices);

			await server.listen();

			try {
				let result = await client.call('a.throwError', 'surface errors test');
				should.not.exist(result);
			} catch (ex) {
				should.exist(ex);
				ex.message.should.contain('surface errors test');
			}

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
	});
});