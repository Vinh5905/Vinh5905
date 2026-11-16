// Random green lightning, baked into an SVG with CSS keyframes.
//
// Look & motion modelled on a travelling electric arc: a long, finely
// crackled path; a bright head runs along it while the tail breaks up into
// shrinking fragments behind it, so a discharge "travels" for ~0.7–1.8 s
// instead of popping in and out. A wide soft halo lights the background.
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
  //        path length px    life ms       branches  grow share of life      peak  halo
  subtle: { len: [260, 420], dur: [950, 1300], br: [0, 1], brP: 0.35, grow: [0.3, 0.4], peak: 0.88, halo: 0.6 },
  medium: { len: [400, 620], dur: [1250, 1700], br: [1, 2], brP: 1, grow: [0.32, 0.42], peak: 0.95, halo: 0.8 },
  strong: { len: [560, 900], dur: [1600, 2300], br: [2, 4], brP: 1, grow: [0.35, 0.45], peak: 1, halo: 1 },
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
  while (t < loopMs - 2400) {
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
        travel: Math.round(R(...K.dur) * Math.sqrt(size) * (cfg.speed ? 1 / cfg.speed : 1)),
        grow: R(...K.grow),
        peak: K.peak * R(0.85, 1),
        halo: K.halo * (cfg.glow ?? 1) * R(0.8, 1.1),
        seed: rnd(),
      };
    }
    if (made) { events.push(made); prev = made; }
    t += (made?.travel ?? 0) + (rnd() < cfg.doubleChance ? R(0.12, 0.35) * 1000 : R(...cfg.gapSeconds) * 1000);
  }
  return { events, loopMs };
}

/**
 * Travelling dash pattern (units: % of path length, pathLength=100):
 *   tail fragments (tiny dashes, wide gaps → larger dashes, small gaps)
 *   then the solid head, then a long gap so the pattern never repeats.
 * Animating stroke-dashoffset from +span to -100 moves the whole thing along
 * the path: head first, the crumbling tail following it out.
 */
function travelPattern(head, r) {
  const frags = [];
  let tail = 0;
  const count = 14 + Math.floor(r() * 8);
  for (let i = 0; i < count; i++) {
    const f = (i + 1) / count; // 0 = far back … 1 = next to the head
    const dash = 0.12 + f * f * 2.4 + r() * 0.5;
    const gap = 0.3 + (1 - f) * 1.9 + r() * 0.8;
    frags.push(n(dash), n(gap));
    tail += dash + gap;
  }
  const span = tail + head;
  return { dasharray: `${frags.join(' ')} ${n(head)} 600`, span };
}

