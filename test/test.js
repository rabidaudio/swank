var expect = require('chai').expect;

var child_process = require('child_process');
var request = require('request');

/******************************************** HELPER METHODS **********************************************************/

var procs = [];

function run(command, args, opts, callback){
 var proc = child_process.spawn(command, args, opts);
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

  it('should serve files in the given directory', function (done){
   run_and_open('bin/swank',['test/fixtures'], null, 'http://localhost:8000', done, function (res, done){

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.contain('Hello, World');
    done();

   });
  });

  it('should not serve files not in the given directory', function (done){
   run_and_open('bin/swank',['test/fixtures'], null, 'http://localhost:8000/nonsense.html', done, function (res, done){

    expect(res.statusCode).to.equal(404);
    done();

   });
  });

  it('should serve files with the correct content type', function (done){
   run_and_open('bin/swank',['test/fixtures'], null, 'http://localhost:8000/peppers.png', done, function (res, done){

    expect(res.statusCode).to.equal(200);
    var content_type = res.headers['content-type'];
    expect(content_type).to.equal('image/png');
    done();

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

  // it('should allow ngrok tunnelling', function (mocha_done){

  //   this.timeout(10*1000);

  //   run('bin/swank', ['--ngrok', 'test/fixtures/'], null, function (data, child_done){

  //     expect(data).not.to.equal(undefined);
  //     var url = data.toString().trim().replace(/>\s+/,''); //url of ngrok server
  //     expect(url).to.contain('ngrok.com');

  //     setTimeout(function (){ //give ngrok time to start

  //       open(url.replace('https', 'http'), function (res){

  //         expect(res.statusCode).to.equal(200);
  //         expect(res.body).to.contain('Hello, World');

  //         child_done();
  //         mocha_done();  
  //       });

  //     }, 5000);
  //   });
  // });

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
  it('should allow live-reload for changed files', function (mocha_done){
   this.timeout(5000);
   run_and_open('bin/swank', ['--watch', '--path', 'test/fixtures'], null, {url: 'http://localhost:8000',
       headers: {'accept': 'text/html'}}, mocha_done, function (res, done){

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.contain('livereload.js'); //script should be inserted

    open('http://localhost:35729', function (res){
     expect(res.statusCode).to.equal(200); //livereload server should be running
     done();
    });

   });
  });
 });
});