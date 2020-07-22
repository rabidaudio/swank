const expect = require('chai').expect
const request = require('request')
const child_process = require('child_process')
const rmrf = require('rimraf')
const fs = require('fs')

const swank = require('../swank')

function getPage(url) {
  return new Promise((resolve, reject) => {
    headers = {
      'Accept' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    }
    request({url: url, headers: headers}, (err, res, body) => {
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
    before((done) => {
      swank({path: 'test/fixtures', log: false})
        .then(ss => {
          s = ss
          done()
        }).catch(done)
    })

    after((done) => {
      s.server.close(done)
    })

    it('should serve files in the given directory', (done) => {
      getPage(s.url)
      .then(res => {
        expect(res.statusCode).to.equal(200)
        expect(res.body).to.contain('Hello, World')
        done()
      }).catch(done)
    })

    it('should NOT serve files NOT in the given directory', (done) => {
      getPage(`${s.url}/../../README.md`)
      .then((res) => {
        expect(res.statusCode).to.equal(404)
        done()
      }).catch(done)
    })

    it('should serve files with the correct content type', (done) => {
      getPage(`${s.url}/peppers.png`)
      .then((res) => {
        expect(res.statusCode).to.equal(200)
        expect(res.headers['content-type']).to.equal('image/png')
        done()        
      }).catch(done)
    })
  })

  describe('defaults', () => {
    it('should serve files in the current directory by default', (done) => {
      swank({ log: false }).then(s => {
        getPage(`${s.url}/test/fixtures`).then(res => {
          expect(res.statusCode).to.equal(200)
          expect(res.body).to.contain('Hello, World')
          return s.close()
        })
      }).then(done).catch(() => s.close().then(done))
    })
  })

  describe('arguments', () => {
    it('should have a configurable port', (done) => {
      swank({path: 'test/fixtures', port: 1234, log: false})
        .then((s) => {
          getPage('http://localhost:1234').then(res => {
            expect(res.body).to.contain('Hello, World')
            return s.close()          
          })
          .then(done)
          .catch(() => s.close().then(done))
        })
    })

    it('should allow ngrok tunnelling', (done) => {
      swank({path: 'test/fixtures', ngrok: true, log: false})
        .then((s) => {
          expect(s.url).to.match(/https?:\/\/[a-z0-9]+.ngrok.io/)
          getPage(s.url).then(res => {
            expect(res.statusCode).to.equal(200)
            expect(res.body).to.contain('Hello, World')
            return s.close()            
          })
          .then(done)
          .catch(() => s.close().then(done))
        })
    }).timeout(10000)
  })

  describe('watch', () => {

    it('should insert livereload.js and have a watch server running', (done) => {
      swank({path: 'test/fixtures', watch: true, log: false}).then((s) => {
        getPage('http://localhost:35729')
          .then(res => {
            expect(res.statusCode).to.equal(200)
            return getPage(s.url)
          })
          .then(res => {
            expect(res.statusCode).to.equal(200)
            expect(res.body).to.contain('livereload.js')
            s.close()
          })
          .then(done)
          .catch(() => s.close().then(done))
      })
    })

    describe('simulate', () => {
      before(() => {
        // make a bunch of files
        rmrf.sync('test/fixtures/many')
        fs.mkdirSync('test/fixtures/many')
        for(let i = 0; i < 100; i++) {
          fs.writeFileSync(`test/fixtures/many/${i}.txt`, '')
        }
      })
      after(() => {
        rmrf.sync('test/fixtures/many')
      })

      it("shouldn't crash when changing many files", (done) => {
        swank({path: 'test/fixtures', watch: true, log: false}).then((s) => {
          // delete all the files
          rmrf.sync('test/fixtures/many')
          getPage('http://localhost:35729')
            .then((res) => {
              // livereload server should still be running
              expect(res.statusCode).to.equal(200)
              return s.close()
            }).then(done).catch(() => s.close().then(done))
        })
      })
    })

    describe('close', () => {

      it('should also close the livereload server after closing', (done) => {
        swank({path: 'test/fixtures', watch: true, log: false}).then((s) => {
          getPage('http://localhost:35729').then(res => {
            expect(res.statusCode).to.equal(200)
            return s.close()
          }).then(() => {
            return getPage('http://localhost:35729')
              .then((res) => done(new Error("expected request to throw")))
              .catch(err => done())
          }).catch(() => s.close().then(done))
        })
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

    it('should be runnable from the command line', (done) => {
      const proc = child_process.spawn('bin/swank', ['test/fixtures'])
      proc.stdout.once('data', (data) => {
        url = data.toString().replace('>', '').trim()
        expect(url).to.contain('http://localhost:8000')
        getPage('http://localhost:8000').then((res) => {
          expect(res.body).to.contain('Hello, World')
        }).then(done)
          .catch(done)
          .finally(() => proc.kill('SIGHUP'))
      })
    })

    it('should display a help message', (done) => {
      const proc = child_process.spawn('bin/swank', ['--help'])
      proc.stdout.once('data', (data) => {
        expect(data.toString()).to.contain('Usage: ')
        done()
      })
    })
  })

  describe('middleware', () => {
    it('should be usable as middleware', (done) => {
      const port = 8080
      const app = require('express')()
      app.get('/', (req, res) => res.sendStatus(200))
      const Swank = swank.Swank
      const middleware = new Swank({port: port, log: false, watch: true})
      app.use(middleware.app)
      const server = require('http').createServer(app)
      middleware.listenTo(server)
      server.listen(port, () => {
        getPage('http://localhost:8080')
        .then(res => {
          expect(res.statusCode).to.equal(200)
          return getPage('http://localhost:8080/test/fixtures')
        })
        .then(res => {
          expect(res.statusCode).to.equal(200)
          expect(res.body).to.contain('livereload.js')
          return getPage('http://localhost:35729')
        })
        .then(res => {
          expect(res.statusCode).to.equal(200)
        }).then(done)
          .catch(done)
          .finally(() => server.close())
      })
    })
  })
})
