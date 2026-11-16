#!/usr/bin/env node
// Dev tool: renders an animated SVG frame-by-frame at exact times (inline SVG,
// CSS animations paused and seeked), then encodes a preview video/GIF with
// ffmpeg. Deterministic: the same SVG always gives the same frames.
//   node scripts/record.mjs <svg> <out.mp4|out.gif> [--from 0] [--to 12] [--fps 30] [--bg #0d1117] [--scale 2]
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [svgFile, out] = process.argv.slice(2);
const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const from = Number(opt('from', 0)) * 1000, to = Number(opt('to', 12)) * 1000, fps = Number(opt('fps', 30));
const bg = opt('bg', '#0d1117'), scale = Number(opt('scale', 1));
const svg = readFileSync(svgFile, 'utf8').replace(/<\?xml[^>]*>/, '');
const w = Number(/width="([\d.]+)"/.exec(svg)[1]), h = Number(/height="([\d.]+)"/.exec(svg)[1]);
const dir = resolve('.cache/frames');
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Math.ceil(w), height: Math.ceil(h) }, deviceScaleFactor: scale });
await page.setContent(`<body style="margin:0;background:${bg}">${svg}</body>`);
await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
let i = 0;
for (let t = from; t <= to; t += 1000 / fps) {
  await page.evaluate((ms) => document.getAnimations().forEach((a) => (a.currentTime = ms)), t);
  await page.screenshot({ path: join(dir, `f${String(i++).padStart(5, '0')}.png`) });
}
await browser.close();
const args = out.endsWith('.gif')
  ? ['-y', '-framerate', String(fps), '-i', join(dir, 'f%05d.png'), '-vf', 'split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0', out]
  : ['-y', '-framerate', String(fps), '-i', join(dir, 'f%05d.png'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', out];
execFileSync('ffmpeg', args, { stdio: 'ignore' });
console.log(`${i} frames → ${out}`);
