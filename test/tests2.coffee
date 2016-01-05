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
      .then (ss) -> s = ss
      .finally done

    after (done) -> s.server.close done

    it 'should serve files in the given directory', (done) ->
      getPage s.url
      .then (res) ->
        expect(res.statusCode).to.equal 200
        expect(res.body).to.contain 'Hello, World'
      .finally done

    it 'should not serve files not in the given directory', (done) ->
      getPage 'http://localhost:8000/nonsense.html'
      .then (res) -> expect(res.statusCode).to.equal 404
      .finally done

    it 'should serve files with the correct content type', (done) ->
      getPage "#{s.url}/peppers.png"
      .then (res) ->
        expect(res.statusCode).to.equal 200
        expect(res.headers['content-type']).to.equal 'image/png'
      .finally done

  describe 'defaults', ()->
    it 'should serve files in the current directory by default', (done) ->
      swank().then (@s)->
        getPage 'http://localhost:8000/test/fixtures'
        .then (res) ->
          expect(res.statusCode).to.equal 200
          expect(res.body).to.contain 'Hello, World'
          @s.server.close()
        .finally done

  describe 'arguments', ()->

    it 'should have a configurable port', (done) ->
      swank({path: 'test/fixtures', port: 1234})
      .then (@s) -> getPage 'http://localhost:1234'
      .then (res) ->
        expect(res.body).to.contain 'Hello, World'
        @s.server.close()
      .finally done

    # it 'should allow ngrok tunnelling', (done) ->
    #   @timeout 5000
    #   swank({path: 'test/fixtures', ngrok: true})
    #   .then (@s) ->
    #     expect(s.url).to.match /https?:\/\/[a-z0-9]+.ngrok.com/
    #     getPage s.url
    #   .then (res) ->
    #     expect(res.statusCode).to.equal 200
    #     expect(res.body).to.contain 'Hello, World'
    #     @s.server.close()
    #   .finally done

  describe 'watch', ()->

    it 'should insert livereload.js', (done) ->
      swank({path: 'test/fixtures', watch: true}).then (@s)->
        getPage @s.url # {url: "#{@s.url}/index.html", headers: {"Cache-Control":"no-cache", "Pragma":"no-cache"}}
        .then (res) ->
          expect(res.statusCode).to.equal 200
          expect(res.body).to.contain 'livereload.js'
        .finally (err)->
          @s.server.close()
          @s.liveReloadServer.close()
          done err

    it 'should be running a livereload server', (done) ->
      swank({path: 'test/fixtures', watch: true}).then (@s)->
        getPage 'http://localhost:35729'
        .then (res) ->
          expect(res.statusCode).to.equal 200
        .finally (err)->
          @s.server.close()
          @s.liveReloadServer.close()
          done err

    it 'shouldn\'t crash when changing many files', (done) ->
      @timeout 8000

      # make a bunch of files
      fs.mkdirSync 'test/fixtures/many'
      fs.writeFileSync("test/fixtures/many/#{i}.txt", '') for i in [0..100]

      swank({path: 'test/fixtures', watch: true}).then (@s)->
        # delete all the files
        rmrf.sync 'test/fixtures/many'
        getPage 'http://localhost:35729'
        .then (res) ->
          # livereload server should still be running
          expect(res.statusCode).to.equal 200
        .finally (err)->
          @s.server.close()
          @s.liveReloadServer.close()
          done err


  # describe 'command line', ()->

  #   it 'should be runnable from the command line', (done) ->
  #     proc = child_process.spawn 'bin/swank', ['test/fixtures']
  #     proc.stdout.once 'data', (data) ->
  #       getPage 'http://localhost:8000'
  #       .then (res) -> expect(res.body).to.contain 'Hello, World'
  #       .finally (err) ->
  #         proc.kill 'SIGHUP'
  #         done(err)

  #   it 'should display a help message', (done) -> 
  #     proc = child_process.spawn 'bin/swank', ['--help']
  #     proc.stdout.once 'data', (data) ->
  #       expect(data.toString()).to.contain 'Usage: '
  #       done()