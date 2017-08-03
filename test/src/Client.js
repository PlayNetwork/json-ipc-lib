import { Client } from '../../src';

describe('Client', () => {
	describe('#', () => {
		it('should require path parameter', () => {
			(function () {
				let client = new Client();
				should.not.exist(client);
			}).should.throw('path parameter is required');
		});
	});
});