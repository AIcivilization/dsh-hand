'use strict';

/**
 * dsh-hand — a zero-dependency "hand" for DeepSeek Harness (DSH) scripts.
 *
 * Everything here is synchronous unless its name ends in `Async` or it is
 * explicitly documented as returning a Promise (`retry`, `sleep`).
 *
 * Sections:
 *   objects     pick / omit / get / set / unset / merge / deepClone
 *   values      clamp / slugify / formatBytes / passthrough
 *   files       fileExists / ensureDir / readText / writeText / readJson / writeJson
 *   hashing     hash / hashFile
 *   process     run / which / env
 *   control     retry / sleep
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const pkg = require('./package.json');

// ---------------------------------------------------------------- objects ---

/** Shallow copy keeping only the listed own keys. */
function pick(obj, keys) {
  if (obj == null || !Array.isArray(keys)) return {};
  const out = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) out[key] = obj[key];
  }
  return out;
}

/** Shallow copy without the listed own keys. */
function omit(obj, keys) {
  if (obj == null) return {};
  const drop = new Set(Array.isArray(keys) ? keys : []);
  const out = {};
  for (const key of Object.keys(obj)) {
    if (!drop.has(key)) out[key] = obj[key];
  }
  return out;
}

function isContainer(value) {
  return value !== null && typeof value === 'object';
}

function toSegments(dotted) {
  if (Array.isArray(dotted)) return dotted.map(String);
  if (typeof dotted === 'number') return [String(dotted)];
  return String(dotted).split('.').filter((s) => s.length > 0);
}

/** Read a dotted path (`a.b.0.c`) out of an object/array, with a fallback. */
function get(obj, dotted, fallback) {
  const segments = toSegments(dotted);
  let cur = obj;
  for (const seg of segments) {
    if (!isContainer(cur) || !Object.prototype.hasOwnProperty.call(cur, seg)) {
      return fallback;
    }
    cur = cur[seg];
  }
  return cur === undefined ? fallback : cur;
}

/**
 * Set a dotted path on an object, creating intermediate containers.
 * Mutates and returns `obj`. A numeric segment creates an array when the
 * parent container does not exist yet.
 */
function set(obj, dotted, value) {
  const segments = toSegments(dotted);
  if (segments.length === 0) throw new TypeError('set: path must not be empty');
  if (!isContainer(obj)) throw new TypeError('set: target must be an object or array');

  let cur = obj;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const seg = segments[i];
    if (!isContainer(cur[seg])) {
      cur[seg] = /^\d+$/.test(segments[i + 1]) ? [] : {};
    }
    cur = cur[seg];
  }
  cur[segments[segments.length - 1]] = value;
  return obj;
}

/** Delete a dotted path. Returns true when something was removed. */
function unset(obj, dotted) {
  const segments = toSegments(dotted);
  if (segments.length === 0) return false;
  const parent = segments.length === 1 ? obj : get(obj, segments.slice(0, -1));
  if (!isContainer(parent)) return false;
  const last = segments[segments.length - 1];
  if (!Object.prototype.hasOwnProperty.call(parent, last)) return false;
  if (Array.isArray(parent) && /^\d+$/.test(last)) parent.splice(Number(last), 1);
  else delete parent[last];
  return true;
}

/** Recursively merge plain objects. Later sources win; arrays are replaced. */
function merge(...sources) {
  const out = {};
  for (const src of sources) {
    if (!isContainer(src) || Array.isArray(src)) continue;
    for (const [key, value] of Object.entries(src)) {
      const prev = out[key];
      if (isContainer(value) && !Array.isArray(value) && isContainer(prev) && !Array.isArray(prev)) {
        out[key] = merge(prev, value);
      } else if (isContainer(value) && !Array.isArray(value)) {
        out[key] = merge({}, value);
      } else {
        out[key] = value;
      }
    }
  }
  return out;
}

function deepClone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

// ----------------------------------------------------------------- values ---

