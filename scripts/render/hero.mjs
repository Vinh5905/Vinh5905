// Hero: greeting (small) → name (anchor, faint emerald offset + slow light pass)
// → intro paragraph (medium weight), plus a small iso "pipeline" of emerald
// columns. Two layouts share one design: full (760) and compact (420, phones).
import { el, n, pathOf, doc } from '../lib/svg.mjs';
import { TAN, diamond, prism } from '../lib/iso.mjs';
import { shade } from '../lib/color.mjs';
import { textPath } from '../lib/fonts.mjs';
import { loadIcon } from '../lib/icons.mjs';
import { css } from '../lib/motion.mjs';
import { FULL_W } from '../lib/layout.mjs';
import { generateLightning, renderLightning } from '../lib/lightning.mjs';

export const HERO_COMPACT_W = 420;
const EMOJI = { wave: '1f44b', smile: '1f60a' };

/** Text with {wave}/{smile} tokens → outlined text + Noto emoji images. */
function richLine(root, font, text, { x, y, size, fill, prefix }) {
  const parts = text.split(/(\{\w+\})/).filter(Boolean);
  let cx = x;
  const out = [];
  parts.forEach((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    if (m && EMOJI[m[1]]) {
      const icon = loadIcon(root, EMOJI[m[1]], {}, { prefix: `${prefix}-${i}`, dir: 'assets/emoji' });
      const s = size * 1.08;
      cx += size * 0.12;
      out.push(`<svg x="${n(cx)}" y="${n(y - s * 0.86)}" width="${n(s)}" height="${n(s)}" viewBox="${icon.viewBox}" fill="#000">${icon.inner}</svg>`);
      cx += s + size * 0.06;
    } else {
      const t = textPath(font, part, { x: cx, y, size });
      out.push(el('path', { d: t.d, fill }));
      cx += t.width;
    }
  });
  return { markup: out, width: cx - x };
}

