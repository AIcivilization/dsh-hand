'use strict';

/**
 * dsh-hand — a tiny helper "hand" for DSH scripts.
 *
 * Public API:
 *   version            : package version string
 *   pick(obj, keys)    : return a shallow copy with only the given keys
 *   clamp(n, min, max) : constrain a number into [min, max]
 *   passthrough(fn)    : wrap a function, forwarding args and result unchanged
 */

const pkg = require('./package.json');

function pick(obj, keys) {
  if (obj == null || !Array.isArray(keys)) return {};
  const out = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) out[key] = obj[key];
  }
  return out;
}

function clamp(n, min, max) {
  const value = Number(n);
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function passthrough(fn) {
  if (typeof fn !== 'function') throw new TypeError('passthrough expects a function');
  return function hand(...args) {
    return fn.apply(this, args);
  };
}

module.exports = {
  version: pkg.version,
  name: pkg.name,
  pick,
  clamp,
  passthrough,
};
