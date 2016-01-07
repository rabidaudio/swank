swank
=====

![build-status](https://travis-ci.org/rabidaudio/swank.svg?branch=master)

[![NPM](https://nodei.co/npm/swank.png?global=true&&downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/swank/)

#### It's `python -m SimpleHTTPServer` for Javascript, with a few extras.

If you want to test local static files (HTML, JS, CSS), simply run `swank`.
It's even got livereload and introspected tunnels built in.

Install
-------
    npm install -g swank

Usage
-----
    swank [[--ngrok | -n]] [[--watch | -w]] [[--silent | -s]] [[--interval | -i SECONDS]] [[--port | -p PORT]] [[ [[--path | -d]] root_directory]]

- `--ngrok`: pipe your server through [ngrok's](https://www.npmjs.org/package/ngrok) local tunnel
- `--watch`: a watch+livereload server. Includes `livereload.js` in HTML files, starts the livereload server, and watches your directory, causing a reload when files change
- `--interval`: how often watch polls for changes. Defaults to 1 second
- `--silent`: disable logging of requests
- `--port`: specify the local port to use. Defaults to `$PORT` or `8000`
- `--path`: the path to the root directory of the server. Defaults to the current working directory


As a module
-----------

```javascript
var defaults = {
  path: '.',                              // the directory to use as root
  port: process.env.PORT || 8000,         // the port to serve on
  help: false,                            // print help and exit
  ngrok: false,                           // tunnel requests through ngrok. Set to an object to pass options to ngrok
  watch: false,                           // run a liveReload server, and inject reload script into html pages. Can be an object with child object 'opts' for options to be passed to connect-livereload
  interval: 1000,                         // how often the watch system polls for file changes
  log: {format: 'combined', opts: {}},    // enable loging of requests and errors. Format and opts are passed to morgan. set to false to silence output
};

require('swank')(defaults);               //returns a promise
```

For example, if you want to use it with [`gulp`](http://gulpjs.com):

```javascript
var gulp = require('gulp');
var swank = require('swank');

gulp.task('serve', function(cb){
  swank({
    watch: true,
    path: 'dist'
  }).then(function(s){
    console.log('Server running: '+s.url);
    cb();
  });
});
```

As middleware
-------------

```js
var express = require('express');
var Swank = require('swank').Swank;
var http = require('http');

var app = express();

app.get('/', function (req, res) {
  res.send('Hello World!');
});

var middleware = new Swank({log: false, watch: true});
app.use(middleware);

var server = http.createServer(app);

middleware.listenTo(server); //required for watch or ngrok functionality

server.listen(8080); // will automatically start/stop watch or ngrok servers as required
```

LICENSE
-------
[MIT](LICENSE)
