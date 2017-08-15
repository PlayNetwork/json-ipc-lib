# JSON IPC

[![Build Status](https://travis-ci.org/PlayNetwork/json-ipc-lib.svg?branch=master)](https://travis-ci.org/PlayNetwork/json-ipc-lib) [![Coverage Status](https://coveralls.io/repos/github/PlayNetwork/json-ipc-lib/badge.svg)](https://coveralls.io/github/PlayNetwork/json-ipc-lib)

This library exists to facilitate creation and consumption of Unix domain socket based interprocess communication channels that opinionatingly use JSON-RPC 2.0 as a communication protocol. This library takes care of the plumbing and error handling and provides a simple interface to speed up development.

## Getting Started

### Install

```bash
npm install --save json-ipc-lib
```

### Create a server

Below is an example where we create a file named `server.js` and populate it with the following code (available at ![./test/examples/server.js](./test/examples/server.js)):

```javascript
import * as ipc from 'json-ipc-lib';

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
  '/tmp/my-server.sock',
  { services });

// begin listening for messages
server.listen();
```

In a terminal window, we run as follows:

```bash
$ DEBUG=json-ipc node server.js
```

### Create a client

Next up, we create an example of consuming the server from the example above. We create a file named `client.js` and put the following code in it (available at ![./test/examples/client.js](./test/examples/client.js)):

```javascript
import 'babel-polyfill';
import 'source-map-support/register';

import * as ipc from '../../dist';

(async () => {
  // create a client for server.js
  const client = new ipc.Client('/tmp/example-ipc-server.sock');

  /**
   * call the method conveniently (applies JSON-RPC formatting)
   * - this example is using async/await
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
   * - this example is using a traditional callback
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
   * - this example is using a Promise
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
})();
```

In a separate terminal window, we run as follows:

```bash
$ DEBUG=json-ipc node client.js
  json-ipc new JSON-IPC Client: /tmp/example-ipc-server.sock +0ms
  json-ipc writing message to socket connection: '{"jsonrpc":"2.0","method":"services.hello","params":["convenient example string"],"id":1501772950481}' +6ms
result from convenient client.call: convenient example string
  json-ipc writing message to socket connection: { id: 1501772950505, jsonrpc: '2.0', method: 'services.hello', params: [ 'verbose example string' ] } +22ms
  json-ipc writing message to socket connection: '{"jsonrpc":"2.0","method":"services.hello","params":[],"id":1501772950506}' +2ms
result from verbose client.call: verbose example string
result when passing no arguments to client.call: olleh
```

## Documentation

### Client

`new ipc.Client(path, options)`

#### arguments

* `path` - `String`, value is `required` (i.e. `/var/run/my-service.sock`): String path on the file system to the location of the Unix domain socket file (or named pipe).
* `options` - `Object`, value is optional:
  * `timeout` - `Number`, defaults to `5000`: The amount of time, in milliseconds, before the `call` method will timeout (a timeout results in an error response).

### Server

`new ipc.Server(path, methods, options)`

#### arguments

* `path` - `String`, value is `required` (i.e. `/var/run/my-service.sock`): String path on the file system to the location of the Unix domain socket file (or named pipe).
* `methods` - `Object`, value is `required` (i.e. `{ services : { lowerCaseEcho : (val) => val.toLowerCase() } }`): An object, that may optionally have additional sub-objects, that maintains a list of remote methods available for execution. In the example, this field is an `Object` named `services` with a single `function` named `lowerCaseEcho` - this example translates to a JSON-RPC 2.0 method value of `services.lowerCaseEcho`
* `options` - `Object`, value is `optional`:
  * `cleanHandleOnListen` - (`Boolean`, defaults to `true`): Ehen true, the `#listen()` method will attempt to remove the Unix domain socket handle prior to creating a new one for listening
  * `excludedMethods` - (`Array`, defaults to `[]`): My contain a list of strings that filter which methods are available for remote execution - this may come in handy when exposing an entire module, but there is a desire to hide certain functions from remote consumers.