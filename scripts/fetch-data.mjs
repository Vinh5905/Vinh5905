#!/usr/bin/env node
// CI data source. Uses the GraphQL client and aggregation of
// yoshi389111/github-profile-3d-contrib (pinned in the workflow, compiled with
// tsc) unchanged, then writes data/github-stats.json.
//
//   node scripts/fetch-data.mjs --lib <path to compiled library src dir>
//   env: GITHUB_TOKEN (required)
//
// Safety: the new file is validated before it replaces the old one. On any error
// the script exits 1 and the previous data (and therefore the previous images)
// stay untouched. If only `fetchedAt` would change, nothing is written.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
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

try {
  const response = await client.fetchData(token, username, config.github.maxRepos ?? 100, null);
  const info = aggregate.aggregateUserInfo(response); // throws on GraphQL errors
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  const data = validate({
    schema: 1,
    source: 'github-graphql',
    sourceNote: 'yoshi389111/github-profile-3d-contrib fetchData + aggregateUserInfo (unmodified).',
    username,
    fetchedAt: new Date().toISOString(),
    calendar: info.contributionCalendar.map((c) => ({ date: iso(c.date), count: c.contributionCount, level: c.contributionLevel })),
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
  });
  if (existsSync(out)) {
    const strip = (d) => JSON.stringify({ ...d, fetchedAt: null });
    if (strip(JSON.parse(readFileSync(out, 'utf8'))) === strip(data)) {
      console.log('data unchanged; keeping existing file');
      process.exit(0);
    }
  }
  writeFileSync(out + '.tmp', JSON.stringify(data, null, 2) + '\n');
  renameSync(out + '.tmp', out);
  console.log(`wrote ${out}: ${data.calendar.length} days, ${data.totals.contributions} contributions`);
} catch (e) {
  console.error('fetch failed; previous data kept:', e?.response?.status ?? '', e?.message ?? e);
  process.exit(1);
}
