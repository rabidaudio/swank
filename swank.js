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
var Promise     = require("bluebird");


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

  Returns a  Promise:
    fufilled: (url, app)
    rejected: (error)
*/
var serve = function(opts){

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
  liveReloadOpts.port = liveReloadOpts.port || 35729;

  return new Promise(function(resolve, reject){

    //start server
    var app = opts.app || connect();

    if(log){
      app.use(morgan('combined'));
    }

    if(opts.watch){
      app.use(liveReload(liveReloadOpts));                    //inject script into pages

      tinylr().listen(liveReloadOpts.port, function (){        //start respond server
        var last_change_request = new Date().valueOf();
        var WATCH_TIMEOUT = 500;

        watch.watchTree(dir, { interval: interval }, function (f, curr, prev) {      //when a file changes, cause a reload
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
            if(now > last_change_request + WATCH_TIMEOUT){
              //if too many file changes happen at once, it can crash tinylr, so this is hacky rate-limiting
              http.get(liveReloadURL);
              last_change_request = now;
            }
          }
        });
      });
    }

    app.use(serveStatic(dir));
    http.createServer(app).listen(port);

    if(opts.ngrok){
      ngrok.connect({port: port}, function (err, url){
        if(err){
          reject(err);
        }else{
          resolve(url);
        }
      });
    }else{
      var u = url.format({
        protocol: 'http',
        hostname: host,
        port: port
      });
      resolve(u);
    }
  });
};


// run with command line arguments
serve.process_args = function (){
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
    .then(function(url){
      console.log(('\n>  '+url+'\n\n').green);
    })
    .catch(function(err){
      console.log(('ERROR: '+error).red);
    });
};

module.exports = serve; // You can use this as a module now, too
