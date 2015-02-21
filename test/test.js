var expect = require('chai').expect;

var child_process = require('child_process');
var http = require('http');
var jsdom = require("jsdom");


describe('Swank', function(){

  after(function(){
    //Failures can leave some servers still running, so kill any existing processes
    procs.forEach(function(proc){
      // if(proc.){
        proc.kill('SIGHUP');
      // }
    });
  });

  describe('file serve', function(){

    it('should serve files in the given directory', function(done){
      run_and_open('./swank.js',['test/public'], null, 'http://localhost:8000', done, function(res, $, window){

        expect(res.statusCode).to.equal(200);
        expect($('body').text()).to.contain('Hello, World');

      });
    });

    it('should not serve files not in the given directory', function(done){
      run_and_open('./swank.js',['test/public'], null, 'http://localhost:8000/nonsense.html', done, function(res, $, window){

        expect(res.statusCode).to.equal(404);

      });
    });

    it('should serve files with the correct content type', function(done){
      run_and_open('./swank.js',['test/public'], null, 'http://localhost:8000/peppers.png', done, function(res, $, window){

        expect(res.statusCode).to.equal(200);
        var content_type = res.headers['content-type'];
        expect(content_type).to.equal('image/png');

      });
    });

    it('should serve files in the current directory by default', function(done){
      run_and_open('./swank.js',[], null, 'http://localhost:8000/test/public', done, function(res, $, window){

        expect(res.statusCode).to.equal(200);
        expect($('body').text()).to.contain('Hello, World');

      });
    });

    it('should allow user-specified port', function(done){
      run_and_open('./swank.js',[ '--port=1234', 'test/public'], null, 'http://localhost:1234', done, function(res, $, window){

        expect(res.statusCode).to.equal(200);
        expect($('body').text()).to.contain('Hello, World');

      });
    });

  });

  describe('arguments', function(){

    it('should use PORT environment variable if available', function(done){
      var opts = {env: {'PORT':'1234'}};
      run_and_open('./swank.js',['test/public'], opts, 'http://localhost:1234', done, function(res, $, window){

        expect(res.statusCode).to.equal(200);
        expect($('body').text()).to.contain('Hello, World');

      });
    });

    it('should display a help message', function(mocha_done){
      run('./swank.js', ['help'], null, function(data, child_done){

        expect(data.toString()).to.contain('Usage: ');

        child_done();
        mocha_done();
      });
    });

    it('should allow ngrok tunnelling', function(mocha_done){
      run('./swank.js', ['--ngrok', 'test/public'], null, function(data, child_done){

        expect(data).not.to.equal(undefined);
        var url = data.toString().trim().replace(/>\s+/,'').replace('https', 'http'); //url of ngrok server

        expect(url).to.contain('ngrok.com');

        open(url, function(res, $, window){

          expect(res.statusCode).to.equal(200);
          expect($('body').text()).to.contain('Hello, World');

          child_done();
          mocha_done();  
        });
      });

    });
  });
});







/******************************************** HELPER METHODS **********************************************************/

var procs = [];

function run(command, args, opts, callback){
  var proc = child_process.spawn(command, args, opts||{});
  procs.push(proc);
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
      callback(res, undefined, undefined);
    }else{
      res.on('data', function(body){
        jsdom.env(body.toString(), ["http://code.jquery.com/jquery.js"], function(errors, window){
          if(errors) throw errors;
          callback(res, window.jQuery, window);
        });
      });
    }
  }).end();
}

function run_and_open(command, args, opts, url, mocha_done, callback){
  run(command, args, opts, function(data, child_done){
    open(url, function(j,w){
      callback(j,w);
      child_done();
      mocha_done();
    });
  });
}