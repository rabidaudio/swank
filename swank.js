var path        = require('path');
var os          = require('os');
var http        = require('http');
var connect     = require('connect');
var serveStatic = require('serve-static');
var morgan      = require('morgan');
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
            watch: false
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
        console.log("Usage: swank [[--ngrok | -n]] [[--watch | -w]] [[--port | -p PORT]] [[ [[--path | -d]] root_directory]]");
        return;
    }

    var dir = opts.path || __dirname; //default to CWD
    var port = opts.port || process.env.PORT || 8000;
    var host = "http://"+(os.hostname()||"localhost");

    var ngrok = false;
    var warning = null;
    if(opts.ngrok){
        try{
            ngrok = require('ngrok');
        }catch(err){
            warning = "ngrok is optional and not installed automatically. Run `npm install ngrok` to use this feature.";
            ngrok = false;
        }
    }

    //start server
    var app = connect();
    if(true){
        app.use(morgan('combined'));
    }
    app.use(serveStatic(dir));
    http.createServer(app).listen(port);

    if(ngrok){
        ngrok.connect({port: port}, function(err, url){
            callback(err, warning, url);
        });
    }else{
        callback(null, warning, host+":"+port);
    }
};


// run with command line arguments
serve.process_args = function(){
    var knownOpts = {
        "port"  : Number,
        "path"  : path,
        "help"  : Boolean,
        "ngrok" : Boolean,
        "watch" : Boolean
    };

    var shortHands = {
        "p": "--port",
        "d": "--path",
        "h": "--help",
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