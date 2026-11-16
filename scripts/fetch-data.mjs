#!/usr/bin/env node
// CI data source. Uses the GraphQL client and aggregation of
// yoshi389111/github-profile-3d-contrib (pinned in the workflow, compiled with
// tsc) unchanged, then writes data/github-stats.json.
//
//   node scripts/fetch-data.mjs --lib <path to compiled library src dir>
//   env: GITHUB_TOKEN (required)
//
// Writes data/github-stats.json (rolling 12 months) and data/years/<year>.json
// for every calendar year since the account was created.
// Safety: all requests run and validate first; on any error the script exits 1
// and every previous data file (and therefore every image) stays untouched.
// Files whose content only differs in `fetchedAt` are not rewritten.
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { validate } from './lib/data.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const libDir = resolve(arg('--lib', '.cache/3d-contrib/dist0/src'));
const out = resolve(root, arg('--out', 'data/github-stats.json'));
const config = JSON.parse(readFileSync(join(root, 'profile.config.json'), 'utf8'));
const username = config.github.username;
const token = process.env.GITHUB_TOKEN;
if (!token) { console.error('GITHUB_TOKEN is empty'); process.exit(1); }

const require = createRequire(import.meta.url);
const client = require(join(libDir, 'github-graphql.js'));
const aggregate = require(join(libDir, 'aggregate-user-info.js'));

const iso = (d) => new Date(d).toISOString().slice(0, 10);
const calendarOf = (info) => info.contributionCalendar.map((c) => ({ date: iso(c.date), count: c.contributionCount, level: c.contributionLevel }));
const same = (file, data) => existsSync(file) && JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), fetchedAt: null }) === JSON.stringify({ ...data, fetchedAt: null });

try {
  // 1. everything first, in memory; nothing is written unless all requests succeed
  const fetched = new Date().toISOString();
  const response = await client.fetchData(token, username, config.github.maxRepos ?? 100, null);
  const info = aggregate.aggregateUserInfo(response); // throws on GraphQL errors
  const files = [];
  files.push([out, validate({
    schema: 1,
    source: 'github-graphql',
    sourceNote: 'yoshi389111/github-profile-3d-contrib fetchData + aggregateUserInfo (unmodified).',
    username,
    fetchedAt: fetched,
    calendar: calendarOf(info),
    languages: info.contributesLanguage.map((l) => ({ language: l.language, color: l.color, contributions: l.contributions })),
    totals: {
      contributions: info.totalContributions,
      commits: info.totalCommitContributions,
      issues: info.totalIssueContributions,
      pullRequests: info.totalPullRequestContributions,
      reviews: info.totalPullRequestReviewContributions,
      repositories: info.totalRepositoryContributions,
      stars: info.totalStargazerCount,
      forks: info.totalForkCount,
    },
  })]);

  // per-year calendars for every year since the account was created (library's
  // YEAR option). All of them feed the all-time total and the streaks; the
  // README's year toggles show the newest `github.years`.
  const created = await fetch(client.URL, {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'query($login:String!){user(login:$login){createdAt}}', variables: { login: username } }),
  }).then(async (r) => { if (!r.ok) throw new Error(`createdAt query: HTTP ${r.status}`); return r.json(); });
  const createdAt = created?.data?.user?.createdAt;
  if (!createdAt) throw new Error('createdAt query returned no data');
  files[0][1].createdAt = createdAt.slice(0, 10);
  const thisYear = new Date().getUTCFullYear();
  const yearsDir = join(root, 'data/years');
  const wanted = [];
  for (let y = thisYear; y >= Number(createdAt.slice(0, 4)); y--) wanted.push(y);
  for (const y of wanted) {
    const yi = aggregate.aggregateUserInfo(await client.fetchData(token, username, 1, y));
    files.push([join(yearsDir, `${y}.json`), validate({
      schema: 1, kind: 'year', year: y,
      source: 'github-graphql',
      sourceNote: 'yoshi389111/github-profile-3d-contrib fetchData(year) + aggregateUserInfo (unmodified).',
      username, fetchedAt: fetched,
      calendar: calendarOf(yi),
      totals: { contributions: yi.totalContributions },
    })]);
  }

  // 2. write only what changed (atomic per file), drop years that left the window
  mkdirSync(yearsDir, { recursive: true });
  let changed = 0;
  for (const [file, data] of files) {
    if (same(file, data)) continue;
    writeFileSync(file + '.tmp', JSON.stringify(data, null, 2) + '\n');
    renameSync(file + '.tmp', file);
    changed++;
  }
  for (const f of readdirSync(yearsDir)) {
    if (/^\d{4}\.json$/.test(f) && !wanted.includes(Number(f.slice(0, 4)))) { rmSync(join(yearsDir, f)); changed++; }
  }
  console.log(changed ? `updated ${changed} data file(s)` : 'data unchanged; keeping existing files');
} catch (e) {
  console.error('fetch failed; previous data kept:', e?.response?.status ?? '', e?.message ?? e);
  process.exit(1);
}
