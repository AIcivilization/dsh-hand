'use strict';

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const hand = require('../index.js');

let passed = 0;
function ok(label, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    console.error(`FAIL: ${label}\n  ${err.message}`);
    process.exitCode = 1;
  }
}
async function okAsync(label, fn) {
  try {
    await fn();
    passed += 1;
  } catch (err) {
    console.error(`FAIL: ${label}\n  ${err.message}`);
    process.exitCode = 1;
  }
}

// --- identity ---
ok('name', () => assert.equal(hand.name, 'dsh-hand'));
ok('version', () => assert.match(hand.version, /^\d+\.\d+\.\d+/));
ok('api is an object with expected exports', () => {
  for (const key of ['pick', 'omit', 'get', 'set', 'unset', 'merge', 'deepClone',
    'clamp', 'slugify', 'formatBytes', 'passthrough', 'fileExists', 'ensureDir',
    'readText', 'writeText', 'readJson', 'writeJson', 'hash', 'hashFile',
    'run', 'which', 'env', 'retry', 'sleep']) {
    assert.equal(typeof hand[key], 'function', `${key} should be a function`);
  }
});

// --- objects ---
ok('pick', () => {
  assert.deepEqual(hand.pick({ a: 1, b: 2, c: 3 }, ['a', 'c']), { a: 1, c: 3 });
  assert.deepEqual(hand.pick(null, ['a']), {});
  assert.deepEqual(hand.pick({ a: 1 }, 'a'), {});
});
ok('omit', () => {
  assert.deepEqual(hand.omit({ a: 1, b: 2, c: 3 }, ['b']), { a: 1, c: 3 });
  assert.deepEqual(hand.omit(null, ['a']), {});
});
ok('get / set / unset', () => {
  const obj = { a: { b: [10, { c: 'x' }] } };
  assert.equal(hand.get(obj, 'a.b.1.c'), 'x');
  assert.equal(hand.get(obj, 'a.nope', 'default'), 'default');
  hand.set(obj, 'a.b.2.deep', 42);
  assert.equal(hand.get(obj, 'a.b.2.deep'), 42);
  assert.equal(hand.unset(obj, 'a.b.1.c'), true);
  assert.equal(hand.get(obj, 'a.b.1.c'), undefined);
  assert.equal(hand.unset(obj, 'a.b.1.c'), false);
});
ok('set creates arrays for numeric segments', () => {
  const obj = {};
  hand.set(obj, 'items.0.name', 'first');
  assert.ok(Array.isArray(obj.items));
  assert.equal(obj.items[0].name, 'first');
});
ok('merge is a recursive deep copy, not a reference', () => {
  const a = { db: { host: 'a', port: 1 }, tags: ['x'] };
  const b = { db: { port: 2 }, tags: ['y'] };
  const out = hand.merge(a, b);
  assert.deepEqual(out, { db: { host: 'a', port: 2 }, tags: ['y'] });
  assert.notStrictEqual(out.db, a.db);
  out.db.host = 'changed';
  assert.equal(a.db.host, 'a');
});
ok('deepClone', () => {
  const src = { nested: { list: [1, 2, 3] } };
  const copy = hand.deepClone(src);
  assert.deepEqual(copy, src);
  assert.notStrictEqual(copy.nested, src.nested);
});

// --- values ---
ok('clamp', () => {
  assert.equal(hand.clamp(5, 0, 10), 5);
  assert.equal(hand.clamp(-3, 0, 10), 0);
  assert.equal(hand.clamp(99, 0, 10), 10);
  assert.equal(hand.clamp('abc', 0, 10), 0);
});
ok('slugify', () => {
  assert.equal(hand.slugify('Hello, DSH World!'), 'hello-dsh-world');
  assert.equal(hand.slugify('  A  B  '), 'a-b');
  assert.equal(hand.slugify('Café déjà vu'), 'cafe-deja-vu');
});
ok('formatBytes', () => {
  assert.equal(hand.formatBytes(512), '512 B');
  assert.equal(hand.formatBytes(1024), '1.0 KB');
  assert.equal(hand.formatBytes(1536), '1.5 KB');
  assert.equal(hand.formatBytes(1048576), '1.0 MB');
  assert.equal(hand.formatBytes(-1), '0 B');
});
ok('passthrough forwards this/args/return', () => {
  const receiver = { base: 10 };
  const wrapped = hand.passthrough(function add(x) { return this.base + x; });
  assert.equal(wrapped.call(receiver, 5), 15);
  assert.throws(() => hand.passthrough(123), TypeError);
});

