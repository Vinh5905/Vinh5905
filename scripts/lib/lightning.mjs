// Random green lightning, baked into an SVG with CSS keyframes.
//
// Look & motion modelled on an electric arc: a long, finely crackled path is
// drawn quickly from its start to its end, holds and flickers, then dies out
// in scattered pieces while its glow lingers. A wide soft halo lights the
// background.
//
// Every discharge is generated from a seeded PRNG (reproducible): its own
// start, heading, wandering course, length, crackle, branches, speed,
// brightness and timing. Gaps between discharges are irregular (1.5–5 s);
// within one loop no path repeats. Base style of every lightning element is
// opacity 0, so with no animation (static file, reduced motion) nothing shows.
import { el, n } from './svg.mjs';

const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const CLASSES = {
  //        path length px    grow ms      hold ms      dissolve ms
  subtle: { len: [260, 420], grow: [240, 380], hold: [160, 300], fade: [260, 380], br: [0, 1], brP: 0.35, peak: 0.88, halo: 0.6 },
  medium: { len: [400, 620], grow: [320, 480], hold: [220, 380], fade: [320, 460], br: [1, 2], brP: 1, peak: 0.95, halo: 0.8 },
  strong: { len: [560, 900], grow: [420, 600], hold: [300, 480], fade: [380, 520], br: [2, 4], brP: 1, peak: 1, halo: 1 },
};

