'use strict';

const assert = require('node:assert/strict');
const hand = require('../index.js');

assert.equal(hand.name, 'dsh-hand');
assert.match(hand.version, /^\d+\.\d+\.\d+/);

assert.deepEqual(hand.pick({ a: 1, b: 2, c: 3 }, ['a', 'c']), { a: 1, c: 3 });
assert.deepEqual(hand.pick(null, ['a']), {});
assert.deepEqual(hand.pick({ a: 1 }, 'a'), {});

assert.equal(hand.clamp(5, 0, 10), 5);
assert.equal(hand.clamp(-3, 0, 10), 0);
assert.equal(hand.clamp(99, 0, 10), 10);
assert.equal(hand.clamp('abc', 0, 10), 0);

let seen = null;
const wrapped = hand.passthrough((x, y) => { seen = [x, y]; return x + y; });
assert.equal(wrapped(2, 3), 5);
assert.deepEqual(seen, [2, 3]);
assert.throws(() => hand.passthrough(123), TypeError);

console.log('smoke: ' + (5 + 3 + 2) + ' assertions passed');
