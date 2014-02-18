var path = require('path');
var connect = require('connect');

//console.log( process.argv );
var dir = path.resolve(process.argv[2] || '') || __dirname;
var port = 8000;        //process.argv[3] || 8000;

console.log("Hosting " + dir + "on port: " + port);
console.warn("http://localhost:"+port);

connect.logger();
connect.createServer(
    connect.static( dir )
).listen( port );