export function generateLightning(cfg, { width, height, keepOut = [] }) {
  const rnd = mulberry32(cfg.seed >>> 0);
  const R = (a, b) => a + (b - a) * rnd();
  const RI = (a, b) => Math.floor(R(a, b + 1));
  const size = cfg.size ?? 1;
  const M = cfg.margin ?? 10, C = cfg.textClearance ?? 8;
  const inside = (x, y, pad = 0) => x > M + pad && y > M + pad && x < width - M - pad && y < height - M - pad &&
    !keepOut.some(([bx, by, bw, bh]) => x > bx - C - pad && x < bx + bw + C + pad && y > by - C - pad && y < by + bh + C + pad);
  const pickClass = () => {
    const x = rnd(), m = cfg.mix;
    return x < m.subtle ? 'subtle' : x < m.subtle + m.medium ? 'medium' : 'strong';
  };

  // fine crackle: recursive midpoint displacement between coarse points
  const crackle = (a, b, disp, depth, out) => {
    if (depth === 0) { out.push(b); return; }
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const k = R(-1, 1) * disp * (rnd() < 0.2 ? 1.8 : 1); // occasional sharper kink
    const m = [(a[0] + b[0]) / 2 + (-dy / L) * k, (a[1] + b[1]) / 2 + (dx / L) * k];
    crackle(a, m, disp * 0.56, depth - 1, out);
    crackle(m, b, disp * 0.56, depth - 1, out);
  };

  // wandering course: heading random-walks; near an edge it bends along it or stops
  const course = (S, heading, len, step, turn) => {
    const pts = [S];
    let h = heading, walked = 0, [x, y] = S;
    while (walked < len) {
      h += R(-turn, turn);
      let nx = x + Math.cos(h) * step, ny = y + Math.sin(h) * step;
      // near an edge: bend gently along it; if that is not enough, the bolt ends
      // there (no hairpin loops)
      let guard = 0;
      const h0 = h;
      while (!inside(nx, ny, 6) && guard++ < 6) {
        h = h0 + (guard % 2 ? 1 : -1) * 0.22 * Math.ceil(guard / 2);
        nx = x + Math.cos(h) * step; ny = y + Math.sin(h) * step;
      }
      if (guard >= 6) break;
      x = nx; y = ny; walked += step;
      pts.push([x, y]);
    }
    return { pts, walked, heading: h };
  };
  const detail = (coarse, step) => {
    const out = [coarse[0]];
    for (let i = 1; i < coarse.length; i++) crackle(coarse[i - 1], coarse[i], step * R(0.2, 0.32), 3, out);
    return out;
  };
  const lengthOf = (pts) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

  const events = [];
  const loopMs = cfg.loopSeconds * 1000;
  let t = R(0.6, 1.4) * 1000, prev = null;
  while (t < loopMs - 1800) {
    const kind = pickClass();
    const K = CLASSES[kind];
    let made = null;
    for (let tries = 0; tries < 300 && !made; tries++) {
      // start: anywhere, or (40%) close to an edge running along it
      let S, heading;
      if (rnd() < 0.4) {
        const edge = RI(0, 3);
        const off = R(M + 8, M + 26);
        S = edge === 0 ? [R(M, width - M), off] : edge === 1 ? [R(M, width - M), height - off] : edge === 2 ? [off, R(M, height - M)] : [width - off, R(M, height - M)];
        heading = (edge < 2 ? 0 : Math.PI / 2) + (rnd() < 0.5 ? 0 : Math.PI) + R(-0.35, 0.35);
      } else {
        S = [R(M, width - M), R(M, height - M)];
        heading = R(0, Math.PI * 2);
      }
      if (!inside(S[0], S[1], 8)) continue;
      if (prev && Math.hypot(S[0] - prev.start[0], S[1] - prev.start[1]) < 120) continue;
      const len = R(...K.len) * size;
      const step = R(26, 40);
      const c = course(S, heading, len, step, R(0.22, 0.42));
      if (c.walked < len * 0.6) continue;
      const points = detail(c.pts, step);
      const branches = [];
      const nb = rnd() < K.brP ? RI(...K.br) : 0;
      for (let b = 0; b < nb; b++) {
        const k = RI(2, c.pts.length - 3);
        if (k < 1) continue;
        const dir = Math.atan2(c.pts[k + 1][1] - c.pts[k][1], c.pts[k + 1][0] - c.pts[k][0]) + (rnd() < 0.5 ? -1 : 1) * R(0.5, 1.1);
        const bc = course(c.pts[k], dir, len * R(0.12, 0.3), R(16, 26), 0.5);
        if (bc.pts.length < 3) continue;
        branches.push({ at: k / (c.pts.length - 1), points: detail(bc.pts, 20) });
      }
      made = {
        kind, start: S, points, branches,
        length: lengthOf(points),
        at: Math.round(t),
        grow: Math.round(R(...K.grow) * Math.sqrt(size) / (cfg.speed ?? 1)),
        hold: Math.round(R(...K.hold) / (cfg.speed ?? 1)),
        fade: Math.round(R(...K.fade) / (cfg.speed ?? 1)),
        peak: K.peak * R(0.85, 1),
        halo: K.halo * (cfg.glow ?? 1) * R(0.8, 1.1),
        seed: rnd(),
      };
    }
    if (made) { events.push(made); prev = made; }
    t += (made ? made.grow + made.hold + made.fade : 0) + (rnd() < cfg.doubleChance ? R(0.12, 0.35) * 1000 : R(...cfg.gapSeconds) * 1000);
  }
  return { events, loopMs };
}

/**
 * Rendering, per discharge (ms from its start):
 *   0 → G      grow: the bolt is drawn piece by piece from start to end
 *   G → G+H    hold: full bolt, whole-bolt flicker + random pieces blinking out
 *   G+H → end  dissolve: every piece dies at its own random moment after a last
 *              stutter — scattered across the bolt, never a sweep — while the
 *              glow and halo linger as an after-image
 */
