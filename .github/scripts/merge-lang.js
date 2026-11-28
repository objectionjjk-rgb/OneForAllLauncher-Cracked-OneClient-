#!/usr/bin/env node
// Three-way merge for a conflicted lang JSON file.
// Index stages: 1 = merge base, 2 = ours (this fork), 3 = theirs (upstream).
// Starts from upstream's version, then re-applies the fork's own additions and
// customizations (keys this fork added or changed relative to the merge base).
const { execFileSync } = require('child_process');
const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('usage: merge-lang.js <path>');
  process.exit(2);
}

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

// Map of stage number -> blob sha for the conflicted path.
const index = {};
for (const line of git(['ls-files', '-u', '--', file]).split('\n')) {
  if (!line.trim()) continue;
  const meta = line.split('\t')[0].split(/\s+/);
  index[meta[2]] = meta[1];
}

if (!index[2] || !index[3]) {
  console.error('missing ours/theirs stages for ' + file + ' (stages: ' + Object.keys(index).join(',') + ')');
  process.exit(1);
}

const parse = (stage) => (stage ? JSON.parse(git(['cat-file', '-p', stage])) : {});
const base = parse(index[1]);
const ours = parse(index[2]);
const theirs = parse(index[3]);

const result = { ...theirs };
for (const [key, value] of Object.entries(ours)) {
  const inBase = Object.prototype.hasOwnProperty.call(base, key);
  const changedByUs = !inBase || JSON.stringify(base[key]) !== JSON.stringify(value);
  if (changedByUs) {
    result[key] = value;
  }
}

fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
console.log('merged ' + file + ': ' + Object.keys(result).length + ' keys');
