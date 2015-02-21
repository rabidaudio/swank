#! /usr/bin/env node
var path = require('path');
var os = require('os');
var http = require('http');
var connect = require('connect');
var serveStatic = require('serve-static');
var morgan = require('morgan');
var nopt = require('nopt');
var colors = require('colors');


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

// function usage(){
    
// }

var opts = nopt(knownOpts, shortHands);

//take path if not given explicitly
if(!opts.path && opts.argv.remain.length > 0){
    opts.path = path.resolve(opts.argv.remain.join(" "));
}

/* Takes in an object like this (all optional, defaults shown):
{
    path: ".",
    port: 8000,
    help: false,
    ngrok: false,
    watch: false
}
*/
var serve = function(opts){
    opts = opts || {};

    //start by returning usage info if requested
    if(opts.help){
        console.log("Usage: swank [[--ngrok | -n]] [[--watch | -w]] [[--port | -p PORT]] [[ [[--path | -d]] root_directory]]");
        return;
    }

    var dir = opts.path || __dirname; //default to CWD
    var port = opts.port || process.env.PORT || 8000;
    var host = "http://"+(os.hostname()||"localhost");

    var ngrok = false;
    if(opts.ngrok){
        try{
            ngrok = require('ngrok');
        }catch(err){
            console.log("WARNING: ngrok is optional and not installed automatically. Run `npm install ngrok` to use this feature.".yellow);
            ngrok = false;
        }
    }

    start_server(host, port, dir, true);

    if(ngrok){
        ngrok.connect({port: port}, function(err, url){
            if(err){
                return console.log(err.red);
            }
            console.log("\n>  "+url+"\n\n".green);
        });
    }else{
        console.log("\n>  "+host+":"+port+"\n\n".green);
    }
};

function start_server(host, port, dir, log){
    var app = connect();
    if(log){
        app.use(morgan('combined'));
    }
    app.use(serveStatic(dir));
    http.createServer(app).listen(port);
}

serve(opts);

module.exports = serve; // You can use this as a module now, too