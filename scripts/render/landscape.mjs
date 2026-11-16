// 3D contribution landscape. Geometry and bar heights follow
// github-profile-3d-contrib (30° iso, height = log10(count/20 + 1) * 144 + 3 at a
// 20px cell); colours, lighting, shadows, base plate and motion are ours.
import { el, n, pathOf, doc } from '../lib/svg.mjs';
import { TAN, diamond, prism } from '../lib/iso.mjs';
import { shade } from '../lib/color.mjs';
import { textPath } from '../lib/fonts.mjs';
import { css } from '../lib/motion.mjs';
import { STAR, FORK, icon16 } from '../lib/octicons.mjs';

import { FULL_W, COMPACT_W } from '../lib/layout.mjs';
const toDay = (iso) => Math.floor(Date.parse(iso + 'T00:00:00Z') / 86400000);
const fmt = (v) => v.toLocaleString('en-US');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = { 1: 'Mon', 3: 'Wed', 5: 'Fri' };

export function renderLandscape({ data, t, fonts, labels, motion, animated, compact = false }) {
  const isYear = data.kind === 'year';
  const W = compact ? COMPACT_W : FULL_W;
  const headerH = compact ? 100 : 0; // compact: text sits above the strip, larger
  const cal = data.calendar;
  const first = new Date(cal[0].date + 'T00:00:00Z');
  const sunday0 = toDay(cal[0].date) - first.getUTCDay();
  const cells = cal.map((c) => {
    const day = new Date(c.date + 'T00:00:00Z').getUTCDay();
    return { ...c, week: Math.floor((toDay(c.date) - sunday0) / 7), day };
  });
  const weeks = Math.max(...cells.map((c) => c.week)) + 1;

  // cell size: the strip spans (weeks - 1 + 6) cells + margins horizontally
  const m = 0.75; // plate margin in cells
  // board margins in cells: back end carries Mon/Wed/Fri, front edge carries months
  const wb = 3.1, wf = m, db = m, df = 2.5;
  const dx = (W - 4) / (weeks + wf + db + wb + df + 7);
  const dy = dx * TAN;
  const a = dx * 0.9, b = dy * 0.9;
  const unit = dx / 20; // library cell = 20px
  const barH = (count) => (Math.log10(count / 20 + 1) * 144 + 3) * unit;

  const ox = (wb + df + 7) * dx + 2; // x of the (week 0, Sunday) cell centre
  const center = (w, d, oy) => [ox + (w - d) * dx, oy + (w + d) * dy];

  // vertical origin: leave room for the tallest bar at the back
  const maxRise = Math.max(...cells.map((c) => barH(c.count) - (c.week + c.day) * dy));
  const oy = compact ? headerH + Math.max((wb + db + 1) * dy + 8, maxRise + 12) : Math.max((wb + db + 1) * dy + 24, maxRise + 26, 70);
  const plateT = 9 * unit * 1.6; // base board thickness
  const corner = (w, d) => center(w, d, oy);
  const pt = (w, d) => center(w, d, oy); // fractional cell → screen
  const pc = { T: pt(-wb - 0.5, -db - 0.5), R: pt(weeks - 1 + wf + 0.5, -db - 0.5), B: pt(weeks - 1 + wf + 0.5, 6 + df + 0.5), L: pt(-wb - 0.5, 6 + df + 0.5) };
  const H = Math.ceil(pc.B[1] + plateT + 28);

  // ---- base plate (desk model board)
  const down = ([x, y]) => [x, y + plateT];
  const plate = el('g', {}, [
    el('path', { d: pathOf([pc.L, pc.B, down(pc.B), down(pc.L)]), fill: t.plate.left }),
    el('path', { d: pathOf([pc.B, pc.R, down(pc.R), down(pc.B)]), fill: t.plate.right }),
    el('path', { d: pathOf([pc.T, pc.R, pc.B, pc.L]), fill: t.plate.top }),
    el('path', { d: pathOf([pc.L, pc.B, pc.R], false), stroke: t.plate.edge, 'stroke-width': 1, 'stroke-opacity': 0.9 }),
  ]);

  // ---- cells
  const flat = [], bars = [], shadows = [], clips = [];
  const sorted = [...cells].sort((p, q) => p.week + p.day - (q.week + q.day) || p.week - q.week);
  let barIndex = 0;
  for (const c of sorted) {
    const [cx, cy] = center(c.week, c.day, oy);
    const f = diamond(cx, cy, a, b);
    const h = barH(c.count);
    const top = t.levels[c.level];
    if (c.level === 0) {
      flat.push(prism(f, h, top, t.shade));
      continue;
    }
    // contact shadow, cast down-right (light from the upper left) along +week
    const k = Math.min(1.5, (h / dy) * t.shadow.length);
    const v = [k * dx, k * dy];
    const mv = ([x, y]) => [x + v[0], y + v[1]];
    const delay = Math.round(c.week * motion.weekStaggerMs);
    shadows.push(el('path', {
      d: pathOf([f.L, f.T, mv(f.T), mv(f.R), mv(f.B), f.B]),
      class: animated ? 'fade' : undefined,
      style: animated ? `animation-delay:${delay + motion.entranceMs * 0.55}ms` : undefined,
    }));
    const body = prism(f, h, top, t.shade, { rim: shade(top, t.shade.rim), rimOpacity: t.shade.rimOpacity });
    const title = el('title', {}, `${c.date}: ${c.count}`);
    if (animated) {
      const id = `c${barIndex++}`;
      clips.push(el('clipPath', { id }, el('path', { d: pathOf([f.L, f.B, f.R, [f.R[0], -2000], [f.L[0], -2000]]) })));
      bars.push(el('g', { 'clip-path': `url(#${id})` },
        el('g', { class: 'rise', style: `--h:${n(h + 1)}px;animation-delay:${delay}ms` }, [title, body])));
    } else {
      bars.push(el('g', {}, [title, body]));
    }
  }

  // ---- headline block: top-right triangle (full) or a header row (compact)
  const period = isYear ? `${data.year}${labels.yearSuffix}` : `${cal[0].date} 〜 ${cal[cal.length - 1].date}`;
  const S = compact ? { big: 46, lab: 20, per: 16, num: 19 } : { big: 52, lab: 19, per: 15, num: 17 };
  let head;
  {
    const right = compact ? W : W;
    const big = compact
      ? textPath(fonts.bold, fmt(data.totals.contributions), { x: 0, y: 50, size: S.big })
      : textPath(fonts.bold, fmt(data.totals.contributions), { x: right, y: 62, size: S.big, anchor: 'end' });
    const lab = compact
      ? textPath(fonts.medium, labels.contributions, { x: big.width + 12, y: 50, size: S.lab })
      : textPath(fonts.medium, labels.contributions, { x: right, y: 94, size: S.lab, anchor: 'end' });
    const per = compact
      ? textPath(fonts.medium, period, { x: 0, y: 82, size: S.per })
      : textPath(fonts.medium, period, { x: right, y: 120, size: S.per, anchor: 'end' });
    const sy = compact ? 82 : 154;
    const iconS = S.num / 16;
    const forkTxt = textPath(fonts.semibold, fmt(data.totals.forks ?? 0), { x: right, y: sy, size: S.num, anchor: 'end' });
    const forkIcon = icon16(FORK, forkTxt.x0 - 22 * iconS, sy - 13.5 * iconS, iconS, t.ink3);
    const starTxt = textPath(fonts.semibold, fmt(data.totals.stars ?? 0), { x: forkTxt.x0 - 36 * iconS, y: sy, size: S.num, anchor: 'end' });
    const starIcon = icon16(STAR, starTxt.x0 - 22 * iconS, sy - 13.5 * iconS, iconS, t.ink3);
    head = el('g', {}, [
      el('path', { d: big.d, fill: t.ink }),
      el('path', { d: lab.d, fill: t.ink2 }),
      el('path', { d: per.d, fill: t.ink3 }),
      // stars/forks are all-time totals, so they only appear on the rolling view
      isYear ? null : [
        el('title', {}, `stars ${data.totals.stars}, forks ${data.totals.forks}`),
        starIcon, el('path', { d: starTxt.d, fill: t.ink2 }),
        forkIcon, el('path', { d: forkTxt.d, fill: t.ink2 }),
      ],
    ]);
  }

  // ---- axis labels printed flat on the board (same plane as the blocks):
  // text runs along the week axis, glyph "up" points back toward the grid.
  const K = 10; // local text px per cell
  const onBoard = (d, w0, wd) => {
    const [ex, ey] = pt(w0, wd);
    // x' = a·x + c·y + e, y' = b·x + d·y + f   (x → +week, y(down) → +day)
    return `matrix(${n(dx / K)} ${n(dy / K)} ${n(-dx / K)} ${n(dy / K)} ${n(ex)} ${n(ey)})`;
  };
  const monthAt = [];
  for (const c of cells) {
    const mo = Number(c.date.slice(5, 7)) - 1;
    if (!monthAt.length || monthAt[monthAt.length - 1].mo !== mo) monthAt.push({ mo, week: c.week });
  }
  const shown = monthAt.filter((mk, i) => {
    const next = monthAt[i + 1];
    return !(next && next.week - mk.week < 3); // drop a partial first month crowding the next label
  });
  const axis = el('g', { fill: t.ink3 }, [
    ...shown.map(({ mo, week }) => el('path', {
      d: textPath(fonts.semibold, MONTHS[mo], { x: 0, y: 0, size: 13 }).d,
      transform: onBoard(null, week - 0.45, 6 + 1.95),
    })),
    ...Object.entries(DAYS).map(([d, name]) => el('path', {
      d: textPath(fonts.semibold, name, { x: 0, y: 0, size: 11.5, anchor: 'end' }).d,
      transform: onBoard(null, -0.8, Number(d) + 0.42),
    })),
  ]);

  // ---- legend (bottom left): 少 ▪▪▪▪▪ 多 as tiny blocks
  const ly = H - 34;
  const LS = compact ? 18 : 15;
  const less = textPath(fonts.medium, labels.less, { x: 0, y: ly + 6, size: LS });
  const legendBlocks = t.levels.map((col, i) => {
    const lx = less.width + 22 + i * 21;
    const f = diamond(lx, ly + 4, 8, 8 * TAN);
    return prism(f, 2 + i * 3.2, col, t.shade, { rim: shade(col, t.shade.rim), rimOpacity: i ? t.shade.rimOpacity : 0 });
  });
  const more = textPath(fonts.medium, labels.more, { x: less.width + 22 + 4 * 21 + 16, y: ly + 6, size: LS });
  const legend = el('g', {}, [el('path', { d: less.d, fill: t.ink3 }), legendBlocks, el('path', { d: more.d, fill: t.ink3 })]);

  const style = css(animated, [
    `.rise{animation:rise ${motion.entranceMs}ms ${motion.ease} both}`,
    `@keyframes rise{from{transform:translateY(var(--h))}}`,
    `.fade{animation:fade 700ms ease-out both}`,
    `@keyframes fade{from{opacity:0}}`,
  ]);

  return doc({
    width: W, height: H,
    title: `${data.username}: ${fmt(data.totals.contributions)} contributions (${period})`,
    desc: `3D contribution calendar, one block per day, height by contribution count.${isYear ? '' : ` Stars ${data.totals.stars}, forks ${data.totals.forks}.`}`,
    css: style,
    defs: clips,
    body: [
      plate,
      el('g', {}, flat),
      el('g', { fill: t.shadow.color, opacity: t.shadow.opacity }, shadows),
      el('g', {}, bars),
      axis,
      head,
      legend,
    ],
  });
}
