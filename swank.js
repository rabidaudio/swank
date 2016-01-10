'use strict';

var path        = require('path');
var os          = require('os');
var Url         = require('url');
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
var debounce    = require('debounce');


function Swank (opts){

  var host = 'localhost';

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
  var port = opts.port || process.env.PORT || 8000;
  var dir  = opts.path || process.cwd(); //default to CWD

  var log  = (opts.log === undefined ? true : opts.log);
  var format = (opts.log instanceof Object && opts.log.format ? opts.log.format : 'combined' );
  var logOpts = (opts.log instanceof Object && opts.log.opts ? opts.log.opts : {} );
  var ngrokOpts = (opts.ngrok instanceof Object ? opts.ngrok : {});
  ngrokOpts.port = ngrokOpts.port || port;

  var liveReloadOpts = (opts.watch instanceof Object && opts.watch.opts ? opts.watch.opts : {} );
  liveReloadOpts.port = liveReloadOpts.port || 35729;

  var ngrokWatchOpts = JSON.parse(JSON.stringify(ngrokOpts)); //copy values
  ngrokWatchOpts.subdomain = undefined; // if they configured a subdomain, we shouldn't use it here
  ngrokWatchOpts.proto = 'http';
  ngrokWatchOpts.addr = liveReloadOpts.port;

  var interval = opts.interval || 1000;

  var liveReloadServer = null;

  var app = connect();

  if(log){
    app.use(morgan(format, logOpts));
  }

  // liveReload injection needs to come before serveStatic
  if(opts.watch){

    if(opts.ngrok){
      //unfortunately, we can't set the hostname for livereload until the proxy is actually running,
      //  because we don't know what name we'll get. 
      throw new Error('ngrok and watch options cannot currently be used at the same time.');
    }

    //inject script into pages
    app.use(liveReload(liveReloadOpts));
  }

  // actualy serve files
  app.use(serveStatic(dir));

  if(opts.watch){

    // keep an array of all recently changed files
    var changed = [];

    //when a file changes, cause a reload
    watch.watchTree(dir, { interval: interval }, function (f, curr, prev) {
      if (typeof f === 'object' && prev === null && curr === null) {
       // Finished walking the tree
      } else {
        changed.push(f);
        //send an update of all changed files, debounced every interval
        debounce(function (){
          var data = JSON.stringify({ files: changed });
          var req = http.request({
              protocol: 'http',
              hostname: host,
              port: liveReloadOpts.port,
              path: '/changed',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
              }
          });
          req.write(data);
          req.end();
          changed = [];
        }, interval);
      }
    });

    liveReloadServer = tinylr();
  }

  this.app = app;
  this.port = port;

  this.listenTo = function (server){
    
    //when the app starts, also start ngrok and the lr server
    server.addListener('listening', function(){
      if(opts.watch){
        liveReloadServer.listen(liveReloadOpts.port);
      }
      if(opts.ngrok){
        ngrok.connect(ngrokOpts);
      }
    });

    // when the main server is closed, also close ngrok and the liveReload server
    server.addListener('close', function(){
      if(opts.watch){
        watch.unwatchTree(dir);
        liveReloadServer.close();
      }
      if(opts.ngrok){
        ngrok.disconnect();
      }
    });
  };

  this.serve = function (){

    var self = this;
    return new Promise(function (resolve, reject){
      // create HTTP server
      var server = http.createServer(app);

      // server listeners
      self.listenTo(server);

      server.once('error', reject);

      self.server = server;

      if(opts.ngrok){
        ngrok.once('error', reject);
        ngrok.once('connect', function (url){
          self.url = url;
          resolve(self);
        });
      }else{
        server.once('listening', function(){
          self.url = Url.format({ protocol: 'http', hostname: host, port: port });
          resolve(self);
        });
      }

      server.listen(port);
    });
  };
}

var serve = function (opts, depreciatedCallback){

  var promise = new Swank(opts).serve();

  if(depreciatedCallback !== undefined){
    if(opts.log !== false){
      console.log(('Use of callback argument is depreciated, as swank now returns a promise. '+
        'This functionality will be removed in a future version.').yellow);
    }
    promise.then(function (res){
      depreciatedCallback(null, null, res.url);
    }).catch(function (err){
      depreciatedCallback(err, null, null);
    });
  }

  return promise;
};

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

serve.Swank = Swank;

module.exports = serve;
