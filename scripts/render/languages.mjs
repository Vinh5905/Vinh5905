// Language donut with real thickness. Data and grouping follow
// github-profile-3d-contrib exactly: commit contributions of the past year,
// grouped by each repository's primary language, top 5 + "other"
// (= total commit contributions − top 5). The projection is an affine squash
// of a flat ring, so every slice keeps its true share of the top surface.
import { el, n, doc } from '../lib/svg.mjs';
import { TAN, diamond, prism } from '../lib/iso.mjs';
import { shade, harmonize, hexToRgb, rgbToHsl, hslToRgb, rgbToHex } from '../lib/color.mjs';
import { textPath } from '../lib/fonts.mjs';
import { css } from '../lib/motion.mjs';

import { HALF_W as CHART_W } from '../lib/layout.mjs';
export { CHART_W };
export const CHART_H = 330;

/**
 * GitHub's language colours can sit a few degrees apart (Java #b07219 vs
 * Jupyter #DA5B0B). Nudge hues apart until neighbours differ by ≥ 24° while
 * staying as close as possible to the original colour.
 */
export function separateHues(colors, minGap = 24) {
  const hsl = colors.map((c) => (c ? rgbToHsl(hexToRgb(c)) : null));
  for (let pass = 0; pass < 20; pass++) {
    let moved = false;
    for (let i = 0; i < hsl.length; i++) for (let j = i + 1; j < hsl.length; j++) {
      if (!hsl[i] || !hsl[j]) continue;
      let d = (hsl[j][0] - hsl[i][0]) * 360;
      d = ((d + 540) % 360) - 180;
      if (Math.abs(d) < minGap && hsl[i][1] > 0.25 && hsl[j][1] > 0.25) {
        const push = ((minGap - Math.abs(d)) / 2 / 360) * (d >= 0 ? 1 : -1);
        hsl[i][0] = (hsl[i][0] - push + 1) % 1;
        hsl[j][0] = (hsl[j][0] + push + 1) % 1;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return hsl.map((h) => (h ? rgbToHex(hslToRgb(h)) : null));
}

export function langSlices(data) {
  const top = data.languages.slice(0, 5).map((l) => ({ ...l }));
  const sum = top.reduce((s, l) => s + l.contributions, 0);
  const other = data.totals.commits - sum;
  if (other > 0) top.push({ language: null, color: null, contributions: other });
  const total = top.reduce((s, l) => s + l.contributions, 0);
  return { slices: top, total };
}

export function renderLanguages({ data, t, mode, fonts, labels, motion, animated }) {
  const { slices, total } = langSlices(data);
  const title = textPath(fonts.semibold, labels.languagesTitle, { x: 0, y: 27, size: 20 });
  const note = textPath(fonts.medium, labels.languagesNote, { x: 0, y: 50, size: 13 });

  const cx = 86, cy = 190, R = 84, r = 47, k = 0.6, T = 12;
  const P = (ang, rad, z = 0) => [cx + rad * Math.cos(ang), cy + rad * k * Math.sin(ang) - z];
  const colors = separateHues(slices.map((s) => (s.language ? s.color : null))).map((c) => (c ? harmonize(c, t.langLightness) : t.other));

  // angles: start at 12 o'clock, clockwise
  let acc = -Math.PI / 2;
  const segs = slices.map((s, i) => {
    const a0 = acc, a1 = acc + (s.contributions / total) * Math.PI * 2;
    acc = a1;
    return { ...s, a0, a1, color: colors[i], i };
  });

  const arc = (rad, a0, a1, z, sweep) => {
    const [x, y] = P(a1, rad, z);
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    return `A${n(rad)} ${n(rad * k)} 0 ${large} ${sweep} ${n(x)} ${n(y)}`;
  };
  const M = (p) => `M${n(p[0])} ${n(p[1])}`;
  const L = (p) => `L${n(p[0])} ${n(p[1])}`;
  const clampRange = (a0, a1, lo, hi) => [Math.max(a0, lo), Math.min(a1, hi)];

  const walls = [], inner = [], topFaces = [];
  for (const s of segs) {
    if (s.a1 - s.a0 < 1e-6) continue;
    // outer wall: only the front half (sin > 0) is visible
    const front = [];
    for (const base of [-2 * Math.PI, 0, 2 * Math.PI]) {
      const [b0, b1] = clampRange(s.a0, s.a1, base, base + Math.PI);
      if (b1 - b0 > 1e-6) front.push([b0, b1]);
    }
    for (const [b0, b1] of front) {
      const mid = (b0 + b1) / 2;
      const lit = shade(s.color, -0.07 - 0.11 * Math.cos(mid)); // faces to the right are darker
      walls.push(el('path', { d: `${M(P(b0, R, T))}${arc(R, b0, b1, T, 1)}${L(P(b1, R, 0))}${arc(R, b1, b0, 0, 0)}Z`, fill: lit }));
    }
    // inner wall: back half of the hole (sin < 0) is visible
    for (const base of [-Math.PI, Math.PI]) {
      const [b0, b1] = clampRange(s.a0, s.a1, base, base + Math.PI);
      if (b1 - b0 > 1e-6)
        inner.push(el('path', { d: `${M(P(b0, r, T))}${arc(r, b0, b1, T, 1)}${L(P(b1, r, 0))}${arc(r, b1, b0, 0, 0)}Z`, fill: shade(s.color, mode === 'dark' ? -0.16 : -0.1) }));
    }
    topFaces.push(el('path', {
      d: `${M(P(s.a0, R, T))}${arc(R, s.a0, s.a1, T, 1)}${L(P(s.a1, r, T))}${arc(r, s.a1, s.a0, T, 0)}Z`,
      fill: s.color, stroke: shade(s.color, 0.14), 'stroke-width': 0.9, 'stroke-linejoin': 'round',
    }, el('title', {}, `${s.language || labels.other}: ${s.contributions}`)));
  }
  // slice seams on the outer wall
  const seams = segs.filter((s) => Math.sin(s.a0) > 0.02).map((s) =>
    el('path', { d: `${M(P(s.a0, R, T))}${L(P(s.a0, R, 0))}`, stroke: shade(s.color, -0.3), 'stroke-width': 0.8, opacity: 0.6 }));
  // thin lit rim along the top outer edge (front half)
  const rim = el('path', { d: `${M(P(0, R, T))}${arc(R, 0, Math.PI, T, 1)}`, stroke: mode === 'dark' ? t.accent : '#FFFFFF', 'stroke-width': 1, opacity: mode === 'dark' ? 0.35 : 0.7 });
  // soft contact shadow
  const shadowGrad = el('radialGradient', { id: 'dshadow', cx: 0.5, cy: 0.5, r: 0.5 }, [
    el('stop', { offset: 0.42, 'stop-color': t.shadow.color, 'stop-opacity': 0 }),
    el('stop', { offset: 0.72, 'stop-color': t.shadow.color, 'stop-opacity': t.shadow.opacity * 1.25 }),
    el('stop', { offset: 1, 'stop-color': t.shadow.color, 'stop-opacity': 0 }),
  ]);
  const shadow = el('ellipse', { cx: cx + 8, cy: cy + 8, rx: R * 1.1, ry: R * k * 1.12, fill: 'url(#dshadow)' });

  // centre label on the top surface
  const num = textPath(fonts.bold, total.toLocaleString('en-US'), { x: cx, y: cy - 3, size: 20, anchor: 'middle' });
  const unit = textPath(fonts.medium, labels.commitsUnit, { x: cx, y: cy + 10, size: 10.5, anchor: 'middle' });

  // legend
  const lx = 192, rowH = 27;
  const ly0 = cy - T / 2 - ((segs.length - 1) * rowH) / 2;
  const legend = segs.map((s, i) => {
    const y = ly0 + i * rowH;
    const f = diamond(lx + 6, y + 2, 6.5, 6.5 * TAN);
    const pct = ((s.contributions / total) * 100).toFixed(s.contributions / total < 0.1 ? 1 : 0) + '%';
    const name = textPath(fonts.medium, s.language || labels.other, { x: lx + 20, y: y + 5, size: 14 });
    const val = textPath(fonts.semibold, pct, { x: CHART_W - 2, y: y + 5, size: 14, anchor: 'end' });
    return el('g', { class: animated ? 'fade' : undefined, style: animated ? `animation-delay:${700 + i * 90}ms` : undefined }, [
      prism(f, 5, s.color, t.shade),
      el('path', { d: name.d, fill: s.language ? t.ink : t.ink2 }),
      el('path', { d: val.d, fill: t.ink2 }),
    ]);
  });

  // reveal mask: a wedge sweeping clockwise from 12 o'clock (once)
  const maskR = (R + T / k + 8) / 2;
  const defs = [shadowGrad];
  if (animated) {
    defs.push(el('mask', { id: 'reveal', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: CHART_W, height: CHART_H },
      el('g', { transform: `translate(${n(cx)} ${n(cy - T / 2)}) scale(1 ${k}) rotate(-90)` },
        el('circle', { r: maskR, stroke: '#fff', 'stroke-width': maskR * 2 + 2, fill: 'none', pathLength: 100, class: 'sweep' }))));
    defs.push(el('clipPath', { id: 'topClip' }, segs.map((s) => el('path', { d: `${M(P(s.a0, R, T))}${arc(R, s.a0, s.a1, T, 1)}${L(P(s.a1, r, T))}${arc(r, s.a1, s.a0, T, 0)}Z` }))));
    defs.push(el('linearGradient', { id: 'dsheen', x1: 0, x2: 1 }, [
      el('stop', { offset: 0, 'stop-color': '#FFFFFF', 'stop-opacity': 0 }),
      el('stop', { offset: 0.5, 'stop-color': '#FFFFFF', 'stop-opacity': mode === 'dark' ? 0.16 : 0.32 }),
      el('stop', { offset: 1, 'stop-color': '#FFFFFF', 'stop-opacity': 0 }),
    ]));
  }
  const donut = el('g', { mask: animated ? 'url(#reveal)' : undefined }, [inner, walls, seams, topFaces, rim]);
  const sheen = animated
    ? el('g', { 'clip-path': 'url(#topClip)' }, el('rect', { x: cx - R - 90, y: cy - R, width: 70, height: R * 2, fill: 'url(#dsheen)', class: 'dsheen', transform: 'skewX(-20)' }))
    : null;

  const Pd = motion.sheenPeriodS;
  const style = css(animated, [
    `.sweep{stroke-dasharray:100 100;animation:sweep 1200ms ${motion.ease} 150ms both}`,
    `@keyframes sweep{from{stroke-dashoffset:100}}`,
    `.fade{animation:fade 500ms ease-out both}`,
    `@keyframes fade{from{opacity:0}}`,
    `.dsheen{animation:dsheen ${Pd}s ease-in-out 2.4s infinite both}`,
    `@keyframes dsheen{0%{transform:skewX(-20deg) translateX(0)}20%,100%{transform:skewX(-20deg) translateX(${2 * R + 140}px)}}`,
  ]);

  const desc = segs.map((s) => `${s.language || labels.other} ${((s.contributions / total) * 100).toFixed(1)}%`).join(', ');
  return doc({
    width: CHART_W, height: CHART_H,
    title: `${labels.languagesTitle}: ${desc}`,
    desc: `Commit contributions in the past year (${total}), grouped by repository primary language. ${desc}.`,
    css: style, defs,
    body: [
      el('path', { d: title.d, fill: t.ink }), el('path', { d: note.d, fill: t.ink3 }),
      shadow, donut, sheen,
      el('path', { d: num.d, fill: t.ink }), el('path', { d: unit.d, fill: t.ink2 }),
      legend,
    ],
  });
}
