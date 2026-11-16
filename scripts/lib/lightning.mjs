// Random green lightning, baked into an SVG with CSS keyframes.
//
// Every discharge is generated (seeded PRNG → reproducible): its own start,
// end, direction, number of bends, branches, sparks, brightness and timing.
// The image loops every `loopSeconds`, but inside one loop no path repeats and
// the gaps between discharges are irregular (1.5–5 s), so it reads as random.
//
// Each discharge plays four stages (times in ms, per event):
//   A spark 50–120 → B discharge draws along the path 80–200 →
//   C irregular flicker 80–180 → D fade 100–250 (branches first, glow last).
// Base style of every lightning element is opacity 0: with no animation
// (static file, reduced motion) nothing is drawn.
import { el, n } from './svg.mjs';

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const CLASSES = {
  //          length px   segs     amp          branches  glowW glowOp  flicker  fade      spark
  subtle: { len: [34, 78], seg: [5, 8], amp: [0.10, 0.20], br: [0, 1], brP: 0.25, glowW: 3.2, glowOp: 0.5, flick: [80, 120], fade: [100, 160], spark: [50, 80], peak: 0.85, sparks: [0, 1] },
  medium: { len: [70, 140], seg: [7, 10], amp: [0.12, 0.24], br: [1, 2], brP: 1, glowW: 4.2, glowOp: 0.65, flick: [100, 160], fade: [140, 210], spark: [70, 100], peak: 0.95, sparks: [1, 2] },
  strong: { len: [130, 220], seg: [9, 12], amp: [0.14, 0.28], br: [2, 4], brP: 1, glowW: 5.4, glowOp: 0.9, flick: [140, 180], fade: [180, 250], spark: [90, 120], peak: 1, sparks: [2, 3] },
};

