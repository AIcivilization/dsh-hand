# dsh-hand

A zero-dependency "hand" for [DeepSeek Harness (DSH)](https://github.com/DeepSeek-AI) scripts: the small, boring things every automation task ends up re-writing — dotted-path object access, safe JSON I/O, hashing, running subprocesses, and retrying flaky work.

CommonJS, Node >= 18, no runtime dependencies. Install:

```bash
npm install dsh-hand
```

## CLI

```bash
npx dsh-hand --version
npx dsh-hand --help
npx dsh-hand api                        # list all exported functions
npx dsh-hand get config.json db.host    # read a JSON value by dotted path
npx dsh-hand set config.json db.port 5432
npx dsh-hand hash ./package-lock.json   # sha256 (or pass e.g. md5)
npx dsh-hand bytes 1536                 # 1.5 KB
npx dsh-hand slug 'Hello, DSH World!'   # hello-dsh-world
npx dsh-hand run git status --short     # stdout/stderr/exit code forwarded
```

## API

```js
const hand = require('dsh-hand');

hand.name;     // 'dsh-hand'
hand.version;  // '0.2.0'

// objects
hand.pick({ a: 1, b: 2 }, ['a']);              // { a: 1 }
hand.omit({ a: 1, b: 2 }, ['b']);              // { a: 1 }
hand.get(cfg, 'db.host', 'localhost');          // dotted-path read with fallback
hand.set(cfg, 'db.port', 5432);                 // creates intermediate containers
hand.unset(cfg, 'db.password');                 // true when removed
hand.merge(defaults, overrides);                // recursive, returns a fresh object
hand.deepClone(cfg);

// values
hand.clamp(15, 0, 10);                         // 10 (NaN -> min)
hand.slugify('Café déjà vu');                  // 'cafe-deja-vu'
hand.formatBytes(1536);                        // '1.5 KB'
hand.passthrough(fn);                          // forwards this/args/return

// files (atomic writes, UTF-8)
hand.fileExists('config.json');
hand.ensureDir('state/cache');                  // mkdir -p
hand.readText('note.txt', 'fallback');
hand.writeText('note.txt', 'hello');
hand.readJson('config.json', {});               // throws SyntaxError on bad JSON
hand.writeJson('config.json', { a: 1 });

// hashing
hand.hash('abc');                              // sha256 hex
hand.hashFile('package-lock.json', 'sha256');

// process
hand.which('node');                            // absolute path or null
hand.run('git', ['status', '--short']);        // { ok, code, stdout, stderr, signal, error }
hand.env('HOME', '/tmp');

// control
await hand.sleep(200);
await hand.retry(fetchFn, { tries: 5, delay: 100, factor: 2, onRetry(e, n) {} });
```

All functions are synchronous except `sleep` and `retry`, which return Promises.
`run` never throws on a non-zero exit; pass `{ throw: true }` to opt in. `set`
creates arrays when the next path segment is numeric.

## Development

```bash
npm run check   # node --check on entrypoints
npm test        # smoke tests (temporary files are cleaned up)
```

## License

MIT © aicivilization
