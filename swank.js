#! /usr/bin/env node
var path = require('path');
var connect = require('connect');

if(    process.argv[2] == "help"
    || process.argv[2] == "usage" ){
        console.log("Usage: swank [[root_directory]] [[port]]");
        return;  
}

var dir = path.resolve(process.argv[2] || '') || __dirname;
var port = process.argv[3] || 8000;

//console.log("Hosting " + dir + "on port: " + port);
console.log("\n>  http://"+(require('os').hostname()||"localhost")+":"+port+"\n\n");

connect.logger();
connect.createServer(
    connect.logger(),
    connect.static( dir )
).listen( port );
