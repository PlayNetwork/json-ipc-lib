import * as ipc from '../dist';

/**
 * The name of this object will act as a namespace for
 * the method argument that is provided when consuming
 * the server. This object can have multiple children
 * and unlimited hiearchy.
 **/
const
  DELAY = 1000,
  services = {
    hello : (value = 'olleh') => value,
    helloDelayed : (value = 'olleh') =>
      new Promise((resolve) => setTimeout(() => resolve(value), DELAY))
  };

const server = new ipc.Server(
  '/tmp/example-ipc-server.sock',
  { services });

server.listen();