export function renderHero({ config, t, mode, fonts, motion, animated, root, compact = false }) {
  const intro = config.intro;
  const W = compact ? HERO_COMPACT_W : FULL_W;
  const L = compact
    ? { g: 22, gY: 40, nS: 34, nY: 100, body: 20, bY: 150, pitch: 33, lines: intro.linesCompact, dx: 8.5, X0: 356, Y0: 58 }
    : { g: 28, gY: 52, nS: 58, nY: 136, body: 21, bY: 200, pitch: 36, lines: intro.lines, dx: 11, X0: 684, Y0: 72 };

  // greeting row: "こんにちは 👋！ 私は"
  const greet = richLine(root, fonts.medium, `${intro.greeting}${intro.namePrefix}`, { x: 0, y: L.gY, size: L.g, fill: t.ink2, prefix: 'g' });

  // name row
  const name = textPath(fonts.bold, intro.name, { x: -1, y: L.nY, size: L.nS });
  const desu = textPath(fonts.medium, intro.nameSuffix, { x: name.x0 + name.width + L.nS * 0.22, y: L.nY, size: L.g * (compact ? 0.82 : 1) });

  // intro paragraph
  const body = L.lines.map((line, i) => richLine(root, fonts.medium, line, { x: 0, y: L.bY + i * L.pitch, size: L.body, fill: t.ink, prefix: `b${i}` }));
  const H = Math.ceil(L.bY + (L.lines.length - 1) * L.pitch + L.body * 0.6 + 14);

  // iso pipeline detail: three columns on a small board along the up-right axis
  const dx = L.dx, dy = dx * TAN, k = dx / 11;
  const at = (u, v) => [L.X0 + (u + v) * dx, L.Y0 + (v - u) * dy];
  const cols = [{ u: 0, h: 12 * k, lv: 2 }, { u: 2, h: 22 * k, lv: 3 }, { u: 4, h: 34 * k, lv: 4 }];
  const th = 5 * k;
  const B = [at(-0.95, -0.95), at(4.95, -0.95), at(4.95, 0.95), at(-0.95, 0.95)];
  const dn = ([x, y]) => [x, y + th];
  const plate = el('g', {}, [
    el('path', { d: pathOf([B[3], B[2], dn(B[2]), dn(B[3])]), fill: t.plate.left }),
    el('path', { d: pathOf([B[2], B[1], dn(B[1]), dn(B[2])]), fill: t.plate.right }),
    el('path', { d: pathOf(B), fill: t.plate.top }),
    el('path', { d: pathOf([B[3], B[2], B[1]], false), stroke: t.plate.edge, 'stroke-width': 1 }),
  ]);
  const blocks = [...cols].reverse().map((c) => {
    const i = cols.indexOf(c);
    const [cx, cy] = at(c.u, 0);
    const col = t.levels[c.lv];
    return el('g', { class: animated ? 'rise' : undefined, style: animated ? `--h:${n(c.h)}px;animation-delay:${200 + i * 120}ms` : undefined },
      prism(diamond(cx, cy, dx * 0.9, dy * 0.9), c.h, col, t.shade, { rim: shade(col, t.shade.rim), rimOpacity: t.shade.rimOpacity }));
  });
  const tops = cols.map((c) => { const [cx, cy] = at(c.u, 0); return [cx, cy - c.h]; });
  const flow = el('path', { d: pathOf(tops, false), stroke: t.accent, 'stroke-width': 1.4 * Math.max(k, 0.8), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.9 });
  const nodes = tops.map(([x, y]) => el('circle', { cx: x, cy: y, r: 2.6 * Math.max(k, 0.8), fill: t.accent }));
  const packet = animated
    ? el('circle', { r: 2.2, fill: mode === 'dark' ? '#E9FFF5' : '#FFFFFF', stroke: t.accent, 'stroke-width': 1, class: 'packet', style: `offset-path:path('${pathOf(tops, false)}')` })
    : null;

  // name: offset emerald layer + sheen
  const lift = el('path', { d: name.d, fill: t.accent, opacity: mode === 'dark' ? 0.3 : 0.22, transform: `translate(${n(L.nS * 0.026)} ${n(L.nS * 0.043)})` });
  const defs = [
    el('clipPath', { id: 'nameClip' }, el('path', { d: name.d })),
    el('linearGradient', { id: 'sheen', x1: 0, x2: 1, y1: 0, y2: 0 }, [
      el('stop', { offset: 0, 'stop-color': t.sheen.color, 'stop-opacity': 0 }),
      el('stop', { offset: 0.5, 'stop-color': t.sheen.color, 'stop-opacity': t.sheen.opacity }),
      el('stop', { offset: 1, 'stop-color': t.sheen.color, 'stop-opacity': 0 }),
    ]),
  ];
  const sheen = animated
    ? el('g', { 'clip-path': 'url(#nameClip)' }, el('rect', { x: -160, y: L.nY - L.nS, width: 120, height: L.nS * 1.3, fill: 'url(#sheen)', class: 'sheen', transform: 'skewX(-18)' }))
    : null;

  // ---- lightning: only in the animated file; whole hero area, or around the text when avoidText is set
  let lightning = null;
  const lc = config.lightning;
  if (animated && lc?.enabled) {
    const box = (x, y0, w, size) => [x, y0 - size * 0.92, w, size * 1.18];
    const ys = [...B, ...tops].map(([, y]) => y), xs = [...B, ...tops].map(([x]) => x);
    const keepOut = !lc.avoidText ? [] : [
      box(0, L.gY, greet.width, L.g),
      box(0, L.nY, desu.x0 + desu.width, L.nS),
      ...L.lines.map((_, i) => box(0, L.bY + i * L.pitch, body[i].width, L.body)),
      [Math.min(...xs) - 4, Math.min(...ys) - 6, Math.max(...xs) - Math.min(...xs) + 8, Math.max(...ys) - Math.min(...ys) + th + 10],
    ];
    const gen = generateLightning({ ...lc, seed: lc.seed + (compact ? 101 : 0) }, { width: W, height: H, keepOut });
    lightning = renderLightning(gen, lc.colors[mode], { width: W, height: H, uid: 'lt', thickness: lc.thickness ?? 1 });
    defs.push(...lightning.defs);
  }

  const P = motion.sheenPeriodS;
  const style = css(animated, [
    `.rise{animation:rise ${motion.entranceMs}ms ${motion.ease} both}`,
    `@keyframes rise{from{transform:translateY(var(--h));opacity:0}}`,
    `.sheen{animation:sheen ${P}s ease-in-out 1.2s infinite both}`,
    `@keyframes sheen{0%{transform:skewX(-18deg) translateX(0)}18%,100%{transform:skewX(-18deg) translateX(${W + 200}px)}}`,
    `.packet{opacity:0;offset-rotate:0deg;animation:packet ${P}s ease-in-out 1.6s infinite both}`,
    `@keyframes packet{0%{offset-distance:0%;opacity:0}3%{opacity:1}22%{offset-distance:100%;opacity:1}26%,100%{offset-distance:100%;opacity:0}}`,
  ...(lightning ? lightning.css : []),
  ]);

  return doc({
    width: W, height: H,
    title: intro.alt,
    desc: 'Greeting, name and introduction, with a small emerald data-pipeline model.',
    css: style, defs,
    body: [greet.markup, lift, el('path', { d: name.d, fill: t.ink }), sheen, el('path', { d: desu.d, fill: t.ink2 }), body.map((b) => b.markup), plate, blocks, flow, nodes, packet, lightning ? lightning.body : null],
  });
}
