// Loads and validates data/github-stats.json. Rendering refuses bad data instead
// of drawing a plausible-looking but wrong picture.
import { readFileSync } from 'node:fs';

export function validate(d) {
  const errs = [];
  if (!d || d.schema !== 1) errs.push('schema must be 1');
  if (!Array.isArray(d?.calendar) || d.calendar.length < 300) errs.push('calendar must have ≥ 300 days');
  if (d?.calendar?.length && d.calendar.some((c, i) => i && c.date <= d.calendar[i - 1].date)) errs.push('calendar dates must be strictly increasing');
  for (const c of d?.calendar || []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date) || !Number.isInteger(c.count) || c.count < 0 || !(c.level >= 0 && c.level <= 4)) {
      errs.push(`bad calendar day ${JSON.stringify(c)}`);
      break;
    }
  }
  const isYear = d?.kind === 'year';
  if (isYear && !Number.isInteger(d.year)) errs.push('year files need an integer `year`');
  const keys = isYear ? ['contributions'] : ['contributions', 'commits', 'issues', 'pullRequests', 'reviews', 'repositories', 'stars', 'forks'];
  for (const k of keys)
    if (!Number.isInteger(d?.totals?.[k]) || d.totals[k] < 0) errs.push(`totals.${k} must be a non-negative integer`);
  if (!isYear && !Array.isArray(d?.languages)) errs.push('languages must be an array');
  if (errs.length) throw new Error('invalid stats data:\n  - ' + errs.join('\n  - '));
  return d;
}

export const loadData = (file) => validate(JSON.parse(readFileSync(file, 'utf8')));
