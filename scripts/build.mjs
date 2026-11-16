#!/usr/bin/env node
// Renders every profile asset (light/dark × animated/static) from
//   profile.config.json + config/theme.json + config/icons.json + data/github-stats.json
// into assets/generated/. Output is written to a temp folder first and only
// swapped in when every asset rendered, so a failure never leaves half a set.
import { mkdirSync, readFileSync, writeFileSync, rmSync, renameSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFonts } from './lib/fonts.mjs';
import { loadData } from './lib/data.mjs';
import { renderLandscape } from './render/landscape.mjs';
import { renderSkills } from './render/stack.mjs';
import { renderCharts } from './render/charts.mjs';
import { renderDivider } from './render/divider.mjs';
import { readme, staticPage } from './lib/readme.mjs';
import { renderSummary } from './render/summary.mjs';
import { contributionDays, streakStats } from './lib/streak.mjs';
import { renderHero } from './render/hero.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const config = readJson('profile.config.json');
const theme = readJson('config/theme.json');
const iconSpecs = readJson('config/icons.json');
const data = loadData(join(root, 'data/github-stats.json'));
if (data.username.toLowerCase() !== config.github.username.toLowerCase())
  throw new Error(`data is for "${data.username}" but config.github.username is "${config.github.username}"`);
const fonts = await loadFonts(root);
// per-year calendars (data/years/<year>.json), newest first
const yearsDir = join(root, 'data/years');
const years = existsSync(yearsDir)
  ? readdirSync(yearsDir).filter((f) => /^\d{4}\.json$/.test(f)).map((f) => loadData(join(yearsDir, f))).sort((a, b) => b.year - a.year)
  : [];
// all-time streak stats from every year file + the rolling calendar
const streak = streakStats(contributionDays([...years.map((y) => y.calendar), data.calendar], data.calendar[data.calendar.length - 1].date));

const assets = {
  ...Object.fromEntries(Object.entries(config.sections).flatMap(([id, label]) => [
    [`section-${id}`, (ctx) => renderDivider({ ...ctx, label })],
    [`section-${id}-compact`, (ctx) => renderDivider({ ...ctx, label, compact: true })],
  ])),
  hero: (ctx) => renderHero(ctx),
  'hero-compact': (ctx) => renderHero({ ...ctx, compact: true }),
  skills: (ctx) => renderSkills({ ...ctx, iconSpecs }),
  'skills-compact': (ctx) => renderSkills({ ...ctx, iconSpecs, compact: true }),
  summary: (ctx) => renderSummary({ ...ctx, streak }),
  'summary-compact': (ctx) => renderSummary({ ...ctx, streak, compact: true }),
  landscape: (ctx) => renderLandscape(ctx),
  'landscape-compact': (ctx) => renderLandscape({ ...ctx, compact: true }),
  // year0 = this year, year1 = last year, … (stable file names, so README never needs a yearly edit)
  ...Object.fromEntries(years.slice(0, config.github.years ?? 3).flatMap((yd, i) => [
    [`landscape-year${i}`, (ctx) => renderLandscape({ ...ctx, data: yd })],
    [`landscape-year${i}-compact`, (ctx) => renderLandscape({ ...ctx, data: yd, compact: true })],
  ])),
  charts: (ctx) => renderCharts(ctx),
  'charts-compact': (ctx) => renderCharts({ ...ctx, compact: true }),
};
const only = process.argv.slice(2);

const outDir = join(root, 'assets/generated');
const tmp = join(root, '.cache/generated-tmp');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
let count = 0;
for (const [name, render] of Object.entries(assets)) {
  if (only.length && !only.includes(name)) continue;
  for (const mode of ['light', 'dark']) {
    for (const animated of name.startsWith('section-') ? [true] : [true, false]) { // dividers never move
      const svg = render({ data, config, labels: config.labels, t: theme[mode], mode, motion: theme.motion, fonts, animated, root });
      const file = `${name}-${mode}${animated ? '' : '-static'}.svg`;
      writeFileSync(join(tmp, file), svg);
      count++;
    }
  }
}
mkdirSync(outDir, { recursive: true });
// full rebuild replaces the folder contents, so renamed/removed assets do not linger
if (!only.length) for (const f of readdirSync(outDir)) if (f.endsWith('.svg')) rmSync(join(outDir, f));
for (const f of readdirSync(tmp)) renameSync(join(tmp, f), join(outDir, f));
rmSync(tmp, { recursive: true, force: true });
if (!only.length) {
  writeFileSync(join(root, 'README.md'), readme(config, iconSpecs));
  writeFileSync(join(root, 'docs/static.md'), staticPage(config));
}
console.log(`built ${count} assets → assets/generated/${only.length ? '' : ' (+ README.md, docs/static.md)'}`);
