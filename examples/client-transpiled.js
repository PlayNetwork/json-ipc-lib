'use strict';

require('babel-polyfill');

require('source-map-support/register');

var _dist = require('../dist');

var ipc = _interopRequireWildcard(_dist);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; } /* eslint no-console: 0 */


_asyncToGenerator(regeneratorRuntime.mark(function _callee() {
  var client, convenient;
  return regeneratorRuntime.wrap(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          // create a client for server.js
          client = new ipc.Client('/tmp/example-ipc-server.sock');

          /**
           * call the method conveniently (applies JSON-RPC formatting)
           * using async/await
           **/

          _context.prev = 1;
          _context.next = 4;
          return client.call('services.hello', 'convenient example string');

        case 4:
          convenient = _context.sent;


          console.log('result from convenient client.call: %s', convenient);
          _context.next = 11;
          break;

        case 8:
          _context.prev = 8;
          _context.t0 = _context['catch'](1);

          console.error('error from convenient client.call: %s', _context.t0.message, _context.t0);

        case 11:

          /**
           * call the method verbosely (send JSON-RPC formatted message)
           * using a traditional callback
           **/
          client.call({
            id: Date.now(),
            jsonrpc: '2.0',
            method: 'services.hello',
            params: ['verbose example string']
          }, function (err, verbose) {
            if (err) {
              console.error('error from verbose client.call: %s', err.message, err);

              return;
            }

            console.log('result from verbose client.call: %s', verbose);
          });

          /**
           * call the method conveniently with no arguments
           * using a Promise
           **/
          client.call('services.hello').then(function (noArguments) {
            return console.log('result when passing no arguments to client.call: %s', noArguments);
          }).catch(function (ex) {
            return console.error('error when passing no arguments to client.call: %s', ex.message, ex);
          });

          /**
           * call an asynchronous method and wait
           * using a Promise
           **/
          client.call('services.helloDelayed', 'testing').then(function (response) {
            return console.log('result when calling asynchronous server method via client.call: %s', response);
          }).catch(function (ex) {
            return console.error('error when calling asynchronous server method via client.call: %s', ex.message, ex);
          });

        case 14:
        case 'end':
          return _context.stop();
      }
    }
  }, _callee, undefined, [[1, 8]]);
}))();