export function generateLightning(cfg, { width, height, keepOut }) {
  const rnd = mulberry32(cfg.seed >>> 0);
  const R = (a, b) => a + (b - a) * rnd();
  const RI = (a, b) => Math.floor(R(a, b + 1));
  const pickClass = () => {
    const x = rnd(), m = cfg.mix;
    return x < m.subtle ? 'subtle' : x < m.subtle + m.medium ? 'medium' : 'strong';
  };
  const M = cfg.margin ?? 10, C = cfg.textClearance ?? 8;
  const blocked = (x, y, pad = 0) =>
    x < M + pad || y < M + pad || x > width - M - pad || y > height - M - pad ||
    keepOut.some(([bx, by, bw, bh]) => x > bx - C - pad && x < bx + bw + C + pad && y > by - C - pad && y < by + bh + C + pad);
  // every point, and points along every segment, must stay clear (glow included)
  const clear = (pts, pad) => pts.every(([x, y], i) => {
    if (blocked(x, y, pad)) return false;
    if (!i) return true;
    const [px, py] = pts[i - 1];
    for (let k = 1; k < 4; k++) if (blocked(px + ((x - px) * k) / 4, py + ((y - py) * k) / 4, pad)) return false;
    return true;
  });

  const jagged = (S, angle, len, segs, amp) => {
    const E = [S[0] + Math.cos(angle) * len, S[1] + Math.sin(angle) * len];
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    const ts = [0, ...Array.from({ length: segs - 1 }, () => rnd()).sort(), 1];
    let drift = 0;
    const main = ts.map((t, i) => {
      if (i === 0 || i === ts.length - 1) return i ? E : S;
      // random walk + kick: angular zigzags, never a smooth wave
      drift = drift * 0.35 + R(-1, 1) * amp * len * (rnd() < 0.3 ? 1.6 : 1);
      const taper = Math.sin(Math.PI * t) ** 0.6;
      return [S[0] + (E[0] - S[0]) * t + nx * drift * taper, S[1] + (E[1] - S[1]) * t + ny * drift * taper];
    });
    // fine crackle: split each segment once with a small sideways kink
    const out = [main[0]];
    for (let i = 1; i < main.length; i++) {
      const [ax, ay] = main[i - 1], [bx, by] = main[i];
      const sl = Math.hypot(bx - ax, by - ay);
      if (sl > 9) {
        const f = R(0.35, 0.65), k = R(-1, 1) * sl * 0.16;
        const px = -(by - ay) / sl, py = (bx - ax) / sl;
        out.push([ax + (bx - ax) * f + px * k, ay + (by - ay) * f + py * k]);
      }
      out.push(main[i]);
    }
    return out;
  };

  const events = [];
  let t = R(0.6, 1.6) * 1000;
  let prev = null;
  const loopMs = cfg.loopSeconds * 1000;
  while (t < loopMs - 1500) {
    const doubles = prev && rnd() < cfg.doubleChance ? 1 : 0;
    const kind = pickClass();
    const K = CLASSES[kind];
    let made = null;
    for (let tries = 0; tries < 400 && !made; tries++) {
      const len = R(...K.len) * (0.85 + 0.15 * cfg.intensity);
      let S;
      if (doubles && prev) S = [prev.points[0][0] + R(-40, 40), prev.points[0][1] + R(-24, 24)];
      else if (rnd() < 0.18) { // occasionally close to an edge
        S = rnd() < 0.5 ? [R(M + 6, M + 24), R(M, height - M)] : [R(M, width - M), rnd() < 0.5 ? R(M + 6, M + 22) : R(height - M - 22, height - M - 6)];
        if (S[0] > M + 24 && rnd() < 0.5) S[0] = width - (S[0] - M) ;
      } else S = [R(M, width - M), R(M, height - M)];
      if (blocked(S[0], S[1], 4)) continue;
      // keep separate discharges apart so each stays readable
      if (!doubles && prev && Math.hypot(S[0] - prev.points[0][0], S[1] - prev.points[0][1]) < 110) continue;
      const angle = R(0, Math.PI * 2);
      const points = jagged(S, angle, len, RI(...K.seg), R(...K.amp));
      if (!clear(points, 5)) continue;
      const nb = rnd() < K.brP ? RI(...K.br) : 0;
      const branches = [];
      for (let b = 0; b < nb; b++) {
        const k = RI(1, points.length - 3);
        const side = rnd() < 0.5 ? -1 : 1;
        const bp = jagged(points[k], angle + side * R(0.35, 0.95), len * R(0.2, 0.45), RI(3, 5), R(0.1, 0.22));
        if (clear(bp, 4)) branches.push({ from: k, points: bp });
      }
      const sparks = Array.from({ length: RI(...K.sparks) }, () => {
        const p = points[RI(1, points.length - 2)];
        return [p[0] + R(-9, 9), p[1] + R(-9, 9), R(0.8, 1.6)];
      }).filter(([x, y]) => !blocked(x, y, 3));
      made = {
        kind, points, branches, sparks,
        start: Math.round(t),
        spark: Math.round(R(...K.spark)),
        draw: Math.round(R(80, 200) * (kind === 'strong' ? 1 : kind === 'medium' ? 0.85 : 0.7)),
        flick: Math.round(R(...K.flick)),
        fade: Math.round(R(...K.fade)),
        peak: K.peak * (0.8 + 0.2 * rnd()),
        glowW: K.glowW * cfg.glow * R(0.85, 1.15),
        glowOp: Math.min(1, K.glowOp * cfg.glow * R(0.8, 1.1)),
        flickSeed: rnd(),
      };
    }
    if (made) { events.push(made); prev = made; }
    // a "double" follows quickly; otherwise wait 1.5–5 s
    t += rnd() < cfg.doubleChance ? R(0.18, 0.45) * 1000 : R(...cfg.gapSeconds) * 1000;
  }
  return { events, loopMs };
}

