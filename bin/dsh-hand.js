#!/usr/bin/env node
'use strict';

const hand = require('../index.js');

const args = process.argv.slice(2);
if (args.includes('--version') || args.includes('-v')) {
  console.log(hand.version);
  process.exit(0);
}
if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log('dsh-hand v' + hand.version);
  console.log('Usage: dsh-hand [--version] [--help]');
  console.log('');
  console.log('A small helper hand for DSH scripts. Programmatic API:');
  console.log('  const hand = require("dsh-hand");');
  console.log('  hand.pick(obj, keys) / hand.clamp(n, min, max) / hand.passthrough(fn)');
  process.exit(0);
}
console.error('unknown option: ' + args[0]);
process.exit(1);
