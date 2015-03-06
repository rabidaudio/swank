swank
=====

![build-status](https://travis-ci.org/rabidaudio/swank.svg?branch=master)

[![NPM](https://nodei.co/npm/swank.png?global=true&&downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/swank/)

#### It's `python -m SimpleHTTPServer` for Javascript, with a few extras.

The stupid simple static webserver. If you want to test local static
files (HTML, JS, CSS), simply run `swank`. It's even got livereload
and introspected tunnels built in.

Install
-------
    npm install -g swank

Usage
-----

    swank [[--ngrok | -n]] [[--watch | -w]] [[--silent]] [[--port | -p PORT]] [[ [[--path | -d]] root_directory]]

    --ngrok: pipe your server through [ngrok's](https://www.npmjs.org/package/ngrok) local tunnel
    --watch: a watch+livereload server. Includes `livereload.js` in HTML files, starts the livereload server, and watches your
      directory, causing a reload when files change
    --silent: disable logging of requests
    --port: specify the local port to use. Defaults to $PORT or 8000
    --path: the path to the root directory of the server. Defaults to the current working directory


You can also use it as a module, if you can think of any reason to.

```javascript
var defaults = {
  path: '.',
  port: 8000,
  help: false,
  ngrok: false,
  watch: false,
  log: true,
  liveReload: {}
};
require('swank')(defaults);
```

LICENSE
-------
[MIT](LICENSE)
