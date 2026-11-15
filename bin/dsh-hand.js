#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const hand = require('../index.js');

const USAGE = `dsh-hand v${hand.version} — a zero-dependency helper hand for DSH scripts.

Usage:
  dsh-hand --version                 print the package version
  dsh-hand --help                    show this help
  dsh-hand api                       list exported functions
  dsh-hand get <file> <dotted.path>  read a JSON file and print a value
  dsh-hand set <file> <path> <value> write a value into a JSON file
  dsh-hand hash <file> [algorithm]   print the file hash (default sha256)
  dsh-hand bytes <number>            format a byte count
  dsh-hand slug <text>               slugify text
  dsh-hand run <command> [args...]   run a command, forward its output

Programmatic API:
  const hand = require('dsh-hand');
  hand.pick(obj, keys) / hand.merge(a, b) / hand.readJson(file)
  hand.run('git', ['status']) / await hand.retry(fn) / hand.hashFile(file)
`;

const args = process.argv.slice(2);
const cmd = args[0];

function jsonValue(raw) {
  try { return JSON.parse(raw); } catch { return raw; }
}

function fail(message) {
  console.error(`dsh-hand: ${message}`);
  process.exit(1);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log(hand.version);
  process.exit(0);
}
if (!cmd || args.includes('--help') || args.includes('-h') || cmd === 'help') {
  console.log(USAGE.trimEnd());
  process.exit(0);
}

switch (cmd) {
  case 'api': {
    console.log(Object.keys(hand).sort().join('\n'));
    break;
  }
  case 'get': {
    const [, file, dotted] = args;
    if (!file || !dotted) fail('usage: dsh-hand get <file> <dotted.path>');
    const data = hand.readJson(file);
    if (data === undefined) fail(`cannot read JSON from ${file}`);
    const value = hand.get(data, dotted, undefined);
    if (value === undefined) fail(`path not found: ${dotted}`);
    console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    break;
  }
  case 'set': {
    const [, file, dotted, ...rest] = args;
    if (!file || !dotted || rest.length === 0) fail('usage: dsh-hand set <file> <path> <value>');
    const data = hand.readJson(file, {}) || {};
    hand.set(data, dotted, jsonValue(rest.join(' ')));
    hand.writeJson(file, data);
    console.log(`wrote ${dotted} -> ${file}`);
    break;
  }
  case 'hash': {
    const [, file, algorithm = 'sha256'] = args;
    if (!file) fail('usage: dsh-hand hash <file> [algorithm]');
    if (!hand.fileExists(file)) fail(`no such file: ${file}`);
    const stat = fs.statSync(path.resolve(file));
    if (stat.isDirectory()) fail(`expected a file, got a directory: ${file}`);
    console.log(hand.hashFile(file, algorithm));
    break;
  }
  case 'bytes': {
    if (args[1] === undefined) fail('usage: dsh-hand bytes <number>');
    console.log(hand.formatBytes(args[1]));
    break;
  }
  case 'slug': {
    console.log(hand.slugify(args.slice(1).join(' ')));
    break;
  }
  case 'run': {
    const rest = args.slice(1);
    if (rest.length === 0) fail('usage: dsh-hand run <command> [args...]');
    const result = hand.run(rest[0], rest.slice(1));
    if (result.error) fail(result.error.message);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.code === null ? 1 : result.code);
    break;
  }
  default:
    fail(`unknown command: ${cmd} (try --help)`);
}
