var expect = require('chai').expect;

var child_process = require('child_process');
var fs            = require('fs');
var request       = require('request');
var rmrf          = require('rimraf');


/******************************************** HELPER METHODS **********************************************************/

var procs = [];

function run(command, args, opts, callback){
 var proc = child_process.spawn(command, args || [], opts || {});
 procs.push(proc);
 proc.stdout.once('data', function (data) {
  var done = function (){ proc.kill('SIGHUP'); };
  callback(data, done);
 });
}

function open(url, callback){
 request(url, function (error, res, body){
  if(error){ throw error; }
  res.body = body;
  callback(res);
 }).end();
}

function run_and_open(command, args, opts, url, mocha_done, callback){
 run(command, args, opts, function (data, child_done){
  open(url, function (res){
   callback(res, function (){
    child_done();
    if(mocha_done) mocha_done();
   });
  });
 });
}

/******************************************** TEST CASES **********************************************************/

describe('Swank', function (){


  after(function (){
    //Failures can leave some servers still running, so kill any existing processes
    procs.forEach(function (proc){
      proc.kill('SIGHUP');
    });
  });

  describe('file serve', function (){

    var stop_proc;

    before(function (done){
      this.timeout(5000);
      run('bin/swank', ['test/fixtures'], null, function (data, run_done){
        stop_proc = run_done;
        done();
      });
    });

    it('should serve files in the given directory', function (done){
     open('http://localhost:8000', function (res){

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.contain('Hello, World');
      done();

     });
    });

    it('should not serve files not in the given directory', function (done){
     open('http://localhost:8000/nonsense.html', function (res){

      expect(res.statusCode).to.equal(404);
      done();

     });
    });

    it('should serve files with the correct content type', function (done){
     open('http://localhost:8000/peppers.png', function (res){

      expect(res.statusCode).to.equal(200);
      var content_type = res.headers['content-type'];
      expect(content_type).to.equal('image/png');
      done();

     });
    });

    after(function (){
      stop_proc();
    });

  });

  describe('arguments', function (){

    it('should use PORT environment variable if available', function (done){
     var env = Object.create( process.env );
     env.PORT = '1234';
     run_and_open('bin/swank', ['test/fixtures'], {env: env}, 'http://localhost:1234', done, function (res, done){

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.contain('Hello, World');
      done();

     });
    });

    it('should display a help message', function (mocha_done){
     run('bin/swank', ['--help'], null, function (data, child_done){

      expect(data.toString()).to.contain('Usage: ');

      child_done();
      mocha_done();
     });
    });

    it('should serve files in the current directory by default', function (done){
     run_and_open('bin/swank', null, null, 'http://localhost:8000/test/fixtures', done, function (res, done){

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.contain('Hello, World');
      done();

     });
    });

    it('should allow user-specified port', function (done){
     run_and_open('bin/swank',['--port=1234', 'test/fixtures'], null, 'http://localhost:1234', done, function (res, done){

      expect(res.statusCode).to.equal(200);
      expect(res.body).to.contain('Hello, World');
      done();

     });
    });

    it('should allow ngrok tunnelling', function (mocha_done){
      this.timeout(10000);
      run('bin/swank', ['--ngrok', 'test/fixtures/'], null, function (data, child_done){
        //url of ngrok server. implicit testing that url is valid
        var url = data.toString().match(/https?:\/\/[a-z0-9]+.ngrok.com/)[0].replace('https', 'http');
        open(url, function (res){
          expect(res.statusCode).to.equal(200);
          expect(res.body).to.contain('Hello, World');

          child_done();
          mocha_done();  
        });
      });
    });
  });

  describe('modular', function (){
    it('should be usable as a module as well', function (done){

     var serve = require('../swank.js');
     serve({
      path: 'test/fixtures',
      port: 1234
     }, function (err, warn, url){
      expect(err).not.to.exist;
      expect(warn).not.to.exist;
      open(url, function (res){
       expect(res.statusCode).to.equal(200);
       expect(res.body).to.contain('Hello, World');
       done();
      });
     });

    });
  });


  describe('watch', function (){
    var proc, stop_watching;

    //start watch server
    before(function(done){
      //make a bunch of files
      fs.mkdirSync('test/fixtures/many');
      for(var i = 0; i<100; i++){
        fs.writeFileSync('test/fixtures/many/'+i+'.txt', '');
      }
      run('bin/swank', ['--watch', '--path', 'test/fixtures'], null, function (data, run_done){
        proc = data;
        stop_watching = run_done;
        done();
      });
    });

    it('should insert livereload.js', function(mocha_done){
      open({url: 'http://localhost:8000', headers: {'accept': 'text/html'}}, function (res){

        expect(res.statusCode).to.equal(200);
        expect(res.body).to.contain('livereload.js');
        mocha_done();

      });
    });

    it('should be running a livereload server', function (mocha_done){

      open('http://localhost:35729', function (res){
        expect(res.statusCode).to.equal(200);
        mocha_done();
      });

    });

    it('shouldn\'t crash when changing many files', function (mocha_done){
      this.timeout(8000);
      rmrf.sync('test/fixtures/many');
      setTimeout(function(){ //give the server a chance to die
        open('http://localhost:35729', function (res){
          //livereload server should still be running
          expect(res.statusCode).to.equal(200);
          mocha_done();
        });
      }, 7000);
    });

    //cleanup and stop watch server
    after(function (){
      rmrf.sync('test/fixtures/many');
      stop_watching();
    });
  });
});