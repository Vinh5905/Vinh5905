// Technology shelf: brand logos standing on small iso pedestals that share the
// landscape's projection, light direction and materials. Logos only — the
// names live in the alt text / <title>, not as visible labels.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { el, n, pathOf, doc } from '../lib/svg.mjs';
import { TAN, diamond } from '../lib/iso.mjs';
import { textPath } from '../lib/fonts.mjs';
import { loadIcon, placeIcon } from '../lib/icons.mjs';
import { css } from '../lib/motion.mjs';

import { HALF_W as STACK_W } from '../lib/layout.mjs';
const SLOT = 94, A = 31, PH = 14, LOGO = 48;
const B = A * TAN;

export function renderStack({ group, groupIndex, t, mode, fonts, motion, animated, root, iconSpecs }) {
  const metrics = JSON.parse(readFileSync(join(root, 'assets/icons/metrics.json'), 'utf8'));
  const title = textPath(fonts.semibold, group.title, { x: 0, y: 27, size: 20 });
  const maxRow = Math.max(...group.rows.map((r) => r.length));
  const rowPitch = 110, cy0 = 122;
  const rowsTotal = 3; // both shelves share a height so they sit side by side
  const H = cy0 + (rowsTotal - 1) * rowPitch + B + PH + 18;

  const items = [];
  let i = 0;
  group.rows.forEach((row, r) => {
    const offset = ((maxRow - row.length) * SLOT) / 2;
    row.forEach((id, c) => items.push({ id, r, c, cx: offset + SLOT / 2 + c * SLOT, cy: cy0 + r * rowPitch, i: i++ }));
  });

  const shadowLen = t.shadow.length;
  const bodies = items.map(({ id, cx, cy, c, r, i }) => {
    const spec = iconSpecs[id];
    if (!spec) throw new Error(`icon "${id}" is not defined in config/icons.json`);
    const icon = loadIcon(root, id, spec, { colorMap: mode === 'dark' ? spec.dark || {} : {}, prefix: `${group.id}-${id}` });
    const placed = placeIcon(icon, metrics[id], { cx, cy: cy - PH - 30, box: LOGO, area: 0.58 });

    const f = diamond(cx, cy, A, B);
    const k = (PH / B) * shadowLen * 1.6;
    const v = [k * A, k * B];
    const mv = ([x, y]) => [x + v[0], y + v[1]];
    const ground = el('path', { d: pathOf([f.L, f.T, mv(f.T), mv(f.R), mv(f.B), f.B]), fill: t.shadow.color, opacity: t.shadow.opacity * 0.9 });
    // pedestal faces come from tokens (not derived) so each theme is tuned by hand
    const top = { T: [f.T[0], f.T[1] - PH], R: [f.R[0], f.R[1] - PH], B: [f.B[0], f.B[1] - PH], L: [f.L[0], f.L[1] - PH] };
    const faces = el('g', {}, [
      el('path', { d: pathOf([f.L, f.B, top.B, top.L]), fill: t.pedestal.left }),
      el('path', { d: pathOf([f.B, f.R, top.R, top.B]), fill: t.pedestal.right }),
      el('path', { d: pathOf([top.T, top.R, top.B, top.L]), fill: t.pedestal.top }),
      el('path', { d: pathOf([top.L, top.B, top.R], false), stroke: t.pedestal.rim, 'stroke-width': 1, 'stroke-opacity': mode === 'dark' ? 0.9 : 1, 'stroke-linejoin': 'round' }),
      t.pedestal.glowOpacity
        ? el('path', { d: pathOf([top.L, top.T, top.R], false), stroke: t.pedestal.glow, 'stroke-width': 0.9, 'stroke-opacity': t.pedestal.glowOpacity, 'stroke-linejoin': 'round' })
        : null,
    ]);
    const contact = el('ellipse', { cx, cy: cy - PH, rx: 14, ry: 14 * TAN * 0.6, fill: t.shadow.color, opacity: t.pedestal.contact, class: animated ? 'bobs' : undefined,
      style: animated ? `animation-delay:${1400 + c * 600 + groupIndex * 300}ms` : undefined });
    const logo = el('g', { class: animated ? 'bob' : undefined, style: animated ? `animation-delay:${1400 + c * 600 + groupIndex * 300}ms` : undefined }, [
      el('title', {}, spec.label), placed.markup,
    ]);
    return el('g', { class: animated ? 'pop' : undefined, style: animated ? `animation-delay:${groupIndex * 240 + i * motion.iconStaggerMs}ms` : undefined },
      [ground, faces, contact, logo]);
  });

  const style = css(animated, [
    `.pop{animation:pop 640ms ${motion.ease} both}`,
    `@keyframes pop{from{opacity:0;transform:translateY(10px)}}`,
    `.bob{animation:bob ${motion.bobPeriodS}s ease-in-out infinite both}`,
    `@keyframes bob{50%{transform:translateY(-${motion.bobPx}px)}}`,
    `.bobs{transform-box:fill-box;transform-origin:center;animation:bobs ${motion.bobPeriodS}s ease-in-out infinite both}`,
    `@keyframes bobs{50%{transform:scale(.82)}}`,
  ]);
  const names = items.map((it) => iconSpecs[it.id].label).join(', ');
  return doc({
    width: STACK_W, height: Math.ceil(H),
    title: `${group.title}: ${names}`,
    desc: `Logos of ${names} on small pedestals.`,
    css: style,
    body: [el('path', { d: title.d, fill: t.ink }), bodies],
  });
}
