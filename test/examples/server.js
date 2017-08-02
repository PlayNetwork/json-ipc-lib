import 'babel-polyfill';
import 'source-map-support/register';

import * as ipc from '../../dist';

/**
 * The name of this object will act as a namespace for
 * the method argument that is provided when consuming
 * the server. This object can have multiple children
 * and unlimited hiearchy.
 **/
const services = {
  hello : (value = 'olleh') => value
};

const server = new ipc.Server(
  '/tmp/example-ipc-server.sock',
  { services });

server.listen();