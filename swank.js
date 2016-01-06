'use strict';

var path        = require('path');
var os          = require('os');
var url         = require('url');
var http        = require('http');
var connect     = require('connect');
var serveStatic = require('serve-static');
var morgan      = require('morgan');
var liveReload  = require('connect-livereload');
var tinylr      = require('tiny-lr');
var watch       = require('watch');
var ngrok       = require('ngrok');
var nopt        = require('nopt');
var colors      = require('colors');
var Promise     = require('bluebird');

/*
  Takes in an object like this (all optional, defaults shown):
    {
      path: '.',
      port: 8000,
      help: false,
      ngrok: false,
      watch: false,
      log: true,
      app: null,
      liveReload: {}
    }

  Returns a Promise:
    fufilled: ({url, app})
    rejected: (error)
*/
var serve = function (opts){

  opts = opts || {};

  //start by returning usage info if requested
  if(opts.help && opts.console){
    console.log(
      'Usage: swank [[--ngrok | -n]] [[--watch | -w]] [[--silent]] [[--interval | -i SECONDS]] [[--port | -p PORT]] [[ [[--path | -d]] root_directory]]\n\n'+
      '--ngrok: pipe your server through [ngrok\'s](https://www.npmjs.org/package/ngrok) local tunnel\n'+
      '--watch: a watch+livereload server. Includes `livereload.js` in HTML files, starts the livereload server, and watches your'+
        'directory, causing a reload when files change\n'+
      '--interval: watch interval. Defaults to 1s\n'+
      '--silent: disable logging of requests\n'+
      '--port: specify the local port to use. Defaults to $PORT or 8000\n'+
      '--path: the path to the root directory of the server. Defaults to the current working directory\n\n'
    );
    return;
  }

  //defaults
  var dir  = opts.path || process.cwd(); //default to CWD
  var port = opts.port || process.env.PORT || 8000;
  var host = 'localhost';
  var log  = (opts.log === undefined ? (opts.console ? true : false) : opts.log);

  var liveReloadOpts = opts.liveReload || {};
  var interval = opts.interval || 1000;

  if(opts.ngrok && opts.watch){
    if(liveReloadOpts.port && opts.console && opts.log){
      console.log(('The liveReload port supplied has been overwritten as the ngrok option was also supplied '+
        'and for both to function, liveReload must use the same port as the app.').yellow);
    }
    liveReloadOpts.port = port;
  }else{
    liveReloadOpts.port = liveReloadOpts.port || 35729;
  }

  // console.log(opts, dir, host, log, liveReloadOpts, interval);

  return new Promise(function (resolve, reject){

    //start server
    var app = opts.app || connect();

    var liveReloadServer = null;

    if(log){
      app.use(morgan('combined'));
    }

    // liveReload injection needs to come before serveStatic
    if(opts.watch){
      //inject script into pages
      app.use(liveReload(liveReloadOpts));
    }

    // actualy serve files
    app.use(serveStatic(dir));

    if(opts.watch){

      if(opts.ngrok){
        //use the same port
        liveReloadServer = tinylr.middleware({ app: app });
        app.use(liveReloadServer);
        if(opts.console && opts.log){
          console.log(('Note that there are some consequences to using both watch and ngrok at the same time. '+
            'Live reload will not work if your app responds to GET /connect already.').yellow);
        }
      }else{
        liveReloadServer = tinylr();
        liveReloadServer.listen(liveReloadOpts.port); // TODO wait until listening with 'error' listener
      }

      var lastChangeRequest = new Date().valueOf();
      var WATCH_TIMEOUT = 500;

      //when a file changes, cause a reload
      watch.watchTree(dir, { interval: interval }, function (f, curr, prev) {
        if (typeof f === 'object' && prev === null && curr === null) {
         // Finished walking the tree
        } else {
          var liveReloadURL = url.format({
            protocol: 'http',
            hostname: host,
            port: liveReloadOpts.port,
            pathname: '/changed',
            query: {files: f}
          });

          if(log){
            console.log(('File changed: '+f).blue);
          }

          var now = new Date().valueOf();
          if(now > lastChangeRequest + WATCH_TIMEOUT){
            //if too many file changes happen at once, it can crash tinylr, so this is hacky rate-limiting
            lastChangeRequest = now;
            http.get(liveReloadURL); //tell tinylr what pages changed
          }
        }
      });
    }

    var server = http.createServer(app);

    if(opts.watch){
      // when the main server is closed, also close the liveReload server
      server.addListener('close', function(){
        liveReloadServer.close();
      });
    }

    server.listen(port);

    if(opts.ngrok){
      ngrok.connect({port: port}, function (err, u){
        if(err){
          reject(err);
        }else{
          resolve({url: u, port: port, server: server, app: app, liveReloadServer: liveReloadServer});
        }
      });
    }else{
      var u = url.format({
        protocol: 'http',
        hostname: host,
        port: port
      });
      resolve({url: u, port: port, server: server, app: app, liveReloadServer: liveReloadServer});
    }
  });
};

// TODO act as middleware, allowing for the same options as serve-static (and passing those opts to serve-static) //https://github.com/expressjs/serve-static
// serve.middleware = function (opts){ return function (req, res, next){};};

// run with command line arguments
serve.processArgs = function (){
  var knownOpts = {
    'port'     : Number,
    'path'     : path,
    'help'     : Boolean,
    'log'      : Boolean,
    'ngrok'    : Boolean,
    'watch'    : Boolean,
    'interval' : Number
  };

  var shortHands = {
    'p': '--port',
    'd': '--path',
    'h': '--help',
    'l': '--log',
    'n': '--ngrok',
    'w': '--watch',
    'i': '--interval',
    's': '--no-log',
    'silent': '--no-log',
    'usage': '--help'
  };

  var opts = nopt(knownOpts, shortHands);
  opts.console = true; // run from the command-line

  //take path if not given explicitly
  if(!opts.path && opts.argv.remain.length > 0){
    opts.path = path.resolve(opts.argv.remain.join(' '));
  }

  serve(opts)
    .then(function (res){
      console.log(('\n>  '+res.url+'\n\n').green);
    })
    .catch(function (err){
      console.log(err.toString().red);
    });
};

module.exports = serve;
