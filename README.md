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
- `--interval`: watch interval. Defaults to 1s
- `--silent`: disable logging of requests
- `--port`: specify the local port to use. Defaults to `$PORT` or `8000`
- `--path`: the path to the root directory of the server. Defaults to the current working directory


You can also use it as a module.

```javascript
var defaults = {
  path: '.',
  port: 8000,
  help: false,
  ngrok: false,
  watch: false,
  interval: 1000,
  log: true,
  liveReload: {}
};
require('swank')(defaults);
```

For example, if you want to use it with [`gulp`](http://gulpjs.com):

```javascript
var gulp = require('gulp');
var swank = require('swank');

gulp.task('serve', function(cb){
  swank({
    watch: true,
    path: 'dist'
  }, function(err, warn, url){
    console.log('Server running: '+url);
    cb();
  });
});


```

LICENSE
-------
[MIT](LICENSE)