/** SVG markup + CSS for the generated events. `uid` keeps ids unique per file. */
export function renderLightning({ events, loopMs }, colors, { width, height, uid = 'lt' }) {
  const pct = (ms) => `${((ms / loopMs) * 100).toFixed(3)}%`;
  const d = (pts) => 'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L');
  const css = [`.${uid}{opacity:0}`];
  const frames = (name, list) => {
    // list: [ms, 'decls'] — ms relative to event start; delay sets the start
    css.push(`@keyframes ${name}{${list.map(([ms, decl]) => `${pct(Math.max(0, ms))}{${decl}}`).join('')}100%{opacity:0}}`);
  };
  const anim = (name, start) => `animation:${name} ${loopMs}ms linear ${start}ms infinite`;
  const body = [];
  const defs = [
    el('filter', { id: `${uid}Blur`, filterUnits: 'userSpaceOnUse', x: 0, y: 0, width, height }, el('feGaussianBlur', { stdDeviation: 1.9 })),
    el('filter', { id: `${uid}Soft`, filterUnits: 'userSpaceOnUse', x: 0, y: 0, width, height }, el('feGaussianBlur', { stdDeviation: 4.5 })),
  ];

  events.forEach((ev, i) => {
    const id = `${uid}${i}`;
    const r = mulberry32(Math.floor(ev.flickSeed * 1e9));
    const A = ev.spark, B = A + ev.draw, Cc = B + ev.flick, D = Cc + ev.fade;
    const S = ev.points[0];

    // irregular flicker sequence inside stage C: [ms, opacity]
    const flick = (dropChance) => {
      const out = [];
      let tt = B;
      while (tt < Cc - 10) {
        tt += 12 + r() * 26;
        const v = r() < dropChance ? 0 : r() < 0.35 ? 0.3 + r() * 0.3 : 0.75 + r() * 0.25;
        out.push([Math.min(tt, Cc - 4), v]);
      }
      return out;
    };

    // A: spark + soft reflection at the discharge point
    frames(`${id}s`, [[0, 'opacity:0;transform:scale(.3)'], [A * 0.6, 'opacity:1;transform:scale(1.25)'], [A, 'opacity:.9;transform:scale(1)'], [B, 'opacity:.55'], [Cc, 'opacity:.35'], [Cc + ev.fade * 0.4, 'opacity:0']]);
    body.push(el('g', { class: uid, style: `${anim(`${id}s`, ev.start)};transform-box:fill-box;transform-origin:center` }, [
      el('circle', { cx: n(S[0]), cy: n(S[1]), r: 7 + ev.glowW, fill: colors.glow, opacity: 0.35, filter: `url(#${uid}Soft)` }),
      el('circle', { cx: n(S[0]), cy: n(S[1]), r: 1.8, fill: colors.core }),
    ]));

    // glow under the whole bolt: draws with it, flashes in C, fades last
    const glowFlick = flick(0).map(([ms, v]) => [ms, `opacity:${(ev.glowOp * (0.7 + v * 0.45)).toFixed(2)}`]);
    frames(`${id}g`, [
      [A - 1, 'opacity:0;stroke-dashoffset:100'], [A, `opacity:${ev.glowOp.toFixed(2)};stroke-dashoffset:100`],
      [B, `opacity:${ev.glowOp.toFixed(2)};stroke-dashoffset:0`], [B + 14, `opacity:${Math.min(1, ev.glowOp * 1.5).toFixed(2)};stroke-dashoffset:0`],
      ...glowFlick.map(([ms, v]) => [ms, `${v};stroke-dashoffset:0`]),
      [Cc, `opacity:${(ev.glowOp * 0.8).toFixed(2)};stroke-dashoffset:0`], [D + 80, 'opacity:0;stroke-dashoffset:0'],
    ]);
    body.push(el('path', {
      d: d(ev.points), class: uid, pathLength: 100, 'stroke-dasharray': '100 101', stroke: colors.glow, 'stroke-width': n(ev.glowW),
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: `url(#${uid}Blur)`, style: anim(`${id}g`, ev.start),
    }));

    // main bolt in 2–3 chunks: propagates chunk by chunk, chunks flicker independently
    const nPts = ev.points.length;
    const nChunks = nPts > 8 ? 3 : 2;
    const cuts = Array.from({ length: nChunks + 1 }, (_, c) => Math.round((c * (nPts - 1)) / nChunks));
    for (let c = 0; c < nChunks; c++) {
      const pts = ev.points.slice(cuts[c], cuts[c + 1] + 1);
      const t0 = A + (ev.draw * cuts[c]) / (nPts - 1), t1 = A + (ev.draw * cuts[c + 1]) / (nPts - 1);
      const pk = ev.peak.toFixed(2);
      const fl = flick(c === 1 ? 0.22 : 0.1).map(([ms, v]) => [ms, `opacity:${(v * ev.peak).toFixed(2)};stroke-dashoffset:0`]);
      frames(`${id}c${c}`, [
        [t0 - 1, 'opacity:0;stroke-dashoffset:100'], [t0, `opacity:${pk};stroke-dashoffset:100`], [t1, `opacity:${pk};stroke-dashoffset:0`],
        [B + 10, 'opacity:1;stroke-dashoffset:0'], ...fl, [Cc, `opacity:${pk};stroke-dashoffset:0`],
        [Cc + ev.fade * 0.55, `opacity:${(ev.peak * 0.35).toFixed(2)};stroke-dashoffset:0`], [D, 'opacity:0;stroke-dashoffset:0'],
      ]);
      const dd = d(pts);
      body.push(el('g', { class: uid, style: anim(`${id}c${c}`, ev.start), 'stroke-linecap': 'round', 'stroke-linejoin': 'miter', 'stroke-dasharray': '100 101' }, [
        el('path', { d: dd, pathLength: 100, stroke: colors.main, 'stroke-width': ev.kind === 'strong' ? 1.7 : 1.35 }),
        el('path', { d: dd, pathLength: 100, stroke: colors.core, 'stroke-width': ev.kind === 'strong' ? 0.7 : 0.55 }),
      ]));
    }

    // branches: emerge after their root is reached, flicker harder, vanish first
    ev.branches.forEach((br, b) => {
      const tb = A + (ev.draw * br.from) / (nPts - 1) + 10 + r() * 30;
      const te = tb + 40 + r() * 50;
      const fl = flick(0.3).map(([ms, v]) => [ms, `opacity:${(v * 0.9).toFixed(2)};stroke-dashoffset:0`]);
      frames(`${id}b${b}`, [
        [tb - 1, 'opacity:0;stroke-dashoffset:100'], [tb, 'opacity:.9;stroke-dashoffset:100'], [te, 'opacity:.9;stroke-dashoffset:0'],
        ...fl.filter(([ms]) => ms > te), [Cc - 10, 'opacity:.6;stroke-dashoffset:0'], [Cc + ev.fade * 0.35, 'opacity:0;stroke-dashoffset:0'],
      ]);
      const dd = d(br.points);
      body.push(el('g', { class: uid, style: anim(`${id}b${b}`, ev.start), 'stroke-linecap': 'round', 'stroke-linejoin': 'miter', 'stroke-dasharray': '100 101' }, [
        el('path', { d: dd, pathLength: 100, stroke: colors.glow, 'stroke-width': ev.glowW * 0.6, opacity: 0.5, filter: `url(#${uid}Blur)` }),
        el('path', { d: dd, pathLength: 100, stroke: colors.secondary, 'stroke-width': 1 }),
        el('path', { d: dd, pathLength: 100, stroke: colors.core, 'stroke-width': 0.4 }),
      ]));
    });

    // tiny sparks jumping near the bolt during the flicker
    ev.sparks.forEach(([x, y, rr], k) => {
      const ts = B + r() * ev.flick * 0.8;
      frames(`${id}p${k}`, [[ts - 1, 'opacity:0'], [ts, 'opacity:1'], [ts + 30 + r() * 30, 'opacity:0']]);
      body.push(el('circle', { cx: n(x), cy: n(y), r: n(rr), fill: colors.core, class: uid, style: anim(`${id}p${k}`, ev.start) }));
    });
  });

  return { defs, css, body: el('g', { 'pointer-events': 'none', fill: 'none' }, body) };
}
