/* eslint no-console: 0 */
import * as ipc from '../dist';

(async () => {
  // create a client for server.js
  const client = new ipc.Client('/tmp/example-ipc-server.sock');

  /**
   * call the method conveniently (applies JSON-RPC formatting)
   * using async/await
   **/
  try {
    let convenient = await client.call(
      'services.hello',
      'convenient example string');

    console.log(
      'result from convenient client.call: %s',
      convenient);
  } catch (ex) {
    console.error(
      'error from convenient client.call: %s',
      ex.message,
      ex);
  }

  /**
   * call the method verbosely (send JSON-RPC formatted message)
   * using a traditional callback
   **/
  client.call({
		id : Date.now(),
    jsonrpc : '2.0',
    method : 'services.hello',
    params : ['verbose example string']
  }, (err, verbose) => {
    if (err) {
      console.error(
        'error from verbose client.call: %s',
        err.message,
        err);

        return;
    }

    console.log(
      'result from verbose client.call: %s',
      verbose);
  });

  /**
   * call the method conveniently with no arguments
   * using a Promise
   **/
  client
    .call('services.hello')
    .then((noArguments) => console.log(
      'result when passing no arguments to client.call: %s',
      noArguments))
    .catch((ex) => console.error(
      'error when passing no arguments to client.call: %s',
      ex.message,
      ex));

  /**
   * call an asynchronous method and wait
   * using a Promise
   **/
  client
  .call('services.helloDelayed', 'testing')
  .then((response) => console.log(
    'result when calling asynchronous server method via client.call: %s',
    response))
  .catch((ex) => console.error(
    'error when calling asynchronous server method via client.call: %s',
    ex.message,
    ex));
})();