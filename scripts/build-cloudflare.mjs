import { readFileSync, writeFileSync } from 'node:fs';

// Generate a dependency-free advanced-mode Pages Worker from reviewed sources.
// Moderation stays shared with Express instead of maintaining another word list.
const moderation = readFileSync('server/moderation.js', 'utf8').replace(/^export /gm, '');
const worker = readFileSync('cloudflare/worker.mjs', 'utf8')
  .replace("import { containsBannedWord } from '../server/moderation.js';", moderation);
writeFileSync('dist/_worker.js', worker);
writeFileSync('dist/_routes.json', JSON.stringify({ version: 1, include: ['/*'], exclude: [] }));
console.log('Cloudflare Worker packaged with the production frontend.');
