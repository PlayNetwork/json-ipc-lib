"use strict";

var _interopRequireWildcard = require("@babel/runtime-corejs2/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime-corejs2/regenerator"));

var _now = _interopRequireDefault(require("@babel/runtime-corejs2/core-js/date/now"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime-corejs2/helpers/asyncToGenerator"));

var ipc = _interopRequireWildcard(require("../dist"));

/* eslint no-console: 0 */
(0, _asyncToGenerator2.default)(
/*#__PURE__*/
_regenerator.default.mark(function _callee() {
  var client, convenient;
  return _regenerator.default.wrap(function _callee$(_context) {
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
          _context.t0 = _context["catch"](1);
          console.error('error from convenient client.call: %s', _context.t0.message, _context.t0);

        case 11:
          /**
           * call the method verbosely (send JSON-RPC formatted message)
           * using a traditional callback
           **/
          client.call({
            id: (0, _now.default)(),
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
        case "end":
          return _context.stop();
      }
    }
  }, _callee, this, [[1, 8]]);
}))();