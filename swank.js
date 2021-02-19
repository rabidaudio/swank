const path = require('path')
const Url = require('url')
const http = require('http')
const connect = require('connect')
const serveStatic = require('serve-static')
const colors = require('colors/safe')
const open = require('open')
const childProcess = require('child_process')
const ReadlineStream = require('readline-stream')
const { isObject } = require('lodash')
const { debounce } = require('debounce')

class Swank {
  constructor (opts) {
    this.host = 'localhost'
    this.opts = opts || {}

    this.app = connect()

    if (this.ngrok && this.watch) {
      throw new Error('ngrok and watch options cannot currently be used at the same time, because a parallel web socket server on a different port is requred for live reload.')
    }

    if (this.log) {
      this.app.use(this.getLogger())
    }

    // liveReload injection needs to come before serveStatic
    if (this.watch) {
      this.watchForFileChanges()
      // inject script into pages
      this.app.use(require('connect-livereload')(this.liveReloadOpts))
      // listen for reload requests
      this.liveReloadServer = require('tiny-lr')()
    }

    // actualy serve files
    this.app.use(serveStatic(this.dir))
  }

  get port () {
    return this.opts.port || process.env.PORT || 8000
  }

  get dir () {
    return this.opts.path || process.cwd()
  }

  get log () {
    return this.opts.log === undefined ? true : this.opts.log
  }

  get watch () {
    return this.opts.watch
  }

  get url () {
    if (this.ngrok) {
      return this.ngrokUrl
    }
    return Url.format({ protocol: 'http', hostname: this.host, port: this.port })
  }

  get liveReloadUrl () {
    return Url.format({ protocol: 'http', hostname: this.host, port: this.liveReloadOpts.port })
  }

  get ngrok () {
    return this.opts.ngrok
  }

  getLogger () {
    const format = isObject(this.opts.log) && this.opts.log.format ? this.opts.log.format : 'combined'
    const logOpts = isObject(this.opts.log) && this.opts.log.opts ? this.opts.log.opts : {}
    return require('morgan')(format, logOpts)
  }

  get liveReloadOpts () {
    const opts = (isObject(this.opts.watch) && this.opts.watch.opts ? this.opts.watch.opts : {})
    opts.port = opts.port || 35729
    return opts
  }

  listenTo (server) {
    // when the app starts, also start ngrok and the lr server
    server.addListener('listening', () => {
      (async () => {
        if (this.watch) {
          await this.startWatch()
        }
        if (this.ngrok) {
          await this.startNgrok()
        }
        server.emit('swank_started', this)
      })()
    })
    // when the main server is closed, also close ngrok and the liveReload server
    server.addListener('close', this.close)
  }

  startWatch () {
    return new Promise(resolve => {
      this.liveReloadServer.listen(this.liveReloadOpts.port, null, resolve)
    })
  }

  async startNgrok () {
    // TODO: accept ngrok options like subdomain/hostname
    this.ngrokProc = childProcess.spawn('ngrok', ['http', this.port, '--log', 'stdout', '--log-format', 'json'])
    this.ngrokUrl = await new Promise((resolve, reject) => {
      this.ngrokProc.on('error', (err) => {
        if (err.code === 'ENOENT') {
          reject(new Error('Unable to find ngrok binary. Ngrok must be installed before use.' +
            ' For directions, see: https://ngrok.com/download'))
        } else {
          reject(err)
        }
      })
      const logStream = new ReadlineStream({})
      this.ngrokProc.stdout.pipe(logStream)
      logStream.on('data', (line) => {
        if (this.log) {
          console.log(line.toString().replace(/\s+$/, ''))
        }
        const data = JSON.parse(line)
        if (data.msg === 'started tunnel' && data.name === 'command_line') {
          resolve(data.url)
        }
      })
    })
  }

  async serve () {
    try {
      // create HTTP server
      this.server = http.createServer(this.app)
      if (this.watch) {
        await this.startWatch()
      }
      if (this.ngrok) {
        await this.startNgrok()
      }
      await new Promise(resolve => this.server.listen(this.port, resolve))
      return this
    } catch (e) {
      await this.close()
      throw e
    }
  }

  async close () {
    if (this.watch) {
      this.liveReloadServer.close()
      await this.watcher.close()
    }
    if (this.ngrok) {
      this.ngrokProc.kill('SIGHUP')
    }
    if (this.server && this.server.listening) {
      await new Promise((resolve, reject) => this.server.close((err) => err ? reject(err) : resolve()))
    }
  }

  triggerReload () {
    var data = JSON.stringify({ files: this.changedFiles })
    var req = http.request(this.liveReloadUrl, {
      path: '/changed',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    })
    req.write(data)
    req.end()
    this.changedFiles = []
  }

  watchForFileChanges () {
    this.watcher = require('chokidar').watch(this.dir)
    // keep an array of all recently changed files
    this.changedFiles = []
    const interval = this.opts.interval || 1000
    // when a file changes, cause a reload
    this.watcher.on('raw', (event, path) => {
      if (event !== 'created' && event !== 'modified') {
        return
      }
      this.changedFiles.push(path)
      // send an update of all changed files, debounced every interval
      debounce(this.triggerReload, interval, true).bind(this)()
    })
  }
}

function serve (opts) {
  return new Swank(opts).serve()
}

// run with command line arguments
function processArgs () {
  const knownOpts = {
    port: Number,
    path: path,
    help: Boolean,
    log: Boolean,
    open: Boolean,
    ngrok: Boolean,
    watch: Boolean,
    interval: Number
  }

  const shortHands = {
    p: '--port',
    d: '--path',
    h: '--help',
    l: '--log',
    o: '--open',
    n: '--ngrok',
    w: '--watch',
    i: '--interval',
    s: '--no-log',
    silent: '--no-log',
    usage: '--help'
  }

  const opts = require('nopt')(knownOpts, shortHands)

  // take path if not given explicitly
  if (!opts.path && opts.argv.remain.length > 0) {
    opts.path = path.resolve(opts.argv.remain.join(' '))
  }

  // start by returning usage info if requested
  if (opts.help) {
    console.log(`
      Usage: swank [[--silent]] [[--open | -o]] [[--ngrok | -n]] [[--watch | -w]] [[--interval | -i SECONDS]] [[--port | -p PORT]] [[ [[--path | -d]] root_directory]]

      --ngrok: pipe your server through [ngrok's](https://www.npmjs.org/package/ngrok) local tunnel
      --watch: a watch+livereload server. Includes "livereload.js" in HTML files, starts the livereload server, and watches your directory, causing a reload when files change
      --open: open a browser after the server starts
      --interval: watch interval. Defaults to 1s
      --silent: disable logging of requests
      --port: specify the local port to use. Defaults to $PORT or 8000
      --path: the path to the root directory of the server. Defaults to the current working directory
    `)
    process.exit(0)
  }

  serve(opts)
    .then(swank => {
      console.log(colors.green(`\n${swank.url}\n\n`))
      if (opts.open) {
        return open(swank.url)
      }
    })
    .catch(err => console.error(colors.red(err.message)))
}

serve.Swank = Swank
serve.processArgs = processArgs

module.exports = serve
