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
var nopt        = require('nopt');
var colors      = require('colors');


var serve = function(opts, callback){
/*
    Takes in an object like this (all optional, defaults shown):
        {
            path: ".",
            port: 8000,
            help: false,
            ngrok: false,
            watch: false,
            log: true,
            liveReload: {}
        }

    Returns a callback when the server is ready with two arguments
        function(error, warning, url)
*/

    opts = opts || {};
    if(typeof callback != 'function'){
        callback = new Function(); // no-op
    }

    //start by returning usage info if requested
    if(opts.help && opts.console){
        console.log("Usage: swank [[--ngrok | -n]] [[--watch | -w]] [[--no-log]] [[--port | -p PORT]] [[ [[--path | -d]] root_directory]]");
        return;
    }

    //defaults
    var dir  = opts.path || __dirname; //default to CWD
    var port = opts.port || process.env.PORT || 8000;
    var host = (os.hostname()||"localhost");
    var log  = (opts.log === undefined ? (opts.console ? true : false) : opts.log);
    var liveReloadOpts = opts.liveReload || {};
    liveReloadOpts.port = liveReloadOpts.port || 35729;

    var ngrok = false;
    var warning = null;
    if(opts.ngrok){
        try{
            ngrok = require('ngrok');
        }catch(err){
            warning = "ngrok is optional and not installed automatically. Run `npm install ngrok` to use this feature.";
        }
    }

    //start server
    var app = connect();
    if(log){
        app.use(morgan('combined'));
    }
    if(opts.watch){
        app.use(liveReload(liveReloadOpts));                    //inject script into pages
        tinylr().listen(liveReloadOpts.port, function(){        //start respond server
            watch.watchTree(dir, function(f, curr, prev) {      //when a file changes, cause a reload
                if (typeof f == "object" && prev === null && curr === null) {
                  // Finished walking the tree
                } else {
                    var liveReloadURL = url.format({
                        protocol: 'http',
                        hostname: host,
                        port: liveReloadOpts.port,
                        pathname: '/changed',
                        query: {files: f}
                    });
                    console.log(liveReloadURL);
                    http.get(liveReloadURL);
                }
            });
        });

    }
    app.use(serveStatic(dir));
    http.createServer(app).listen(port);

    if(ngrok){
        ngrok.connect({port: port}, function(err, url){
            callback(err, warning, url);
        });
    }else{
        callback(null, warning, url.format({
            protocol: "http",
            hostname: host,
            port: port
        }));
    }
};


// run with command line arguments
serve.process_args = function(){
    var knownOpts = {
        "port"  : Number,
        "path"  : path,
        "help"  : Boolean,
        "log"   : Boolean,
        "ngrok" : Boolean,
        "watch" : Boolean
    };

    var shortHands = {
        "p": "--port",
        "d": "--path",
        "h": "--help",
        "l": "--log",
        "n": "--ngrok",
        "w": "--watch",
        "usage": "--help"
    };

    var opts = nopt(knownOpts, shortHands);
    opts.console = true; // run from the command-line

    //take path if not given explicitly
    if(!opts.path && opts.argv.remain.length > 0){
        opts.path = path.resolve(opts.argv.remain.join(" "));
    }
    serve(opts, function(error, warning, url){
        if(error){
            console.log("ERROR: "+error.red);
        }else if(warning){
            console.log("WARNING: "+warning.yellow);
        }else{
            console.log("\n>  "+url+"\n\n".green);
        }
    });
}

module.exports = serve; // You can use this as a module now, too