// --- files (isolated temp dir) ---
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-hand-test-'));
ok('ensureDir + fileExists', () => {
  const dir = path.join(tmp, 'a/b/c');
  assert.equal(hand.ensureDir(dir), path.resolve(dir));
  assert.equal(hand.fileExists(dir), true);
  assert.equal(hand.fileExists(path.join(tmp, 'nope')), false);
});
ok('writeText / readText / fallback', () => {
  const file = path.join(tmp, 'note.txt');
  hand.writeText(file, 'hello\n');
  assert.equal(hand.readText(file), 'hello\n');
  assert.equal(hand.readText(path.join(tmp, 'missing'), 'fallback'), 'fallback');
  assert.equal(fs.readdirSync(tmp).some((n) => n.endsWith('.tmp')), false);
});
ok('writeJson / readJson', () => {
  const file = path.join(tmp, 'config.json');
  hand.writeJson(file, { a: 1, nested: { ok: true } });
  const back = hand.readJson(file);
  assert.deepEqual(back, { a: 1, nested: { ok: true } });
  assert.match(fs.readFileSync(file, 'utf8'), /\n$/);
});
ok('readJson reports invalid JSON', () => {
  const file = path.join(tmp, 'bad.json');
  hand.writeText(file, '{not json');
  assert.throws(() => hand.readJson(file), /invalid JSON/);
});

// --- hashing ---
ok('hash', () => {
  assert.equal(hand.hash('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
ok('hashFile', () => {
  const file = path.join(tmp, 'note.txt');
  assert.equal(hand.hashFile(file), hand.hash(fs.readFileSync(file)));
});

// --- process ---
ok('which finds node', () => {
  assert.equal(hand.which('node'), path.resolve(process.execPath));
  assert.equal(hand.which('definitely-not-a-real-binary-xyz'), null);
});
ok('run captures output without throwing', () => {
  const result = hand.run(process.execPath, ['-e', "process.stdout.write('ok');process.stderr.write('err')"]);
  assert.equal(result.ok, true);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, 'ok');
  assert.equal(result.stderr, 'err');
});
ok('run reports failure and supports throw', () => {
  const result = hand.run(process.execPath, ['-e', 'process.exit(7)']);
  assert.equal(result.ok, false);
  assert.equal(result.code, 7);
  assert.throws(() => hand.run(process.execPath, ['-e', 'process.exit(7)'], { throw: true }), /failed/);
});
ok('env fallback', () => {
  process.env.DSH_HAND_TEST_VAR = 'value';
  assert.equal(hand.env('DSH_HAND_TEST_VAR'), 'value');
  delete process.env.DSH_HAND_TEST_VAR;
  assert.equal(hand.env('DSH_HAND_TEST_VAR', 'fallback'), 'fallback');
});

// --- control (async) ---
(async () => {
  await okAsync('sleep resolves', async () => {
    const start = Date.now();
    await hand.sleep(5);
    assert.ok(Date.now() - start >= 3);
  });
  await okAsync('retry succeeds after transient failures', async () => {
    let calls = 0;
    const value = await hand.retry(async () => {
      calls += 1;
      if (calls < 3) throw new Error('transient');
      return 'done';
    }, { tries: 5, delay: 1 });
    assert.equal(value, 'done');
    assert.equal(calls, 3);
  });
  await okAsync('retry exhausts and reports attempts', async () => {
    await assert.rejects(
      hand.retry(async () => { throw new Error('always'); }, { tries: 2, delay: 1 }),
      /failed after 2 attempts/,
    );
  });

  // cleanup
  fs.rmSync(tmp, { recursive: true, force: true });
  if (process.exitCode) {
    console.error(`smoke: ${passed} passed, some assertions FAILED`);
  } else {
    console.log(`smoke: ${passed} checks passed`);
  }
})();
