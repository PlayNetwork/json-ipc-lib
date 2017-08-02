# JSON IPC

This library exists to facilitate creation and consumption of Unix domain socket based interprocess communication channels that opinionatingly use JSON-RPC 2.0 as a communication protocol. This library takes care of the plumbing and error handling and provides a simple interface to speed up development.

## Getting Started

### Install

```bash
npm install --save json-ipc-lib
```

### Quick Start

#### Create a server

Below is an example where we create a file named `server.js` and populate it with the following code:

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

#### Create a client

Next up, we create an example of consuming the server from the example above. We create a file named `client.js` and put the following code in it:

```javascript
import * as ipc from 'json-ipc-lib';

(async () => {
  // create a client for server.js
  const client = new ipc.Client('/tmp/my-server.sock');

  /**
   * call the method conveniently (applies JSON-RPC formatting)
   **/
  let convenient = await client.call(
    'services.hello',
    'convenient example string');

  console.log(
    'result from convenient client.call: %s',
    convenient);

  /**
   * call the method verbosely (send JSON-RPC formatted message)
   **/
  let verbose = await client.call({
    jsonrpc : '2.0',
    method : 'services.hello',
    params : ['verbose example string'],
    id : Date.now()
  });

  console.log(
    'result from verbose client.call: %s',
    verbose);

  /**
   * call the method conveniently with no arguments
   **/
  let noArguments = await client.call('services.hello');

  console.log(
    'result when passing no arguments to client.call: %s',
    noArguments);
})();
```

In a separate terminal window, we run as follows:

```bash
$ DEBUG=json-ipc node client.js
result from convenient client.call: convenient example string
result from verbose client.call: verbose example string
result when passing no arguments to client.call: olleh
```

### Documentation

#### Client

`new ipc.Client(path, options)`

##### path (required)

##### options (optional)

* `timeout` (`Number`, defaults to `5000`): the amount of time, in milliseconds, before the `call` method will timeout (a timeout results in an error response)

#### Server

`new ipc.Server(path, methods, options)`

##### path (required)

##### methods (required)

##### options (optional)

* `cleanHandleOnListen` (`Boolean`, defaults to `true`): when true, the `#listen()` method will attempt to remove the Unix domain socket handle prior to creating a new one for listening