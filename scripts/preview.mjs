#!/usr/bin/env node
// Renders README.md into .cache/preview/index.html inside a GitHub-like profile
// README frame (github-markdown-css, light/dark by prefers-color-scheme), so the
// real <picture> sources, relative paths and widths can be checked locally.
// This approximates GitHub; it is not GitHub's own renderer.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { marked } from 'marked';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const css = readFileSync(require.resolve('github-markdown-css/github-markdown.css'), 'utf8');
const body = marked.parse(readFileSync(join(root, 'README.md'), 'utf8')).replaceAll('./assets/', '../../assets/').replaceAll('./docs/', '../../docs/');
const out = join(root, '.cache/preview');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.html'), `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Profile README preview</title>
<style>${css}
html,body{margin:0}
body{background:#fff}
@media (prefers-color-scheme: dark){body{background:#0d1117}}
.layout{max-width:1280px;margin:0 auto;padding:24px 32px;display:flex;gap:24px;box-sizing:border-box}
.side{width:296px;flex:none}
.avatar{width:296px;height:296px;border-radius:50%;background:#d0d7de}
@media (prefers-color-scheme: dark){.avatar{background:#30363d}}
.main{flex:1;min-width:0}
.box{border:1px solid #d0d7de;border-radius:6px;padding:24px}
@media (prefers-color-scheme: dark){.box{border-color:#30363d}}
.crumb{font:12px ui-monospace,monospace;color:#59636e;margin-bottom:16px}
@media (max-width: 767px){.layout{display:block;padding:16px}.side{display:none}.box{padding:16px}}
@media (max-width: 1011px) and (min-width: 768px){.side,.avatar{width:256px;height:auto}.avatar{height:256px}}
</style></head><body><div class="layout"><div class="side"><div class="avatar"></div></div>
<div class="main"><div class="box"><div class="crumb">Vinh5905 / README.md</div><article class="markdown-body" style="background:transparent">${body}</article></div></div></div></body></html>`);
console.log('preview → .cache/preview/index.html');
