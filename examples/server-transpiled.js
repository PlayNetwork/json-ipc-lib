'use strict';

require('babel-polyfill');

require('source-map-support/register');

var _dist = require('../../dist');

var ipc = _interopRequireWildcard(_dist);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

/**
 * The name of this object will act as a namespace for
 * the method argument that is provided when consuming
 * the server. This object can have multiple children
 * and unlimited hiearchy.
 **/
var services = {
  hello: function hello() {
    var value = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'olleh';
    return value;
  }
};

var server = new ipc.Server('/tmp/example-ipc-server.sock', { services: services });

server.listen();

