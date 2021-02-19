const chai = require('chai')
chai.use(require('chai-as-promised'))
const expect = chai.expect
const request = require('request')
const childProcess = require('child_process')
const rmrf = require('rimraf')
const fs = require('fs')

const swank = require('../swank')

function getPage (url) {
  return new Promise((resolve, reject) => {
    var headers = {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    }
    request({ url: url, headers: headers }, (err, res, body) => {
      if (err) {
        return reject(err)
      }
      res.body = body
      resolve(res)
    }).end()
  })
}

describe('Swank', () => {
  describe('file serve', () => {
    var s = null

    before(async () => {
      s = await swank({ path: 'test/fixtures', log: false })
    })

    after(async () => {
      await s.server.close()
    })

    it('should serve files in the given directory', async () => {
      var res = await getPage(s.url)
      expect(res.statusCode).to.equal(200)
      expect(res.body).to.contain('Hello, World')
    })

    it('should NOT serve files NOT in the given directory', async () => {
      var res = await getPage(`${s.url}/../../README.md`)
      expect(res.statusCode).to.equal(404)
    })

    it('should serve files with the correct content type', async () => {
      var res = await getPage(`${s.url}/peppers.png`)
      expect(res.statusCode).to.equal(200)
      expect(res.headers['content-type']).to.equal('image/png')
    })
  })

  describe('defaults', () => {
    it('should serve files in the current directory by default', async () => {
      try {
        var s = await swank({ log: false })
        var res = await getPage(`${s.url}/test/fixtures`)
        expect(res.statusCode).to.equal(200)
        expect(res.body).to.contain('Hello, World')
      } finally {
        await s.close()
      }
    })
  })

  describe('arguments', () => {
    it('should have a configurable port', async () => {
      try {
        var s = await swank({ path: 'test/fixtures', port: 1234, log: false })
        var res = await getPage('http://localhost:1234')
        expect(res.body).to.contain('Hello, World')
      } finally {
        await s.close()
      }
    })

    it('should allow ngrok tunnelling', async () => {
      try {
        var s = await swank({ path: 'test/fixtures', ngrok: true, log: false })
        expect(s.url).to.match(/https?:\/\/[a-z0-9]+.ngrok.io/)
        var res = await getPage(s.url)
        expect(res.statusCode).to.equal(200)
        expect(res.body).to.contain('Hello, World')
      } finally {
        await s.close()
      }
    }).timeout(10000)
  })

  describe('watch', () => {
    it('should insert livereload.js and have a watch server running', async () => {
      try {
        var s = await swank({ path: 'test/fixtures', watch: true, log: false })
        var res = await getPage('http://localhost:35729')
        expect(res.statusCode).to.equal(200)
        res = await getPage(s.url)
        expect(res.statusCode).to.equal(200)
        expect(res.body).to.contain('livereload.js')
      } finally {
        await s.close()
      }
    })

    describe('simulate', () => {
      before(() => {
        // make a bunch of files
        rmrf.sync('test/fixtures/many')
        fs.mkdirSync('test/fixtures/many')
        for (let i = 0; i < 100; i++) {
          fs.writeFileSync(`test/fixtures/many/${i}.txt`, '')
        }
      })
      after(() => {
        rmrf.sync('test/fixtures/many')
      })

      it("shouldn't crash when changing many files", async () => {
        try {
          var s = await swank({ path: 'test/fixtures', watch: true, log: false })
          // delete all the files
          rmrf.sync('test/fixtures/many')
          var res = await getPage('http://localhost:35729')
          // livereload server should still be running
          expect(res.statusCode).to.equal(200)
        } finally {
          await s.close()
        }
      })
    })

    describe('close', () => {
      it('should also close the livereload server after closing', async () => {
        try {
          var s = await swank({ path: 'test/fixtures', watch: true, log: false })
          var res = await getPage('http://localhost:35729')
          // livereload server should still be running
          expect(res.statusCode).to.equal(200)
          await s.close()
          expect(getPage('http://localhost:35729')).to.eventually.throw(Error)// be.rejectedWith(Error)
        } finally {
          await s.close()
        }
      })
    })
  })

  // # describe 'watch+ngrok', () ->

  // #   it 'should allow ngrok tunnelling AND a watch server', (done) ->
  // #     @timeout 5000
  // #     swank({path: 'test/fixtures', watch: true, ngrok: true}).then (@s) ->
  // #       expect(@s).url.to.match /https?:\/\/[a-z0-9]+.ngrok.com/
  // #       getPage(@s)
  // #     .then (req) ->
  // #       expect(res.statusCode).to.equal 200
  // #       expect(res.body).to.contain 'livereload.js'
  // #       livereloadUrl = res.body.match ???
  // #       getPage(livereloadUrl)
  // #     .then (req) ->
  // #       expect(res.statusCode).to.equal 200
  // #       done()
  // #     .catch done
  // #     .finally @s.close()

  describe('command line', () => {
    it('should be runnable from the command line', async () => {
      const proc = childProcess.spawn('bin/swank', ['test/fixtures'])
      try {
        var data = await new Promise((resolve, reject) => {
          proc.stdout.once('data', resolve)
        })
        var url = data.toString().replace('>', '').trim()
        expect(url).to.contain('http://localhost:8000')
        var res = await getPage('http://localhost:8000')
        expect(res.body).to.contain('Hello, World')
      } finally {
        proc.kill('SIGHUP')
      }
    })

    it('should display a help message', (done) => {
      const proc = childProcess.spawn('bin/swank', ['--help'])
      proc.stdout.once('data', (data) => {
        expect(data.toString()).to.contain('Usage: ')
        done()
      })
    })
  })

  describe('middleware', () => {
    it('should be usable as middleware', async () => {
      const port = 8080
      const app = require('express')()
      app.get('/', (req, res) => res.sendStatus(200))
      const Swank = swank.Swank
      const middleware = new Swank({ port: port, log: false, watch: true })
      app.use(middleware.app)
      const server = require('http').createServer(app)
      try {
        middleware.listenTo(server)
        await new Promise((resolve, reject) => {
          server.listen(port, resolve)
        })
        var res = await getPage('http://localhost:8080')
        expect(res.statusCode).to.equal(200)
        res = await getPage('http://localhost:8080/test/fixtures')
        expect(res.statusCode).to.equal(200)
        expect(res.body).to.contain('livereload.js')
        res = await getPage('http://localhost:35729')
        expect(res.statusCode).to.equal(200)
      } finally {
        server.close()
      }
    })
  })
})