/** Constrain a number into [min, max]; NaN falls back to min. */
function clamp(n, min, max) {
  const value = Number(n);
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** Lowercase, ASCII-safe slug suitable for file names and config keys. */
function slugify(input) {
  return String(input == null ? '' : input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Human-readable byte size. */
function formatBytes(n) {
  const bytes = Number(n);
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

/** Wrap a function, forwarding `this`, args and return value unchanged. */
function passthrough(fn) {
  if (typeof fn !== 'function') throw new TypeError('passthrough expects a function');
  return function hand(...args) {
    return fn.apply(this, args);
  };
}

// ------------------------------------------------------------------ files ---

function fileExists(file) {
  try {
    fs.accessSync(path.resolve(file));
    return true;
  } catch {
    return false;
  }
}

/** mkdir -p. Returns the resolved directory. */
function ensureDir(dir) {
  const target = path.resolve(dir);
  fs.mkdirSync(target, { recursive: true });
  return target;
}

/** Read UTF-8 text, returning `fallback` when the file is missing. */
function readText(file, fallback) {
  try {
    return fs.readFileSync(path.resolve(file), 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return fallback;
    throw err;
  }
}

/** Atomic UTF-8 write (temp file in the same directory + rename). */
function writeText(file, text) {
  const target = path.resolve(file);
  ensureDir(path.dirname(target));
  const tmp = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, String(text), 'utf8');
    fs.renameSync(tmp, target);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* best effort */ }
    throw err;
  }
  return target;
}

/** Read and parse JSON, returning `fallback` when the file is missing. */
function readJson(file, fallback) {
  const text = readText(file, undefined);
  if (text === undefined) return fallback;
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new SyntaxError(`readJson: invalid JSON in ${file}: ${err.message}`);
  }
}

/** Pretty-print JSON to disk atomically. Returns the resolved path. */
function writeJson(file, value, options = {}) {
  const spaces = options.spaces === undefined ? 2 : options.spaces;
  const eol = options.eol === false ? '' : '\n';
  return writeText(file, JSON.stringify(value, null, spaces) + eol);
}

// ---------------------------------------------------------------- hashing ---

/** Hash a string/Buffer; returns hex. */
function hash(data, algorithm = 'sha256') {
  return crypto.createHash(algorithm).update(data).digest('hex');
}

/** sha256 of a file's contents, as hex. Reads the file into memory. */
function hashFile(file, algorithm = 'sha256') {
  return hash(fs.readFileSync(path.resolve(file)), algorithm);
}

// ---------------------------------------------------------------- process ---

/** Resolve an executable on PATH (or an explicit path). Returns null if absent. */
function which(cmd) {
  if (!cmd) return null;
  if (String(cmd).includes(path.sep)) return fileExists(cmd) ? path.resolve(cmd) : null;
  const dirs = (process.env.PATH || '').split(path.delimiter);
  const names = process.platform === 'win32'
    ? [cmd, `${cmd}.exe`, `${cmd}.cmd`, `${cmd}.bat`]
    : [cmd];
  for (const dir of dirs) {
    for (const name of names) {
      const candidate = path.join(dir || '.', name);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return path.resolve(candidate);
      } catch { /* keep looking */ }
    }
  }
  return null;
}

/**
 * Run a command synchronously without throwing.
 * Returns { ok, code, stdout, stderr, signal, error }.
 * Set options.throw to throw on a non-zero exit or spawn error.
 */
function run(cmd, args = [], options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeout,
    shell: Boolean(options.shell),
    input: options.input,
    maxBuffer: options.maxBuffer || 16 * 1024 * 1024,
  });
  const out = {
    ok: result.status === 0 && !result.error,
    code: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    signal: result.signal || null,
    error: result.error || null,
  };
  if (options.throw && !out.ok) {
    const why = out.error ? out.error.message : `exit ${out.code}: ${out.stderr.trim()}`;
    throw new Error(`run: ${cmd} failed — ${why}`);
  }
  return out;
}

/** Read an environment variable with a fallback. */
function env(name, fallback) {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

// ---------------------------------------------------------------- control ---

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

/** Retry an async (or sync) function with exponential backoff. */
async function retry(fn, options = {}) {
  if (typeof fn !== 'function') throw new TypeError('retry expects a function');
  const tries = Math.max(1, Number(options.tries) || 3);
  const delay = Number(options.delay) || 100;
  const factor = Number(options.factor) || 2;
  let lastError;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt === tries) break;
      if (typeof options.onRetry === 'function') options.onRetry(err, attempt);
      await sleep(delay * factor ** (attempt - 1));
    }
  }
  const error = new Error(`retry: failed after ${tries} attempts — ${lastError && lastError.message}`);
  error.cause = lastError;
  error.attempts = tries;
  throw error;
}

module.exports = {
  name: pkg.name,
  version: pkg.version,

  // objects
  pick, omit, get, set, unset, merge, deepClone,
  // values
  clamp, slugify, formatBytes, passthrough,
  // files
  fileExists, ensureDir, readText, writeText, readJson, writeJson,
  // hashing
  hash, hashFile,
  // process
  run, which, env,
  // control
  retry, sleep,
};