export function renderLightning({ events, loopMs }, colors, { width, height, uid = 'lt', thickness = 1 }) {
  const pct = (ms) => `${((Math.max(0, ms) / loopMs) * 100).toFixed(3)}%`;
  const d = (pts) => 'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L');
  const css = [`.${uid}{opacity:0}`];
  const frames = (name, list) => css.push(`@keyframes ${name}{${list.map(([ms, decl]) => `${pct(ms)}{${decl}}`).join('')}100%{opacity:0}}`);
  const anim = (name, start) => `animation:${name} ${loopMs}ms linear ${start}ms infinite`;
  const th = thickness;
  const defs = [
    el('filter', { id: `${uid}Glow`, filterUnits: 'userSpaceOnUse', x: 0, y: 0, width, height }, el('feGaussianBlur', { stdDeviation: 2.4 })),
    el('filter', { id: `${uid}Halo`, filterUnits: 'userSpaceOnUse', x: 0, y: 0, width, height }, el('feGaussianBlur', { stdDeviation: 11 })),
  ];
  const body = [];

  events.forEach((ev, i) => {
    const id = `${uid}${i}`;
    const r = mulberry32(Math.floor(ev.seed * 1e9));
    const T = ev.travel;
    const pat = travelPattern(100, r); // solid part = whole path: grow fully, then crumble from the start
    defs.push(el('path', { id: `${id}p`, d: d(ev.points), pathLength: 100 }));

    // dash travel + irregular flicker of the whole discharge
    // front of the bolt: 0 → end of path during the fast grow (Tg), then the
    // crumbling tail sweeps through it until the whole pattern has left (T)
    const Tg = T * ev.grow;
    const offsetAt = (tt) => tt <= Tg
      ? pat.span - (100 * tt) / Tg
      : pat.span - 100 - ((pat.span) * (tt - Tg)) / (T - Tg);
    const flick = [];
    for (let tt = 30; tt < T - 30; tt += 30 + r() * 60) {
      const v = r() < 0.07 ? 0.3 : r() < 0.3 ? 0.68 + r() * 0.2 : 0.9 + r() * 0.1;
      flick.push([tt, v]);
    }
    if (!flick.some(([tt]) => Math.abs(tt - Tg) < 15)) flick.push([Tg, 1]);
    flick.sort((a, b) => a[0] - b[0]);
    const travelFrames = (opMul, extra = 0) => [
      [-1, `opacity:0;stroke-dashoffset:${n(pat.span)}`],
      [0, `opacity:${n(opMul * ev.peak)};stroke-dashoffset:${n(pat.span)}`],
      ...flick.map(([tt, v]) => [tt, `opacity:${n(Math.min(1, opMul * ev.peak * v))};stroke-dashoffset:${n(offsetAt(tt))}`]),
      [T, `opacity:${n(opMul * ev.peak * 0.7)};stroke-dashoffset:-100`],
      [T + extra, 'opacity:0;stroke-dashoffset:-100'],
    ];
    frames(`${id}t`, travelFrames(1));
    frames(`${id}h`, travelFrames(ev.halo, 120)); // halo lingers a touch longer
    const use = (attrs) => el('use', { href: `#${id}p`, 'xlink:href': `#${id}p`, ...attrs });
    const common = { 'stroke-dasharray': pat.dasharray, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' };
    // wide ambient halo (lights the background), glow, mint bolt, white core
    body.push(el('g', { class: uid, style: anim(`${id}h`, ev.at), ...common }, [
      use({ stroke: colors.glow, 'stroke-width': n(14 * th), opacity: 0.38, filter: `url(#${uid}Halo)` }),
    ]));
    body.push(el('g', { class: uid, style: anim(`${id}t`, ev.at), ...common }, [
      use({ stroke: colors.glow, 'stroke-width': n(4.6 * th), opacity: 0.85, filter: `url(#${uid}Glow)` }),
      use({ stroke: colors.main, 'stroke-width': n(1.8 * th) }),
      use({ stroke: colors.core, 'stroke-width': n(0.7 * th), opacity: 0.95 }),
    ]));

    // start spark
    frames(`${id}s`, [[-1, 'opacity:0'], [0, 'opacity:1'], [60 + r() * 60, 'opacity:.8'], [Math.min(T * 0.4, 260), 'opacity:0']]);
    body.push(el('g', { class: uid, style: anim(`${id}s`, ev.at) }, [
      el('circle', { cx: n(ev.start[0]), cy: n(ev.start[1]), r: n(10 * th), fill: colors.glow, opacity: 0.35, filter: `url(#${uid}Glow)` }),
      el('circle', { cx: n(ev.start[0]), cy: n(ev.start[1]), r: n(1.6 * th), fill: colors.core }),
    ]));

    // branches: short arcs fired when the head passes their root
    ev.branches.forEach((br, b) => {
      const bp = travelPattern(46 + r() * 10, r);
      const t0 = T * br.at * 0.9 + 20 + r() * 40;
      const bt = 180 + r() * 220;
      const bid = `${id}b${b}`;
      defs.push(el('path', { id: `${bid}p`, d: d(br.points), pathLength: 100 }));
      frames(bid, [
        [t0 - 1, `opacity:0;stroke-dashoffset:${n(bp.span)}`],
        [t0, `opacity:${n(0.85 * ev.peak)};stroke-dashoffset:${n(bp.span)}`],
        [t0 + bt * 0.5, `opacity:${n(0.6 * ev.peak)};stroke-dashoffset:${n(bp.span - (100 + bp.span) * 0.5)}`],
        [t0 + bt, 'opacity:0;stroke-dashoffset:-100'],
      ]);
      body.push(el('g', { class: uid, style: anim(bid, ev.at), 'stroke-dasharray': bp.dasharray, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }, [
        el('use', { href: `#${bid}p`, 'xlink:href': `#${bid}p`, stroke: colors.glow, 'stroke-width': n(3 * th), opacity: 0.6, filter: `url(#${uid}Glow)` }),
        el('use', { href: `#${bid}p`, 'xlink:href': `#${bid}p`, stroke: colors.secondary, 'stroke-width': n(1.05 * th) }),
        el('use', { href: `#${bid}p`, 'xlink:href': `#${bid}p`, stroke: colors.core, 'stroke-width': n(0.4 * th), opacity: 0.8 }),
      ]));
    });
  });

  return { defs, css, body: el('g', { 'pointer-events': 'none' }, body) };
}
