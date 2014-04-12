#! /usr/bin/env node
var path = require('path');
var connect = require('connect');

if(    process.argv.indexOf("help")>=0
    || process.argv.indexOf("usage")>=0 ){
        console.log("Usage: swank [[root_directory]] [[port]] [[--ngrok]]");
        return;  
}

var dir = path.resolve(process.argv[2] || '') || __dirname;
var port = process.argv[3] || 8000;

if( process.argv.indexOf("--ngrok")>=0 ){
    require('ngrok').connect(port, function(err, url){
        if(err) throw err;
        start_server(url, port);
        console.log("\n>  "+url+"\n\n");
    });
}else{
    var host = "http://"+(require('os').hostname()||"localhost");
    start_server(host, port);
    console.log("\n>  "+host+":"+port+"\n\n");
}

function start_server(host, port){
    connect.logger();
    connect.createServer(
        connect.logger(),
        connect.static( dir )
    ).listen( port );
}
