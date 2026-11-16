#!/usr/bin/env node
// Preview-only data source: builds data/github-stats.json from PUBLIC GitHub pages
// and the unauthenticated REST/Search API, for local previews when no token is
// available. The scheduled workflow never uses this file: it uses fetch-data.mjs,
// which calls the pinned github-profile-3d-contrib GraphQL client.
//
// Approximations versus the library data (documented in docs/CUSTOMIZE.md):
//   - commit totals and per-language commits come from the commit search index
//     (public repositories, default branches), not contributionsCollection.
//
// Usage: node scripts/fetch-public.mjs <username> [out=data/github-stats.json]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const user = process.argv[2];
const out = process.argv[3] || 'data/github-stats.json';
if (!user) { console.error('usage: fetch-public.mjs <username> [out]'); process.exit(1); }

const UA = { 'User-Agent': 'profile-readme-preview', Accept: 'application/vnd.github+json' };
const get = async (url, asText = false) => {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return asText ? r.text() : r.json();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. contribution calendar (public HTML fragment that GitHub's profile page loads)
const html = await get(`https://github.com/users/${user}/contributions`, true);
const tips = new Map();
for (const m of html.matchAll(/<tool-tip[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) tips.set(m[1], m[2]);
const calendar = [];
for (const m of html.matchAll(/<td\b[^>]*>/g)) {
  const td = m[0];
  const date = /data-date="([\d-]+)"/.exec(td)?.[1];
  const level = /data-level="(\d)"/.exec(td)?.[1];
  const id = /\bid="([^"]+)"/.exec(td)?.[1];
  if (!date || level === undefined) continue;
  const tip = tips.get(id) || '';
  const count = /^No contributions/.test(tip) ? 0 : Number((/^([\d,]+) contribution/.exec(tip) || [, 'NaN'])[1].replace(/,/g, ''));
  if (Number.isNaN(count)) throw new Error(`cannot read count for ${date}: "${tip}"`);
  calendar.push({ date, count, level: Number(level) });
}
calendar.sort((a, b) => a.date.localeCompare(b.date));
if (calendar.length < 300) throw new Error(`calendar too short (${calendar.length})`);
const totalMatch = /([\d,]+)\s+contributions?\s+in the last year/.exec(html);
const totalContrib = totalMatch ? Number(totalMatch[1].replace(/,/g, '')) : calendar.reduce((s, d) => s + d.count, 0);
const from = calendar[0].date;

// 2. owned repositories (stars, forks, repos created in the period, primary languages)
const repos = await get(`https://api.github.com/users/${user}/repos?per_page=100&type=owner`);
const langOf = new Map(repos.map((r) => [r.full_name.toLowerCase(), r.language]));

// 3. counts from the search API (10 requests/minute unauthenticated)
const count = async (q) => (await get(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=1`)).total_count;
const issues = await count(`author:${user} type:issue created:>=${from}`); await sleep(6500);
const prs = await count(`author:${user} type:pr created:>=${from}`); await sleep(6500);
const reviews = await count(`reviewed-by:${user} type:pr -author:${user} created:>=${from}`); await sleep(6500);

// commits by repository (search index; first 1000 results max)
const byRepo = new Map();
let commitTotal = 0;
for (let page = 1; page <= 10; page++) {
  const r = await get(`https://api.github.com/search/commits?q=${encodeURIComponent(`author:${user} author-date:>=${from}`)}&per_page=100&page=${page}`);
  commitTotal = r.total_count;
  for (const it of r.items) {
    const full = it.repository.full_name.toLowerCase();
    byRepo.set(full, (byRepo.get(full) || 0) + 1);
  }
  if (page * 100 >= r.total_count || r.items.length < 100) break;
  await sleep(6500);
}

// GitHub linguist colours for languages we may meet (fallback grey otherwise)
const COLORS = { Python: '#3572A5', HCL: '#844FBA', Java: '#b07219', 'Jupyter Notebook': '#DA5B0B', JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#663399', Shell: '#89e051', Go: '#00ADD8', Dockerfile: '#384d54', Scala: '#c22d40', SQL: '#e38c00' };
const langs = new Map();
for (const [full, n] of byRepo) {
  let lang = langOf.get(full);
  if (lang === undefined) {
    try { lang = (await get(`https://api.github.com/repos/${full}`)).language; } catch { lang = null; }
  }
  if (!lang) continue; // the library also skips repositories without a primary language
  const cur = langs.get(lang) || { language: lang, color: COLORS[lang] || '#8b949e', contributions: 0 };
  cur.contributions += n;
  langs.set(lang, cur);
}

const data = {
  schema: 1,
  source: 'public-preview',
  sourceNote: 'Public contributions page + unauthenticated REST/Search API (preview approximation). Replaced by the GraphQL data of github-profile-3d-contrib on the next workflow run.',
  username: user,
  fetchedAt: new Date().toISOString(),
  calendar,
  languages: [...langs.values()].sort((a, b) => b.contributions - a.contributions),
  totals: {
    contributions: totalContrib,
    commits: commitTotal,
    issues,
    pullRequests: prs,
    reviews,
    repositories: repos.filter((r) => !r.fork && r.created_at.slice(0, 10) >= from).length,
    stars: repos.reduce((s, r) => s + r.stargazers_count, 0),
    forks: repos.reduce((s, r) => s + r.forks_count, 0),
  },
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
console.log(`wrote ${out}: ${calendar.length} days, ${totalContrib} contributions, ${commitTotal} commits, ${langs.size} languages`);
