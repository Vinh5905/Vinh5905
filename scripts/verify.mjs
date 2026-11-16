#!/usr/bin/env node
// Visual + structural checks of the README preview with Playwright/Chromium:
//  - desktop 1200px and mobile 390px, light and dark, animated and reduced-motion
//  - every image loads, nothing overflows horizontally, assets resolve
// Screenshots → .cache/preview/shots/ (docs/preview/ keeps a curated copy). Needs Playwright (dev only).
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = pathToFileURL(join(root, '.cache/preview/index.html')).href;
const outDir = join(root, '.cache/preview/shots');
mkdirSync(outDir, { recursive: true });

// all asset paths referenced from README exist
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const refs = [...readme.matchAll(/(?:src|srcset)="\.\/([^"]+)"/g)].map((m) => m[1]);
const missing = refs.filter((r) => !existsSync(join(root, r)));
if (missing.length) { console.error('missing assets:', missing); process.exitCode = 1; }
console.log(`README references ${refs.length} asset paths, all present: ${!missing.length}`);

const browser = await chromium.launch();
const cases = [
  { name: 'desktop', width: 1200 },
  { name: 'mobile', width: 390 },
];
for (const c of cases) for (const scheme of ['light', 'dark']) for (const motion of ['no-preference', 'reduce']) {
  const page = await browser.newPage({ viewport: { width: c.width, height: 3600 }, deviceScaleFactor: c.name === 'mobile' ? 2 : 1 });
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: motion });
  await page.goto(url);
  await page.waitForLoadState('load');
  // open the year toggles so their images are checked and visible in the shots
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
  await page.waitForTimeout(300);
  if (motion === 'no-preference') {
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(outDir, `${c.name}-${scheme}-entrance.png`), fullPage: false, clip: { x: 0, y: 0, width: c.width, height: Math.min(3600, await page.evaluate(() => document.body.scrollHeight)) } });
  }
  await page.waitForTimeout(motion === 'reduce' ? 300 : 4200);
  const report = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('article img')];
    const box = document.querySelector('article').getBoundingClientRect();
    return {
      scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      broken: imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc),
      overflow: imgs.filter((i) => i.getBoundingClientRect().right > box.right + 0.5).map((i) => i.currentSrc),
      sources: imgs.map((i) => i.currentSrc.split('/').pop()),
      widths: imgs.map((i) => Math.round(i.getBoundingClientRect().width)),
      article: Math.round(box.width),
    };
  });
  const tag = `${c.name}-${scheme}-${motion === 'reduce' ? 'static' : 'animated'}`;
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.screenshot({ path: join(outDir, `${tag}.png`), clip: { x: 0, y: 0, width: c.width, height: Math.min(3600, h) } });
  const ok = !report.scrollX && !report.broken.length && !report.overflow.length;
  if (!ok) process.exitCode = 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${tag}: article ${report.article}px, imgs ${report.widths.join('/')}, ${report.sources.join(' ')}`
    + (report.scrollX ? ' HORIZONTAL-SCROLL' : '') + (report.broken.length ? ` BROKEN ${report.broken}` : '') + (report.overflow.length ? ` OVERFLOW ${report.overflow}` : ''));
  await page.close();
}
await browser.close();
