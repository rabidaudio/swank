var expect = require('chai').expect;

var child_process = require('child_process');
var http = require('http');
var jsdom = require("jsdom");


describe('Swank', function(){

  describe('file serve', function(){

    it('should serve files in the given directory', function(done){
      run_and_open('./swank.js',['test/public'], 'http://localhost:8000', done, function(status, $, window){

        expect(status).to.equal(200);
        expect($('body').text()).to.contain('Hello, World');

      });
    });

    it('should not serve files in the given directory', function(done){
      run_and_open('./swank.js',['test/public'], 'http://localhost:8000/nonsense.html', done, function(status, $, window){

        expect(status).to.equal(404);

      });
    });
  });
});







/******************************************** HELPER METHODS **********************************************************/

function run(command, args, callback){
  var proc = child_process.spawn(command, args);
  proc.stdout.once('data', function (data) {
    var done = function(){
      proc.kill('SIGHUP');
    };
    callback(data, done);
  });
}

function open(url, callback){
  http.get(url, function(res){
    if(res.statusCode >= 400){
      callback(res.statusCode, undefined, undefined);
    }else{
      res.on('data', function(body){
        jsdom.env(body.toString(), ["http://code.jquery.com/jquery.js"], function(errors, window){
          if(errors) throw errors;
          callback(res.statusCode, window.jQuery, window);
        });
      });
    }
  }).end();
}

function run_and_open(command, args, url, complete, callback){
  run(command, args, function(data, done){
    // expect(data).not.to.equal(undefined);
    // var url = data.toString().trim().replace(/>\s+/,'');
    open(url, function(j,w){
      callback(j,w);
      done();
      complete();
    });
  });
}