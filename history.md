# v1.1.4 - 05/27/2019

* Updated error message modification through client socket. No longer prepending `JSON-IPC Client Exception::` to it.

# v1.1.3 - 02/11/2019

* Updated examples to remove references to `babel-polyfill`

# v1.1.2 - 02/11/2019

* Fixed issue in `Client` module where usage of `#call` with object was not properly stringified

# v1.1.0 - 02/05/2019

* Updated Babel dependencies

# v1.0.2 - 08/16/2017

* Fixed issue where errors encountered from the server were not properly surfaced on the `Client` instance on `#call`

# v1.0.1 - 08/16/2017

* Fixed issue where `main` definition in `package.json` was not properly defined
* Added `.coveralls.yml` and `history.md` to `.npmignore`

# v1.0.0 - 08/15/2017

* Initial release
