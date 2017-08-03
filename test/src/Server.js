import { Server } from '../../src';

describe('Server', () => {
	describe('#', () => {
		it('should require path parameter', () => {
			(function () {
				let server = new Server();
				should.not.exist(server);
			}).should.throw('path parameter is required');
		});

		it('should require methods parameter', () => {
			(function () {
				let server = new Server('/var/run/test.sock');
				should.not.exist(server);
			}).should.throw('methods parameter is required');
		});

		it('should require methods parameter be an object', () => {
			(function () {
				let server = new Server('/var/run/test.sock', 'invalid');
				should.not.exist(server);
			}).should.throw('methods parameter is required');
		});
	});
});