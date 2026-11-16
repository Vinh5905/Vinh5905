// Streak statistics, ported from DenverCoder1/github-readme-streak-stats
// (src/stats.php: getContributionDates + getContributionStats, MIT licence):
//   - days are counted up to "today" (the last day GitHub returned), plus
//     tomorrow only if it already has contributions (timezone overlap)
//   - a day with zero contributions ends the current streak, except today,
//     which may still be empty without breaking it
//   - total = sum of all daily counts since the account was created

/** Merge year calendars + the rolling calendar into one sorted date → count map. */
export function contributionDays(calendars, today) {
  const map = new Map();
  for (const cal of calendars) for (const d of cal) map.set(d.date, d.count);
  const next = new Date(Date.parse(today + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
  return [...map.entries()]
    .filter(([date, count]) => date <= today || (date === next && count > 0))
    .sort(([a], [b]) => (a < b ? -1 : 1));
}

export function streakStats(days) {
  if (!days.length) throw new Error('no contribution days');
  const today = days[days.length - 1][0];
  const first = days[0][0];
  const s = {
    total: 0,
    firstContribution: '',
    longest: { start: first, end: first, length: 0 },
    current: { start: first, end: first, length: 0 },
    today,
  };
  for (const [date, count] of days) {
    s.total += count;
    if (count > 0) {
      s.current.length++;
      s.current.end = date;
      if (s.current.length === 1) s.current.start = date;
      if (!s.firstContribution) s.firstContribution = date;
      if (s.current.length > s.longest.length) s.longest = { ...s.current };
    } else if (date !== today) {
      s.current = { start: today, end: today, length: 0 };
    }
  }
  return s;
}