export function renderLightning({ events, loopMs }, colors, { width, height, uid = 'lt', thickness = 1 }) {
  const pct = (ms) => `${((Math.max(0, ms) / loopMs) * 100).toFixed(3)}%`;
  const d = (pts) => 'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L');
  const css = [`.${uid}{opacity:0}`];
  const frames = (name, list) => {
    list.sort((a, b) => a[0] - b[0]);
    css.push(`@keyframes ${name}{${list.map(([ms, decl]) => `${pct(ms)}{${decl}}`).join('')}100%{opacity:0}}`);
  };
  const anim = (name, start) => `animation:${name} ${loopMs}ms linear ${start}ms infinite`;
  const th = thickness;
  const defs = [
    el('filter', { id: `${uid}Glow`, filterUnits: 'userSpaceOnUse', x: 0, y: 0, width, height }, el('feGaussianBlur', { stdDeviation: 2.4 })),
    el('filter', { id: `${uid}Halo`, filterUnits: 'userSpaceOnUse', x: 0, y: 0, width, height }, el('feGaussianBlur', { stdDeviation: 11 })),
  ];
  const body = [];
  const use = (ref, attrs) => el('use', { href: `#${ref}`, 'xlink:href': `#${ref}`, ...attrs });
  const lineAttrs = { 'stroke-dasharray': '100 101', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' };
  const cumLen = (pts) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; };

  events.forEach((ev, i) => {
    const id = `${uid}${i}`;
    const r = mulberry32(Math.floor(ev.seed * 1e9));
    const G = ev.grow, Hd = ev.hold, F = ev.fade;
    const end = G + Hd + F;
    const pk = ev.peak;

    // whole-bolt flicker during the hold: irregular steps
    const flick = [];
    for (let tt = G + 15 + r() * 25; tt < G + Hd - 10; tt += 22 + r() * 48)
      flick.push([tt, r() < 0.12 ? 0.35 : r() < 0.35 ? 0.65 + r() * 0.2 : 0.92 + r() * 0.08]);

    // glow + halo: drawn with the bolt, flash at full length, linger as after-image
    const pathId = `${id}p`;
    defs.push(el('path', { id: pathId, d: d(ev.points), pathLength: 100 }));
    const glowFrames = (mul, linger) => [
      [-1, 'opacity:0;stroke-dashoffset:100'],
      [0, `opacity:${n(mul * 0.8)};stroke-dashoffset:100`],
      [G, `opacity:${n(mul)};stroke-dashoffset:0`],
      [G + 40, `opacity:${n(Math.min(1, mul * 1.35))};stroke-dashoffset:0`],
      ...flick.map(([tt, v]) => [tt, `opacity:${n(mul * (0.75 + 0.25 * v))};stroke-dashoffset:0`]),
      [G + Hd, `opacity:${n(mul * 0.9)};stroke-dashoffset:0`],
      [end + linger, 'opacity:0;stroke-dashoffset:0'],
    ];
    frames(`${id}h`, glowFrames(ev.halo * 0.38, 220));
    frames(`${id}g`, glowFrames(0.85, 120));
    body.push(el('g', { class: uid, style: anim(`${id}h`, ev.at), ...lineAttrs }, use(pathId, { stroke: colors.glow, 'stroke-width': n(14 * th), filter: `url(#${uid}Halo)` })));
    body.push(el('g', { class: uid, style: anim(`${id}g`, ev.at), ...lineAttrs }, use(pathId, { stroke: colors.glow, 'stroke-width': n(4.6 * th), filter: `url(#${uid}Glow)` })));

    // bolt split into pieces of random length; each grows in turn, then dies on its own
    const pts = ev.points, cl = cumLen(pts), total = cl[cl.length - 1];
    const nPieces = Math.max(6, Math.min(11, Math.round(total / 60)));
    const cuts = [0];
    for (let k = 1; k < nPieces; k++) {
      const target = (total * (k + (r() - 0.5) * 0.6)) / nPieces;
      let idx = cl.findIndex((v) => v >= target);
      idx = Math.max(cuts[cuts.length - 1] + 2, Math.min(pts.length - 3, idx));
      if (idx > cuts[cuts.length - 1]) cuts.push(idx);
    }
    cuts.push(pts.length - 1);
    for (let c = 0; c < cuts.length - 1; c++) {
      const a = cuts[c], b = cuts[c + 1];
      if (b <= a) continue;
      const t0 = (G * cl[a]) / total, t1 = (G * cl[b]) / total;
      const pid = `${id}c${c}`;
      defs.push(el('path', { id: pid, d: d(pts.slice(a, b + 1)), pathLength: 100 }));
      // hold: follows the whole-bolt flicker, plus its own rare blink-outs
      const own = flick.map(([tt, v]) => [tt, r() < 0.1 ? 0 : v]);
      // dissolve: random death time, a last stutter, then gone
      const death = G + Hd + r() * F * 0.7;
      const life = 60 + r() * 120;
      frames(pid, [
        [t0 - 1, 'opacity:0;stroke-dashoffset:100'],
        [t0, `opacity:${n(pk)};stroke-dashoffset:100`],
        [t1, `opacity:${n(pk)};stroke-dashoffset:0`],
        [G + 30, 'opacity:1;stroke-dashoffset:0'],
        ...own.map(([tt, v]) => [tt, `opacity:${n(pk * v)};stroke-dashoffset:0`]),
        [death, `opacity:${n(pk * 0.9)};stroke-dashoffset:0`],
        [death + life * 0.25, `opacity:${n(pk * 0.2)};stroke-dashoffset:0`],
        [death + life * 0.45, `opacity:${n(pk * 0.75)};stroke-dashoffset:0`],
        [death + life, 'opacity:0;stroke-dashoffset:0'],
      ]);
      body.push(el('g', { class: uid, style: anim(pid, ev.at), ...lineAttrs }, [
        use(pid, { stroke: colors.main, 'stroke-width': n(1.8 * th) }),
        use(pid, { stroke: colors.core, 'stroke-width': n(0.7 * th), opacity: 0.95 }),
      ]));
    }

    // start spark
    frames(`${id}s`, [[-1, 'opacity:0'], [0, 'opacity:1'], [70 + r() * 50, 'opacity:.85'], [G + 60, 'opacity:.3'], [G + Hd, 'opacity:0']]);
    body.push(el('g', { class: uid, style: anim(`${id}s`, ev.at) }, [
      el('circle', { cx: n(ev.start[0]), cy: n(ev.start[1]), r: n(10 * th), fill: colors.glow, opacity: 0.35, filter: `url(#${uid}Glow)` }),
      el('circle', { cx: n(ev.start[0]), cy: n(ev.start[1]), r: n(1.6 * th), fill: colors.core }),
    ]));

    // branches: fire when the bolt reaches their root, die before the main bolt
    ev.branches.forEach((br, b) => {
      const bid = `${id}b${b}`;
      const t0 = G * br.at + 15 + r() * 35;
      const t1 = t0 + 90 + r() * 120;
      const death = G + r() * Hd * 0.8;
      defs.push(el('path', { id: bid, d: d(br.points), pathLength: 100 }));
      frames(bid, [
        [t0 - 1, 'opacity:0;stroke-dashoffset:100'],
        [t0, `opacity:${n(0.9 * pk)};stroke-dashoffset:100`],
        [t1, `opacity:${n(0.9 * pk)};stroke-dashoffset:0`],
        [Math.max(t1 + 20, death), `opacity:${n(0.75 * pk)};stroke-dashoffset:0`],
        [Math.max(t1 + 20, death) + 30, `opacity:${n(0.2 * pk)};stroke-dashoffset:0`],
        [Math.max(t1 + 20, death) + 55, `opacity:${n(0.6 * pk)};stroke-dashoffset:0`],
        [Math.max(t1 + 20, death) + 130, 'opacity:0;stroke-dashoffset:0'],
      ]);
      body.push(el('g', { class: uid, style: anim(bid, ev.at), ...lineAttrs }, [
        use(bid, { stroke: colors.glow, 'stroke-width': n(3 * th), opacity: 0.6, filter: `url(#${uid}Glow)` }),
        use(bid, { stroke: colors.secondary, 'stroke-width': n(1.05 * th) }),
        use(bid, { stroke: colors.core, 'stroke-width': n(0.4 * th), opacity: 0.8 }),
      ]));
    });
  });

  return { defs, css, body: el('g', { 'pointer-events': 'none' }, body) };
}
