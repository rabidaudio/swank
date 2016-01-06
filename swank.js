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

var host = 'localhost';

/*
  Takes in an object like this (all optional, defaults shown):
    {
      path: '.',
      port: 8000,
      help: false,
      ngrok: false,
      watch: false,
      log: true,
      liveReload: {}
    }

  Returns a Promise:
    fufilled: ({url, port, app, server})
    rejected: (error)
*/
var serve = function (opts, depreciatedCallback){

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

  var log  = opts.log || true;
  var format = (opts.log instanceof Object && opts.log.format ? opts.log.format : 'combined' );
  var logOpts = (opts.log instanceof Object && opts.log.opts ? opts.log.opts : {} );

  var liveReloadOpts = opts.liveReload || {};
  liveReloadOpts.port = liveReloadOpts.port || 35729;

  var interval = opts.interval || 1000;

  var liveReloadServer = null;

  var promise = new Promise(function (resolve, reject){

    var app = connect();

    // console.log(app, opts, dir, host, log, format, logOpts, liveReloadOpts);

    if(opts.ngrok && opts.watch){
      // if(liveReloadOpts.port && opts.console && opts.log){
      //   console.log(('The liveReload port supplied has been overwritten as the ngrok option was also supplied '+
      //     'and for both to function, liveReload must use the same port as the app.').yellow);
      // }
      // liveReloadOpts.port = port;
      throw new Error('ngrok and watch options cannot currently be used at the same time.');
    }

    if(log){
      app.use(morgan(format, logOpts));
    }

    // liveReload injection needs to come before serveStatic
    if(opts.watch){

      //inject script into pages
      app.use(liveReload(liveReloadOpts));
    }

    // actualy serve files
    app.use(serveStatic(dir));

    if(opts.watch){

      // if(opts.ngrok){
        // //use the same port
        // liveReloadServer = tinylr.middleware({ app: app });
        // app.use(liveReloadServer);
        // if(opts.console && opts.log){
        //   console.log(('Note that there are some consequences to using both watch and ngrok at the same time. '+
        //     'Live reload will not work if your app responds to GET /connect already.').yellow);
        // }
      // }else{
      // }

      var lastChangeRequest = new Date().valueOf();
      var WATCH_TIMEOUT = 500;

      //when a file changes, cause a reload
      watch.watchTree(dir, { interval: interval }, function (f, curr, prev) {
        if (typeof f === 'object' && prev === null && curr === null) {
         // Finished walking the tree
        } else {
          var liveReloadURL = Url.format({
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

      liveReloadServer = tinylr();
    }

    // create HTTP server
    var server = http.createServer(app);

    // server listeners
    if(opts.watch){
      //when the app starts, also start the lr server
      server.addListener('listening', function(){
        liveReloadServer.listen(liveReloadOpts.port);
      });

      // when the main server is closed, also close the liveReload server
      server.addListener('close', liveReloadServer.close);
    }

    if(opts.ngrok){
      server.addListener('listening', function(){
        ngrok.connect({port: port});
      });

      server.addListener('close', ngrok.disconnect);
    }

    server.once('error', reject);

    if(opts.ngrok){
      ngrok.once('error', reject);
      ngrok.once('connect', function (url){
        resolve({url: url, port: port, server: server, app: app});
      });
    }else{
      server.once('listening', function(){
        var url = Url.format({ protocol: 'http', hostname: host, port: port });
        resolve({url: url, port: port, server: server, app: app});
      });
    }

    server.listen(port);
  });

  if(depreciatedCallback !== undefined){
    if(log){
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

module.exports = serve;
