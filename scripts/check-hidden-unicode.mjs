#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const hiddenUnicodeControl = /[\u061C\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u;

function listFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    return [target];
  }
  if (!stat.isDirectory()) {
    return [];
  }

  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      return [];
    }
    return listFiles(path.join(target, entry.name));
  });
}

const targets = process.argv.slice(2);
const files = (targets.length > 0 ? targets : ['docs', 'reports', 'tasks'])
  .flatMap(listFiles)
  .filter((file) => file.endsWith('.md'));

const bad = files.filter((file) => hiddenUnicodeControl.test(fs.readFileSync(file, 'utf8')));

if (bad.length > 0) {
  console.error('Hidden/bidirectional Unicode control characters found:');
  console.error(bad.join('\n'));
  process.exit(1);
}
