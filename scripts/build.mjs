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
import { renderStack } from './render/stack.mjs';
import { renderHero } from './render/hero.mjs';
import { renderLanguages } from './render/languages.mjs';
import { renderActivity } from './render/activity.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const config = readJson('profile.config.json');
const theme = readJson('config/theme.json');
const iconSpecs = readJson('config/icons.json');
const data = loadData(join(root, 'data/github-stats.json'));
if (data.username.toLowerCase() !== config.github.username.toLowerCase())
  throw new Error(`data is for "${data.username}" but config.github.username is "${config.github.username}"`);
const fonts = await loadFonts(root);

const assets = {
  hero: (ctx) => renderHero(ctx),
  ...Object.fromEntries(config.stack.map((group, groupIndex) => [`stack-${group.id}`, (ctx) => renderStack({ ...ctx, group, groupIndex, iconSpecs })])),
  landscape: (ctx) => renderLandscape(ctx),
  'landscape-compact': (ctx) => renderLandscape({ ...ctx, compact: true }),
  languages: (ctx) => renderLanguages(ctx),
  activity: (ctx) => renderActivity(ctx),
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
    for (const animated of [true, false]) {
      const svg = render({ data, config, labels: config.labels, t: theme[mode], mode, motion: theme.motion, fonts, animated, root });
      const file = `${name}-${mode}${animated ? '' : '-static'}.svg`;
      writeFileSync(join(tmp, file), svg);
      count++;
    }
  }
}
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(tmp)) renameSync(join(tmp, f), join(outDir, f));
rmSync(tmp, { recursive: true, force: true });
console.log(`built ${count} assets → assets/generated/`);
