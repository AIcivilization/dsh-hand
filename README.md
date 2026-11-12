# dsh-hand

A small helper "hand" for [DeepSeek Harness (DSH)](https://github.com) scripts — reserved name scaffold plus a few dependency-free utilities.

> Name reserved on npm by `aicivilization`. This is the initial scaffold release; the API is intentionally tiny and stable.

## Install

```bash
npm install dsh-hand
```

## CLI

```bash
npx dsh-hand --version
npx dsh-hand --help
```

## API

```js
const hand = require('dsh-hand');

hand.name;                       // 'dsh-hand'
hand.version;                    // '0.1.0'

hand.pick({ a: 1, b: 2 }, ['a']);  // { a: 1 }
hand.clamp(15, 0, 10);              // 10
hand.passthrough(fn);               // wrapped function, same args/result
```

| Function | Description |
| --- | --- |
| `pick(obj, keys)` | Shallow copy with only the listed own keys. |
| `clamp(n, min, max)` | Constrain a number into `[min, max]`; NaN falls back to `min`. |
| `passthrough(fn)` | Wrap a function, forwarding `this`, args and return value unchanged. |

## Development

```bash
npm run check   # node --check on entrypoints
npm test        # smoke tests
```

## License

MIT © aicivilization
