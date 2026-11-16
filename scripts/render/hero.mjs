// Hero: greeting (small) → name (anchor) with a faint emerald offset layer and a
// slow light pass, plus a small iso "pipeline" of emerald columns on the right.
// The intro paragraph itself stays as real text in README.md.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { el, n, pathOf, doc } from '../lib/svg.mjs';
import { TAN, diamond, prism } from '../lib/iso.mjs';
import { shade } from '../lib/color.mjs';
import { textPath } from '../lib/fonts.mjs';
import { loadIcon } from '../lib/icons.mjs';
import { css } from '../lib/motion.mjs';

import { FULL_W as HERO_W } from '../lib/layout.mjs';

export function renderHero({ config, t, mode, fonts, motion, animated, root }) {
  const intro = config.intro;
  const H = 172;

  // --- greeting row: "こんにちは 👋！ 私は"  (emoji drawn from Noto Emoji SVG)
  const gSize = 28, gY = 52;
  const [before, after] = intro.greeting.split('{wave}');
  const g1 = textPath(fonts.medium, before.trimEnd(), { x: 0, y: gY, size: gSize });
  const waveX = g1.width + gSize * 0.28, waveSize = gSize * 1.08;
  const wave = loadIcon(root, '1f44b', {}, { prefix: 'wave', dir: 'assets/emoji' });
  const g2 = textPath(fonts.medium, after.trim(), { x: waveX + waveSize + gSize * 0.08, y: gY, size: gSize });
  const g3 = textPath(fonts.medium, intro.namePrefix, { x: g2.x0 + g2.width + gSize * 0.12, y: gY, size: gSize });

  // --- name row: name (anchor) + です
  const nSize = 58, nY = 136;
  const name = textPath(fonts.bold, intro.name, { x: -2, y: nY, size: nSize });
  const desu = textPath(fonts.medium, intro.nameSuffix, { x: name.x0 + name.width + 14, y: nY, size: gSize });

  // --- iso pipeline detail (top right): three columns on a small board along
  // the up-right iso axis, joined by a flow line. u = up-right, v = down-right.
  const dx = 11, dy = dx * TAN;
  const X0 = 684, Y0 = 72;
  const at = (u, v) => [X0 + (u + v) * dx, Y0 + (v - u) * dy];
  const cols = [ { u: 0, h: 12, lv: 2 }, { u: 2, h: 22, lv: 3 }, { u: 4, h: 34, lv: 4 } ];
  const th = 5;
  const B = [at(-0.95, -0.95), at(4.95, -0.95), at(4.95, 0.95), at(-0.95, 0.95)]; // back-left, back-right(top), front-right, front-left
  const dn = ([x, y]) => [x, y + th];
  const plate = el('g', {}, [
    el("path", { d: pathOf([B[3], B[2], dn(B[2]), dn(B[3])]), fill: t.plate.left }),
    el('path', { d: pathOf([B[2], B[1], dn(B[1]), dn(B[2])]), fill: t.plate.right }),
    el('path', { d: pathOf(B), fill: t.plate.top }),
    el('path', { d: pathOf([B[3], B[2], B[1]], false), stroke: t.plate.edge, 'stroke-width': 1 }),
  ]);
  const tops = [];
  const blocks = [...cols].reverse().map((c) => {
    const i = cols.indexOf(c);
    const [cx, cy] = at(c.u, 0);
    const f = diamond(cx, cy, dx * 0.9, dy * 0.9);
    const col = t.levels[c.lv];
    return el('g', { class: animated ? 'rise' : undefined, style: animated ? `--h:${c.h}px;animation-delay:${200 + i * 120}ms` : undefined },
      prism(f, c.h, col, t.shade, { rim: shade(col, t.shade.rim), rimOpacity: t.shade.rimOpacity }));
  });
  cols.forEach((c) => { const [cx, cy] = at(c.u, 0); tops.push([cx, cy - c.h]); });
  const flow = el('path', { d: pathOf(tops, false), stroke: t.accent, 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.9 });
  const nodes = tops.map(([x, y]) => el('circle', { cx: x, cy: y, r: 2.6, fill: t.accent }));
  const packet = animated
    ? el('circle', { r: 2.2, fill: mode === 'dark' ? '#E9FFF5' : '#FFFFFF', stroke: t.accent, 'stroke-width': 1, class: 'packet',
        style: `offset-path:path('${pathOf(tops, false)}')` })
    : null;

  // --- name: offset emerald layer + sheen
  const lift = el('path', { d: name.d, fill: t.accent, opacity: mode === 'dark' ? 0.3 : 0.22, transform: 'translate(1.5 2.5)' });
  const sheenId = 'sheen';
  const defs = [
    el('clipPath', { id: 'nameClip' }, el('path', { d: name.d })),
    el('linearGradient', { id: sheenId, x1: 0, x2: 1, y1: 0, y2: 0 }, [
      el('stop', { offset: 0, 'stop-color': t.sheen.color, 'stop-opacity': 0 }),
      el('stop', { offset: 0.5, 'stop-color': t.sheen.color, 'stop-opacity': t.sheen.opacity }),
      el('stop', { offset: 1, 'stop-color': t.sheen.color, 'stop-opacity': 0 }),
    ]),
  ];
  const sheen = animated
    ? el('g', { 'clip-path': 'url(#nameClip)' }, el('rect', { x: -160, y: nY - nSize, width: 120, height: nSize * 1.3, fill: `url(#${sheenId})`, class: 'sheen', transform: `skewX(-18)` }))
    : null;

  const waveSvg = `<svg x="${n(waveX)}" y="${n(gY - waveSize * 0.86)}" width="${n(waveSize)}" height="${n(waveSize)}" viewBox="${wave.viewBox}">${wave.inner}</svg>`;

  const P = motion.sheenPeriodS;
  const style = css(animated, [
    `.rise{animation:rise ${motion.entranceMs}ms ${motion.ease} both}`,
    `@keyframes rise{from{transform:translateY(var(--h));opacity:0}}`,
    `.sheen{animation:sheen ${P}s ease-in-out 1.2s infinite both}`,
    `@keyframes sheen{0%{transform:skewX(-18deg) translateX(0)}18%,100%{transform:skewX(-18deg) translateX(${HERO_W}px)}}`,
    `.packet{offset-rotate:0deg;animation:packet ${P}s ease-in-out 1.6s infinite both}`,
    `@keyframes packet{0%{offset-distance:0%;opacity:0}3%{opacity:1}22%{offset-distance:100%;opacity:1}26%,100%{offset-distance:100%;opacity:0}}`,
    `.packet{opacity:0}`,
  ]);

  return doc({
    width: HERO_W, height: H,
    title: intro.alt,
    desc: 'Greeting and name, with a small emerald data-pipeline model.',
    css: style,
    defs,
    body: [
      el('path', { d: g1.d, fill: t.ink2 }), waveSvg, el('path', { d: g2.d, fill: t.ink2 }), el('path', { d: g3.d, fill: t.ink2 }),
      lift,
      el('path', { d: name.d, fill: t.ink }),
      sheen,
      el('path', { d: desu.d, fill: t.ink2 }),
      plate, blocks, flow, nodes, packet,
    ],
  });
}
