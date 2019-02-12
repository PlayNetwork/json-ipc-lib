"use strict";

var _interopRequireWildcard = require("@babel/runtime-corejs2/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime-corejs2/helpers/interopRequireDefault");

var _promise = _interopRequireDefault(require("@babel/runtime-corejs2/core-js/promise"));

var ipc = _interopRequireWildcard(require("../dist"));

/**
 * The name of this object will act as a namespace for
 * the method argument that is provided when consuming
 * the server. This object can have multiple children
 * and unlimited hiearchy.
 **/
var DELAY = 1000,
    services = {
  hello: function hello() {
    var value = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'olleh';
    return value;
  },
  helloDelayed: function helloDelayed() {
    var value = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'olleh';
    return new _promise.default(function (resolve) {
      return setTimeout(function () {
        return resolve(value);
      }, DELAY);
    });
  }
};
var server = new ipc.Server('/tmp/example-ipc-server.sock', {
  services: services
});
server.listen();