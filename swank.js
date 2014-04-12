#! /usr/bin/env node
var path = require('path');
var connect = require('connect');

var dir = '.';
var port = 8000;
var ngrok;

for(var i=1; i<process.argv.length;i++){
    var arg = process.argv[i];
    if(arg === "help" || arg==="usage"){
        console.log("Usage: swank [[--ngrok]] [[--port=PORT]] [[root_directory]]");
        return; 
    }else if(arg == "--ngrok" ){
        try{
            ngrok = require('ngrok');
        }catch(err){
            console.log("WARNING: ngrok is optional and not installed automatically. Run `npm install ngrok` to use this feature.");
            ngrok = null;
        }
    }else if(arg.match(/^--port=[0-9]+/)){
        port = arg.replace(/^--port=/,'');
    }else if(i===process.argv.length-1){
        dir = arg;
    }
}
dir = path.resolve(dir) || __dirname;

if( ngrok ){
    ngrok.connect({port: port}, function(err, url){
        if(err) throw err;
        start_server(url, port, dir);
        console.log("\n>  "+url+"\n\n");
    });
}else{
    var host = "http://"+(require('os').hostname()||"localhost");
    start_server(host, port, dir);
    console.log("\n>  "+host+":"+port+"\n\n");
}

function start_server(host, port, dir){
    connect.logger();
    connect.createServer(
        connect.logger(),
        connect.static( dir )
    ).listen( port );
}
