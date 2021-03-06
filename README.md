
# Small vinyl-stream wrapper -aka Gulp plugin- for connect.

Run Connect from within your streams. Use via `src('folder/', { read: false })`. Don't use a glob!

- Supports serving multiple static paths as root. Gets the paths from the Vinyl stream. Remember to use `{ read: false }` and *don't use a glob*.
- Supports LiveReload functionality. The optional dependencies are lazy-loaded if LiveReload is set.

- Doesn't support running multiple servers simultaneously.
- Doesn't support a fallback `index.html`.
- Doesn't support HTTPS/HTTP2. This is meant for local development. Use a reverse SSH tunnel for that.

> *NOTE:* No tests have been written yet!

## Installation

`yarn install`. Or `npm install`. Or just copy the files to your own project.

## Usage

```javascript
const connectWrapper = require('@eklingen/vinyl-stream-connect')
stream.pipe(connectWrapper())
```

## Options

There are a few options:

### `host`

The hostname. Default is `'127.0.0.1'`. Try using `'0.0.0.0'` if you can't reach it from other devices within the network.

```javascript
connectWrapper({
  host: '127.0.0.1'
})
```

### `port`

The port number. Default is `8000`.

```javascript
connectWrapper({
  port: 8000
})
```

### `index`

The index file. Default is `index.html`. This option gets passed through to `serve-static`. For more options, see below.

```javascript
connectWrapper({
  index: 'index.html'
})
```

### `liveReload`

Turn live reload functionality on or off. Default is `false`.

```javascript
connectWrapper({
  liveReload: false
})
```

> *NOTE* When `true`, extra dependencies are needed. If you installed the package without optional dependencies, then install `connect-livereload`, `tiny-lr` and `chokidar` manually.

### `log`

You can precisely control the console output on the specific events. The defaults are in the example below.

```javascript
connectWrapper({
  log: {
    connection: false,
    request: false,
    error: true,
    start: true,
    stop: true,
    livereload: false
  }
})
```

For brevity, there are a few preset combinations you can use:

```javascript
const LOG = {
  default: { connection: false, request: false, error: true, start: true, stop: true, livereload: false },
  verbose: { connection: true, request: true, error: true, start: true, stop: true, livereload: true },
  quiet: { connection: false, request: false, error: true, start: false, stop: false, livereload: false }
}
```

Set these as a string.

```javascript
connectWrapper({
  log: 'quiet'
})
```

### `middleware`

Any option you set in the `middleware` object will be passed through verbatim, except `serveStatic.index` since `options.index` has priority. For more details on the available options, see ["serve-static"](https://www.npmjs.com/package/serve-static) and ["connect-livereload"](https://www.npmjs.com/package/connect-livereload). The defaults that are set within this package are shown in the example below.

```javascript
connectWrapper({
  middleware: {
    serveStatic: {
      dotfiles: 'ignore',
      index: <options.index>
    },

    connectLivereload: {
      port: 35729
    }
  }
})
```

## Dependencies

This package requires ["connect"](https://www.npmjs.com/package/connect) and ["serve-static"](https://www.npmjs.com/package/serve-static).

## Optional dependencies

When using the live reload functionality, this package also requires ["chokidar"](https://www.npmjs.com/package/chokidar), ["connect-livereload"](https://www.npmjs.com/package/connect-livereload) and ["tiny-lr"](https://www.npmjs.com/package/tiny-lr).

---

Copyright (c) 2019 Elco Klingen. MIT License.
