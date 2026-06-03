#!/usr/bin/env node
// Post-build: inject hashed asset paths into dist/sw.js so the service worker
// precaches the JS/CSS bundles (not just shell + sounds).
//
// public/sw.js is the source template with the marker. Vite copies it to
// dist/sw.js at build time. We rewrite dist/sw.js in place so the deployed
// service worker has the real hashed asset paths.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const distSwPath = resolve(root, "dist/sw.js");
const distHtmlPath = resolve(root, "dist/index.html");

if (!existsSync(distSwPath)) { console.error("dist/sw.js not found — run build first"); process.exit(1); }
if (!existsSync(distHtmlPath)) { console.error("dist/index.html not found — run build first"); process.exit(1); }

const html = readFileSync(distHtmlPath, "utf8");
const matches = [...html.matchAll(/(["'])\/assets\/[^"'?]+\.(js|css)\1/g)]
  .map((m) => m[0].slice(1, -1));
const assets = [...new Set(matches)];

const sw = readFileSync(distSwPath, "utf8");
const MARKER = "// __PRECACHE_ASSETS__";
if (!sw.includes(MARKER)) {
  // Already injected in a previous run — skip silently.
  console.log(`sw.js already injected (no marker). Skipping. Cached assets:`, assets);
  process.exit(0);
}

const replacement = `${MARKER}\nconst PRECACHE_ASSETS = ${JSON.stringify(assets, null, 2)};`;
const next = sw.replace(MARKER, replacement);
writeFileSync(distSwPath, next);
console.log(`Injected ${assets.length} precache assets into dist/sw.js:`, assets);
