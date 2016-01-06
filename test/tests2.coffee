expect        = require('chai').expect
request       = require 'request'
Promise       = require 'bluebird'
child_process = require 'child_process'
rmrf          = require 'rimraf'
fs            = require 'fs'

swank = require '../swank'

getPage = (url) ->
  new Promise (resolve, reject) ->
    headers = { 'Accept' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' }
    request {url: url, headers: headers}, (err, res, body) ->
      return reject(err) if err
      res.body = body
      resolve res
    .end()  

describe 'Swank', () ->

  describe 'file serve', () ->

    s = null

    before (done) ->
      swank({path: 'test/fixtures', log: false})
      .then (ss) ->
        s = ss
        done()
      .catch done

    after (done) -> s.server.close done

    it 'should serve files in the given directory', (done) ->
      getPage s.url
      .then (res) ->
        expect(res.statusCode).to.equal 200
        expect(res.body).to.contain 'Hello, World'
        done()
      .catch done

    it 'should NOT serve files NOT in the given directory', (done) ->
      getPage "#{s.url}/../../README.md"
      .then (res) ->
        expect(res.statusCode).to.equal 404
        done()
      .catch done

    it 'should serve files with the correct content type', (done) ->
      getPage "#{s.url}/peppers.png"
      .then (res) ->
        expect(res.statusCode).to.equal 200
        expect(res.headers['content-type']).to.equal 'image/png'
        done()
      .catch done


  describe 'defaults', () ->

    it 'should serve files in the current directory by default', (done) ->
      swank().then (@s) ->
        getPage "#{@s.url}/test/fixtures"
        .then (res) ->
          expect(res.statusCode).to.equal 200
          expect(res.body).to.contain 'Hello, World'
          done()
        .catch done
        .finally () -> @s.server.close()


  describe 'arguments', () ->

    it 'should have a configurable port', (done) ->
      swank({path: 'test/fixtures', port: 1234, log: false})
      .then (@s) -> getPage 'http://localhost:1234'
      .then (res) ->
        expect(res.body).to.contain 'Hello, World'
        done()
      .catch done
      .finally () -> @s.server.close()

    it 'should allow ngrok tunnelling', (done) ->
      @timeout 10000
      swank({path: 'test/fixtures', ngrok: true, log: false})
      .then (@s) ->
        expect(@s.url).to.match /https?:\/\/[a-z0-9]+.ngrok.com/
        getPage @s.url
      .then (res) ->
        expect(res.statusCode).to.equal 200
        expect(res.body).to.contain 'Hello, World'
        done()
      .catch done
      .finally () -> @s.server.close()

    it 'should still respond to callback if given', (done) ->
      swank {path: 'test/fixtures', log: false}, (err, warn, url)->
        throw err if err
        throw warn if warn
        expect(url).to.equal "http://localhost:8000"
      .then (@s) -> done()
      .catch done
      .finally ()-> @s.server.close()


  describe 'watch', () ->

    it 'should insert livereload.js and have a watch server running', (done) ->
      swank({path: 'test/fixtures', watch: true, log: false})
      .then (@s) ->
        getPage @s.url
      .then (res) ->
        expect(res.statusCode).to.equal 200
        expect(res.body).to.contain 'livereload.js'
        getPage 'http://localhost:35729'
      .then (res) ->
        expect(res.statusCode).to.equal 200
        done()
      .catch done
      .finally ()-> @s.server.close()

    describe 'simulate', () ->

      it "shouldn't crash when changing many files", (done) ->
        # make a bunch of files
        fs.mkdirSync 'test/fixtures/many'
        fs.writeFileSync("test/fixtures/many/#{i}.txt", '') for i in [0..100]
        swank({path: 'test/fixtures', watch: true, log: false}).then (@s) ->
          # delete all the files
          rmrf.sync 'test/fixtures/many'
          getPage 'http://localhost:35729'
        .then (res) ->
          # livereload server should still be running
          expect(res.statusCode).to.equal 200
          done()
        .catch done
        .finally ()->
          @s.server.close()
          rmrf.sync 'test/fixtures/many'

    describe 'close', () ->

      it 'should also close the livereload server after closing', (done) ->
        swank({path: 'test/fixtures', watch: true, log: false}).then (@s) ->
          getPage 'http://localhost:35729'
          .then (res) ->
            expect(res.statusCode).to.equal 200
            @s.server.close () ->
              getPage 'http://localhost:35729'
              .then (res) -> done new Error "expected request to throw"
              .catch (err) -> done()
          .catch done
          .finally ()-> @s.server.close()


  # describe 'watch+ngrok', () ->

  #   it 'should allow ngrok tunnelling AND a watch server', (done) ->
  #     @timeout 5000
  #     swank({path: 'test/fixtures', watch: true, ngrok: true}).then (@s) ->
  #       expect(@s).url.to.match /https?:\/\/[a-z0-9]+.ngrok.com/
  #       getPage(@s)
  #     .then (req) ->
  #       expect(res.statusCode).to.equal 200
  #       expect(res.body).to.contain 'livereload.js'
  #       livereloadUrl = res.body.match ???
  #       getPage(livereloadUrl)
  #     .then (req) ->
  #       expect(res.statusCode).to.equal 200
  #       done()
  #     .catch done
  #     .finally @s.server.close()

  describe 'command line', () ->

    it 'should be runnable from the command line', (done) ->
      proc = child_process.spawn 'bin/swank', ['test/fixtures']
      proc.stdout.once 'data', (data) ->
        url = data.toString().replace('>', '').trim()
        expect(url).to.equal 'http://localhost:8000'
        getPage url
        .then (res) ->
          expect(res.body).to.contain 'Hello, World'
          done()
        .catch done
        .finally () -> proc.kill 'SIGHUP'

    it 'should display a help message', (done) -> 
      proc = child_process.spawn 'bin/swank', ['--help']
      proc.stdout.once 'data', (data) ->
        expect(data.toString()).to.contain 'Usage: '
        done()


  describe 'middleware', () ->

    it 'should be usable as middleware', (done) ->
      port = 8080
      app = require('express')()
      app.get '/', (req, res) -> res.sendStatus 200
      Swank = swank.Swank
      middleware = new Swank({port: port, log: false, watch: true})
      app.use middleware.app
      server = require('http').createServer app
      middleware.addListeners server
      server.listen port, ()->
        getPage 'http://localhost:8080'
        .then (res) ->
          expect(res.statusCode).to.equal 200
          getPage 'http://localhost:8080/test/fixtures'
        .then (res) ->
          expect(res.statusCode).to.equal 200
          expect(res.body).to.contain 'livereload.js'
          getPage 'http://localhost:35729'
        .then (res) ->
          expect(res.statusCode).to.equal 200
          done()
        .catch done
        .finally ()-> server.close()