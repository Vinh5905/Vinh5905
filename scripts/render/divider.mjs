// Section title: centred label between two short hairlines that fade outward.
// Extra space above separates it from the previous section.
import { el, n, doc } from '../lib/svg.mjs';
import { textPath } from '../lib/fonts.mjs';
import { FULL_W } from '../lib/layout.mjs';

export const DIVIDER_COMPACT_W = 360;

export function renderDivider({ label, t, fonts, mode, compact = false }) {
  const W = compact ? DIVIDER_COMPACT_W : FULL_W;
  const size = compact ? 20 : 23;
  const H = compact ? 84 : 104;
  const base = compact ? 56 : 70;           // baseline: more air above than below
  const lineLen = compact ? 52 : 96, gap = compact ? 14 : 20;
  const txt = textPath(fonts.semibold, label, { x: W / 2, y: base, size, anchor: 'middle' });
  const cy = base - size * 0.36;
  const x0 = txt.x0 - gap, x1 = txt.x0 + txt.width + gap;
  const grad = (id, from, to) => el('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: n(from), y1: 0, x2: n(to), y2: 0 }, [
    el('stop', { offset: 0, 'stop-color': t.accent, 'stop-opacity': mode === 'dark' ? 0.7 : 0.75 }),
    el('stop', { offset: 1, 'stop-color': t.accent, 'stop-opacity': 0 }),
  ]);
  return doc({
    width: W, height: H,
    title: label, desc: `Section: ${label}`,
    defs: [grad('fadeL', x0, x0 - lineLen), grad('fadeR', x1, x1 + lineLen)],
    body: [
      el('line', { x1: n(x0 - lineLen), y1: n(cy), x2: n(x0), y2: n(cy), stroke: 'url(#fadeL)', 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
      el('path', { d: txt.d, fill: t.ink }),
      el('line', { x1: n(x1), y1: n(cy), x2: n(x1 + lineLen), y2: n(cy), stroke: 'url(#fadeR)', 'stroke-width': 1.5, 'stroke-linecap': 'round' }),
    ],
  });
}
