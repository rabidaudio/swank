expect  = require('chai').expect
request = require('request');
Promise = require('bluebird')

swank   = require '../swank'

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
      swank({path: 'test/fixtures'}).then (ss) ->
        s = ss
        done()

    after (done) -> s.server.close done

    it 'should serve files in the given directory', (done) ->
      getPage(s.url)
      .then (res) ->
        expect(res.statusCode).to.equal 200
        expect(res.body).to.contain 'Hello, World'
        done()
      .catch done

    it 'should not serve files not in the given directory', (done) ->
      getPage 'http://localhost:8000/nonsense.html'
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