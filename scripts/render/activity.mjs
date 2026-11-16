// Activity radar. Same five axes and the same log scale as
// github-profile-3d-contrib (rings 1 / 10 / 100 / 1K / 10K; level = log10(v)+1,
// 0 → 0.8). Kept flat and front-facing for readability; it sits on a thin
// pentagon tile so it belongs to the same desk model.
import { el, n, pts } from '../lib/svg.mjs';
import { textPath } from '../lib/fonts.mjs';
import { CHART_W, CHART_H } from './languages.mjs';

const toLevel = (v) => (v < 1 ? 0.8 : Math.min(Math.log10(v), 5) + 1);
const LEVELS = 5;
const RING_LABELS = ['1', '10', '100', '1K', '10K'];

export function buildActivity({ data, t, mode, fonts, labels, motion, animated, cw = CHART_W, ox = 0, oy = 0 }) {
  // absolute coordinates (no wrapping translate) so the CSS transform-origin is exact
  const tt = data.totals;
  const axes = [
    { name: labels.commit, value: tt.commits },
    { name: labels.issue, value: tt.issues },
    { name: labels.pullreq, value: tt.pullRequests },
    { name: labels.review, value: tt.reviews },
    { name: labels.repo, value: tt.repositories },
  ];
  const title = textPath(fonts.semibold, labels.activityTitle, { x: ox, y: oy + 27, size: 20 });
  const note = textPath(fonts.medium, labels.activityNote, { x: ox, y: oy + 50, size: 13 });

  const cx = ox + cw / 2, cy = oy + 196, R = 80;
  const pos = (level, i) => {
    const a = (i / axes.length) * Math.PI * 2;
    return [cx + R * (level / LEVELS) * Math.sin(a), cy - R * (level / LEVELS) * Math.cos(a)];
  };
  const ring = (lv) => axes.map((_, i) => pos(lv, i));

  // tile (thin pentagon slab)
  const tileOuter = ring(LEVELS * 1.08);
  const tile = el('g', {}, [
    el('polygon', { points: pts(tileOuter.map(([x, y]) => [x, y + 5])), fill: t.plate.right }),
    el('polygon', { points: pts(tileOuter), fill: t.plate.top }),
  ]);
  const grid = el('g', { stroke: t.hairline, 'stroke-width': 1, fill: 'none' }, [
    ...[1, 2, 3, 4, 5].map((lv) => el('polygon', { points: pts(ring(lv)) })),
    ...axes.map((_, i) => el('line', { x1: n(pos(1, i)[0]), y1: n(pos(1, i)[1]), x2: n(pos(LEVELS, i)[0]), y2: n(pos(LEVELS, i)[1]) })),
  ]);
  const ringLabels = RING_LABELS.map((lab, i) => {
    const [x, y] = pos(i + 1, 0);
    const p = textPath(fonts.medium, lab, { x: x - 5, y: y - 2, size: 9.5, anchor: 'end' });
    return el('path', { d: p.d, fill: t.ink3 });
  });

  const shape = axes.map((a, i) => pos(toLevel(a.value), i));
  const poly = el('g', { class: animated ? 'grow' : undefined, style: animated ? `transform-origin:${cx}px ${cy}px` : undefined }, [
    el('polygon', { points: pts(shape), fill: t.accent, 'fill-opacity': t.radarFill, stroke: t.accent, 'stroke-width': 1.75, 'stroke-linejoin': 'round' }),
    shape.map(([x, y]) => el('circle', { cx: x, cy: y, r: 3, fill: t.accent, stroke: mode === 'dark' ? '#0D1117' : '#FFFFFF', 'stroke-width': 1.2 })),
  ]);

  // axis labels: name + value, placed outside the tile
  const lab = axes.map((a, i) => {
    const ang = (i / axes.length) * Math.PI * 2;
    const [x, y] = pos(LEVELS * 1.32, i);
    const sx = Math.sin(ang);
    const anchor = Math.abs(sx) < 0.2 ? 'middle' : sx > 0 ? 'start' : 'end';
    const x2 = anchor === 'start' ? x - 12 : anchor === 'end' ? x + 12 : x;
    const yTop = i === 0 ? y - 10 : y - 4;
    const nm = textPath(fonts.medium, a.name, { x: x2, y: yTop, size: 12.5, anchor });
    const val = textPath(fonts.semibold, a.value.toLocaleString('en-US'), { x: x2, y: yTop + 18, size: 16, anchor });
    return el('g', {}, [el('title', {}, `${a.name}: ${a.value}`), el('path', { d: nm.d, fill: t.ink2 }), el('path', { d: val.d, fill: t.ink })]);
  });

  const style = [
    `.grow{animation:grow 1100ms ${motion.ease} 300ms both}`,
    `@keyframes grow{from{transform:scale(.16);opacity:0}}`,
  ];
  const summary = axes.map((a) => `${a.name} ${a.value}`).join(', ');
  return {
    body: [el('path', { d: title.d, fill: t.ink }), el('path', { d: note.d, fill: t.ink3 }), tile, grid, ringLabels, poly, lab],
    defs: [], css: style, height: CHART_H,
    summary: `${labels.activityTitle}: ${summary}. Stars ${tt.stars}, forks ${tt.forks}`,
  };
}
