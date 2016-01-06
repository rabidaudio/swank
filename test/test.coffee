expect        = require('chai').expect
request       = require 'request'
Promise       = require 'bluebird'
child_process = require 'child_process'
rmrf          = require 'rimraf'
fs            = require 'fs'

swank = require '../swank'

getPage = (url) ->
  new Promise (resolve, reject) ->
    request url, (err, res, body) ->
      if err
        reject(err)
      else
        res.body = body
        resolve res
    .end()  

describe 'Swank', ()->

  describe 'file serve', ()->

    s = null

    before (done) ->
      swank({path: 'test/fixtures'})
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


  describe 'defaults', ()->

    it 'should serve files in the current directory by default', (done) ->
      swank().then (@s)->
        getPage "#{@s.url}/test/fixtures"
        .then (res) ->
          expect(res.statusCode).to.equal 200
          expect(res.body).to.contain 'Hello, World'
          done()
        .catch done
        .finally () -> @s.server.close()

    it 'should use PORT environment variable by default', (done) ->
      originalEnv = process.env # make a backup of env vars
      process.env.PORT = 1234
      swank().then (@s)->
        getPage 'http://localhost:1234/test/fixtures'
        .then (res) ->
          expect(res.statusCode).to.equal 200
          expect(res.body).to.contain 'Hello, World'
          done()
        .catch done
        .finally () ->
          @s.server.close()
          process.env = originalEnv


  describe 'arguments', ()->

    it 'should have a configurable port', (done) ->
      swank({path: 'test/fixtures', port: 1234})
      .then (@s) -> getPage 'http://localhost:1234'
      .then (res) ->
        expect(res.body).to.contain 'Hello, World'
        done()
      .catch done
      .finally () -> @s.server.close()

    it 'should allow ngrok tunnelling', (done) ->
      @timeout 5000
      swank({path: 'test/fixtures', ngrok: true})
      .then (@s) ->
        expect(@s.url).to.match /https?:\/\/[a-z0-9]+.ngrok.com/
        getPage @s.url
      .then (res) ->
        expect(res.statusCode).to.equal 200
        expect(res.body).to.contain 'Hello, World'
        done()
      .catch done
      .finally () -> @s.server.close()


  describe 'watch', ()->

    describe 'serve', ()->
      s = null

      before (done) ->
        swank({path: 'test/fixtures', watch: true}).then (ss)->
          s = ss
          done()

      after (done) -> s.server.close(done)


      it 'should insert livereload.js', (done) ->
        getPage {url: "http://localhost:8000",   headers: { 'Accept' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' }}
        .then (res) ->
          expect(res.statusCode).to.equal 200
          expect(res.body).to.contain 'livereload.js'
          done()
        .catch done

      it 'should be running a livereload server', (done) ->
        getPage 'http://localhost:35729'
        .then (res) ->
          expect(res.statusCode).to.equal 200
          done()
        .catch done

      describe 'simulate', ()->

        before () ->
          # make a bunch of files
          fs.mkdirSync 'test/fixtures/many'
          fs.writeFileSync("test/fixtures/many/#{i}.txt", '') for i in [0..100]

        it 'shouldn\'t crash when changing many files', (done) ->
          # delete all the files
          rmrf.sync 'test/fixtures/many'
          getPage 'http://localhost:35729'
          .then (res) ->
            # livereload server should still be running
            expect(res.statusCode).to.equal 200
            done()
          .catch done

    describe 'close', ()->

      it 'should also close the livereload server after closing', (done)->
        swank({path: 'test/fixtures', watch: true}).then (@s)->
          getPage 'http://localhost:35729'
          .then (res) ->
            expect(res.statusCode).to.equal 200
            @s.server.close ()->
              getPage 'http://localhost:35729'
              .then (res) -> done new Error "expected request to throw"
              .catch (err) -> done()
          .catch done

  describe 'command line', ()->

    it 'should be runnable from the command line', (done) ->
      proc = child_process.spawn 'bin/swank', ['test/fixtures']
      proc.stdout.once 'data', (data) ->
        getPage 'http://localhost:8000'
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