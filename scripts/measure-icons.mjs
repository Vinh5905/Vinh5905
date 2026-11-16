#!/usr/bin/env node
// Measures the drawn bounding box of each vendored logo (Playwright/Chromium)
// and stores it in assets/icons/metrics.json. The build uses these boxes to give
// every logo the same optical size instead of the same nominal width/height.
// Needs Playwright only when the icon set changes (part of `npm run vendor`).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.error('Playwright is not installed: `npm i -D playwright && npx playwright install chromium`'); process.exit(1);
}
const dir = join(root, 'assets/icons');
const files = readdirSync(dir).filter((f) => f.endsWith('.svg'));
const browser = await chromium.launch();
const page = await browser.newPage();
const out = {};
for (const f of files) {
  const svg = readFileSync(join(dir, f), 'utf8').replace(/<\?xml[^>]*>/, '');
  await page.setContent(`<div id="h">${svg}</div>`);
  out[f.replace('.svg', '')] = await page.evaluate(() => {
    const s = document.querySelector('#h svg');
    const vb = s.viewBox.baseVal;
    const b = s.getBBox();
    const r = (v) => Math.round(v * 100) / 100;
    return { viewBox: [vb.x, vb.y, vb.width, vb.height].map(r), bbox: [b.x, b.y, b.width, b.height].map(r) };
  });
}
await browser.close();
writeFileSync(join(dir, 'metrics.json'), '{\n' + Object.entries(out).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n}\n');
console.log(`measured ${files.length} icons`);
