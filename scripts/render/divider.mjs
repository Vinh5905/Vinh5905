// Section divider: a small emerald block, a short label and a hairline that runs
// to the right edge. Full (760) and compact (360) share the same proportions.
import { el, n, doc } from '../lib/svg.mjs';
import { TAN, diamond, prism } from '../lib/iso.mjs';
import { shade } from '../lib/color.mjs';
import { textPath } from '../lib/fonts.mjs';
import { FULL_W } from '../lib/layout.mjs';

export const DIVIDER_COMPACT_W = 360;

export function renderDivider({ label, t, fonts, compact = false }) {
  const W = compact ? DIVIDER_COMPACT_W : FULL_W;
  const H = 40, cy = 22, size = 16;
  const cube = prism(diamond(7, cy + 3, 6.5, 6.5 * TAN), 7, t.levels[3], t.shade, { rim: shade(t.levels[3], t.shade.rim), rimOpacity: t.shade.rimOpacity });
  const txt = textPath(fonts.semibold, label, { x: 22, y: cy + size * 0.36, size });
  const x1 = 22 + txt.width + 14;
  return doc({
    width: W, height: H,
    title: label, desc: `Section: ${label}`,
    body: [cube, el('path', { d: txt.d, fill: t.ink2 }), el('line', { x1: n(x1), y1: cy, x2: W, y2: cy, stroke: t.hairline, 'stroke-width': 1 })],
  });
}
