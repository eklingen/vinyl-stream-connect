// Small vinyl-stream wrapper -aka Gulp plugin- for Connect. Optional livereload dependencies are lazy-loaded.
// Can be used like other transform plugins via `src('folder/', { read: false })`. Don't use a glob.
//
// Doesn't support running multiple servers simultaneously. Use `gulp-connect` for that.
// Doesn't support https - use a reverse SSH tunnel for that.
//
// Has the `serve-static` middleware built-in. Can use multiple roots. Gets serve roots from the Vinyl stream. Use `{ read: false }`.
// Has the `connect-livereload` middleware built-in. Serves the script via `tinylr`. Watches via `chokidar`.

const { createServer } = require('http')
const { Transform } = require('stream')

const LOG = {
  default: { connection: false, request: false, error: true, start: true, stop: true, livereload: false },
  verbose: { connection: true, request: true, error: true, start: true, stop: true, livereload: true },
  quiet: { connection: false, request: false, error: true, start: false, stop: false, livereload: false }
}

const DEFAULT_OPTIONS = {
  host: '127.0.0.1',
  port: 8000,
  index: 'index.html',
  liveReload: false,
  log: LOG.default,
  middleware: {
    // any options you set will be passed straight through, except `servestatic.index` since `options.index` will be used instead.
    serveStatic: { dotfiles: 'ignore' },
    connectLivereload: { port: 35729 }
  }
}

const OPTIONAL_PACKAGES_ERROR = 'You need the `chokidar`, `connect-livereload` and `tiny-lr` packages installed to use live reload functionality.'

function watchDebounce (paths = [], callback = () => {}) {
  let chokidar

  try {
    chokidar = require('chokidar')
  } catch (e) {
    throw Error(OPTIONAL_PACKAGES_ERROR)
  }

  const debounceEvent = (callback, time = 250, interval) => (...args) => {
    clearTimeout(interval)
    interval = setTimeout(() => callback(...args), time)
  }

  const chokidarOptions = { ignoreInitial: true, followSymlinks: false, disableGlobbing: true }
  const watcher = chokidar.watch(paths, chokidarOptions)

  function onChange (filepath, error) {
    if (error && watcher.listenerCount('error')) {
      watcher.emit('error', error)
      return
    }

    debounceEvent(callback(filepath), 250)
  }

  watcher.on('change', (filepath, error) => onChange(filepath, error))

  return watcher
}

function connectWrapper (options = {}) {
  const connect = require('connect')()
  const serveStatic = require('serve-static')

  let livereload
  let tinylr

  options = { ...DEFAULT_OPTIONS, ...options }
  options.log = LOG[options.log] || { ...DEFAULT_OPTIONS.log, ...options.log }
  options.middleware.serveStatic = { ...DEFAULT_OPTIONS.middleware.serveStatic, ...options.middleware.serveStatic }
  options.middleware.connectLivereload = { ...DEFAULT_OPTIONS.middleware.connectLivereload, ...options.middleware.connectLivereload }

  const paths = []
  const middleware = []
  const sockets = []

  let server
  let reloadServer
  let watcher

  function onServerStart (error, callback) {
    if (error && options.log.error) {
      console.error('Error starting webserver:', error)
    }

    if (options.liveReload) {
      try {
        tinylr = require('tiny-lr')
      } catch (e) {
        throw Error(OPTIONAL_PACKAGES_ERROR)
      }

      tinylr.Server.prototype.error = () => {} // Swallow EPIPE errors

      reloadServer = tinylr()
      reloadServer.listen(options.middleware.connectLivereload.port)

      watcher = watchDebounce(paths, filepath => {
        if (options.log.livereload) {
          console.log('Sending', filepath, 'to livereload')
        }

        reloadServer.changed({ body: { files: filepath } })
      })
    }

    if (options.log.start) {
      console.log(`Webserver started on http://${options.host}:${options.port}`, reloadServer ? `(LiveReload port ${options.middleware.connectLivereload.port})` : '')
    }
  }

  function onServerClose () {
    if (options.log.stop) {
      console.log('Webserver stopped')
    }

    if (watcher) {
      watcher.close()
      watcher = null
    }

    if (reloadServer) {
      reloadServer.close()
      reloadServer = null

      if (options.log.stop) {
        console.log(`LiveReload on port ${options.middleware.connectLivereload.port} stopped`)
      }
    }
  }

  function onServerConnection (socket) {
    if (options.log.connection) {
      console.log('Connection from ' + socket.address().address)
    }

    sockets.push(socket)

    return socket.on('close', () => sockets.splice(sockets.indexOf(socket), 1))
  }

  function onServerRequest (request, response) {
    if (options.log.request) {
      console.log(`Request ${request.method} ${request.url}`)
    }
  }

  function onServerError (error) {
    if (options.log.error) {
      console.error(error.toString())
    }
  }

  function onProcessExit () {
    sockets.forEach(socket => socket.destroy())

    if (server) {
      server.close()
      server = null
    }

    // We got here via process.exit(), so we return the same way, or the process won't exit.
    return process.nextTick(() => process.exit(0)) // eslint-disable-line no-process-exit
  }

  function transform (file, encoding, callback) {
    if (file.contents) { // Not a directory
      return
    }

    // Save the root path
    paths.push(file.path)

    // Then remove it from the stream
    return callback()
  }

  function flush (callback) {
    paths.forEach(path => middleware.push(serveStatic(path, { ...options.middleware.serveStatic, index: options.index })))

    if (options.liveReload) {
      try {
        livereload = require('connect-livereload')
      } catch (e) {
        throw Error(OPTIONAL_PACKAGES_ERROR)
      }

      middleware.unshift(livereload(options.middleware.connectLivereload))
    }

    middleware.forEach(plugin => connect.use(plugin))
    server = createServer(connect)

    server.on('close', () => onServerClose())
    server.on('connection', socket => onServerConnection(socket))
    server.on('request', (request, response) => onServerRequest(request, response))
    server.on('error', error => onServerError(error))

    process.on('exit', () => onProcessExit())
    process.on('SIGINT', () => onProcessExit())

    server.listen(options.port, options.host, error => onServerStart(error))

    callback()
  }

  return new Transform({ transform, flush, readableObjectMode: true, writableObjectMode: true })
}

module.exports = connectWrapper
