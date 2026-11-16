// Isometric helpers shared by the landscape, pedestals and the hero detail.
// Same projection as github-profile-3d-contrib: 30° iso angle.
import { el, pathOf } from './svg.mjs';
import { shade } from './color.mjs';

export const ANGLE = 30;
export const TAN = Math.tan((ANGLE * Math.PI) / 180);

/** Diamond footprint centred at (cx, cy) with half-width a. */
export const diamond = (cx, cy, a, b = a * TAN) => ({
  T: [cx, cy - b], R: [cx + a, cy], B: [cx, cy + b], L: [cx - a, cy],
});
const up = ([x, y], h) => [x, y - h];

/**
 * Prism faces for a block standing on footprint `f` with height `h`.
 * Lighting comes from the upper left: top brightest, left face middle,
 * right face darkest. `shadeCfg` = { left, right } lightness deltas.
 */
export function prism(f, h, top, shadeCfg, { rim, rimOpacity = 0, cls } = {}) {
  const t = { T: up(f.T, h), R: up(f.R, h), B: up(f.B, h), L: up(f.L, h) };
  const left = shade(top, shadeCfg.left);
  const right = shade(top, shadeCfg.right);
  return el('g', { class: cls }, [
    h > 0.01 ? el('path', { d: pathOf([f.L, f.B, t.B, t.L]), fill: left }) : null,
    h > 0.01 ? el('path', { d: pathOf([f.B, f.R, t.R, t.B]), fill: right }) : null,
    el('path', { d: pathOf([t.T, t.R, t.B, t.L]), fill: top }),
    rim && rimOpacity > 0
      ? el('path', { d: pathOf([t.L, t.B, t.R], false), stroke: rim, 'stroke-width': 0.8, 'stroke-opacity': rimOpacity, 'stroke-linejoin': 'round' })
      : null,
  ]);
}
