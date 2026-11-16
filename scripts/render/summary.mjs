// Summary strip (after the tech stack): total contributions · current streak ·
// longest streak, computed with the github-readme-streak-stats rules
// (lib/streak.mjs). Own visual language: numbers roll in like an odometer, the
// current streak sits in an emerald ring whose arc shows current ÷ longest,
// a small flame flickers at the gap of the ring.
import { el, n, doc } from '../lib/svg.mjs';
import { textPath, serialize } from '../lib/fonts.mjs';
import { css } from '../lib/motion.mjs';
import { FULL_W } from '../lib/layout.mjs';

export const SUMMARY_COMPACT_W = 360;
// outer contour of Octicons flame-16 (MIT), filled
const FLAME = 'M9.533.753V.752c.217 2.385 1.463 3.626 2.653 4.81C13.37 6.74 14.498 7.863 14.498 10c0 3.5-3 6-6.5 6S1.5 13.512 1.5 10c0-1.298.536-2.56 1.425-3.286.376-.308.862 0 1.035.454C4.46 8.487 5.581 8.419 6 8c.282-.282.341-.811-.003-1.5C4.34 3.187 7.035.75 8.77.146c.39-.137.726.194.763.607Z';

let uid = 0;
/** Number as outlines; when animated each digit is a 0–9 column rolling up into place. */
function odometer(font, text, { cx, y, size, fill, animated, delay = 0 }) {
  const scale = size / font.unitsPerEm;
  const glyph = (ch) => font.charToGlyph(ch);
  const adv = (ch) => glyph(ch).advanceWidth * scale;
  const width = [...text].reduce((s, ch) => s + adv(ch), 0);
  let x = cx - width / 2;
  const id = `odo${uid++}`;
  const pitch = size * 1.12;
  const cols = [];
  [...text].forEach((ch, i) => {
    const a = adv(ch);
    const mid = x + a / 2;
    if (animated && /\d/.test(ch)) {
      const dv = Number(ch);
      const digits = Array.from({ length: 10 }, (_, k) => {
        const g = glyph(String(k));
        return serialize(g.getPath(mid - (g.advanceWidth * scale) / 2, y + (k - dv) * pitch, size).commands);
      });
      cols.push(el('g', { class: 'odo', style: `--dy:${n(dv * pitch)}px;animation-delay:${delay + (text.length - i) * 90}ms` },
        el('path', { d: digits.join(''), fill })));
    } else {
      cols.push(el('path', { d: serialize(glyph(ch).getPath(x, y, size).commands), fill }));
    }
    x += a;
  });
  const clip = animated
    ? el('clipPath', { id }, el('rect', { x: n(cx - width / 2 - 6), y: n(y - size * 0.98), width: n(width + 12), height: n(size * 1.24) }))
    : null;
  return { markup: el('g', { 'clip-path': animated ? `url(#${id})` : undefined }, cols), defs: clip ? [clip] : [] };
}

const range = (a, b, present) => (b === present ? `${a} 〜 ${b}` : a === b ? a : `${a} 〜 ${b}`);

export function renderSummary({ streak, t, mode, fonts, labels, motion, animated, compact = false }) {
  uid = 0;
  const W = compact ? SUMMARY_COMPACT_W : FULL_W;
  const fmt = (v) => v.toLocaleString('en-US');
  const defs = [];
  const parts = [];

  // geometry
  const L = compact
    ? { ring: [180, 92], R: 54, ringNum: 38, ringLab: 182, ringDate: 204, side: [[90, 282], [270, 282]], sideNum: 34, H: 352, vline: [[180, 240, 336]] }
    : { ring: [380, 100], R: 58, ringNum: 40, ringLab: 194, ringDate: 218, side: [[127, 116], [633, 116]], sideNum: 44, H: 238, vline: [[253, 44, 200], [507, 44, 200]] };

  // ---- side columns: total, longest
  const side = (i, num, label, dates, delay) => {
    const [cx, y] = L.side[i];
    const o = odometer(fonts.bold, num, { cx, y, size: L.sideNum, fill: t.ink, animated, delay });
    defs.push(...o.defs);
    const lab = textPath(fonts.medium, label, { x: cx, y: y + (compact ? 26 : 32), size: compact ? 14 : 15, anchor: 'middle' });
    const dt = textPath(fonts.medium, dates, { x: cx, y: y + (compact ? 48 : 58), size: compact ? 12 : 13, anchor: 'middle' });
    return el('g', { class: animated ? 'col' : undefined, style: animated ? `animation-delay:${delay}ms` : undefined },
      [o.markup, el('path', { d: lab.d, fill: t.ink2 }), el('path', { d: dt.d, fill: t.ink3 })]);
  };
  const s = streak;
  parts.push(side(0, fmt(s.total), labels.totalContributions, `${s.firstContribution || s.today} 〜 ${labels.present}`, 100));
  parts.push(side(1, fmt(s.longest.length), labels.longestStreak, s.longest.length ? range(s.longest.start, s.longest.end) : s.today, 260));

  // ---- hairlines (fade at both ends)
  defs.push(el('linearGradient', { id: 'vfade', x1: 0, y1: 0, x2: 0, y2: 1 }, [
    el('stop', { offset: 0, 'stop-color': t.hairline, 'stop-opacity': 0 }),
    el('stop', { offset: 0.5, 'stop-color': mode === 'dark' ? '#3A4D44' : '#C9D8CF', 'stop-opacity': 1 }),
    el('stop', { offset: 1, 'stop-color': t.hairline, 'stop-opacity': 0 }),
  ]));
  for (const [x, y0, y1] of L.vline)
    parts.push(el('rect', { x: n(x - 0.6), y: y0, width: 1.2, height: y1 - y0, fill: 'url(#vfade)', class: animated ? 'grow' : undefined }));

  // ---- centre: ring with depth, progress arc = current / longest
  const [rx, ry] = L.ring, R = L.R, SW = 7;
  const gapDeg = 26;
  const pt = (deg) => [rx + R * Math.cos(((deg - 90) * Math.PI) / 180), ry + R * Math.sin(((deg - 90) * Math.PI) / 180)];
  const arc = (d0, d1, dy = 0) => {
    const [x0, y0] = pt(d0), [x1, y1] = pt(d1);
    return `M${n(x0)} ${n(y0 + dy)}A${R} ${R} 0 ${d1 - d0 > 180 ? 1 : 0} 1 ${n(x1)} ${n(y1 + dy)}`;
  };
  const a0 = gapDeg, a1 = 360 - gapDeg;
  const frac = s.longest.length ? Math.min(1, s.current.length / s.longest.length) : 0;
  const track = mode === 'dark' ? '#1F2B26' : '#E3ECE6';
  const edge = mode === 'dark' ? '#0B110E' : '#CFDDD5';
  parts.push(el('path', { d: arc(a0, a1, 5), stroke: edge, 'stroke-width': SW, 'stroke-linecap': 'round' }));  // coin edge
  parts.push(el('path', { d: arc(a0, a1), stroke: track, 'stroke-width': SW, 'stroke-linecap': 'round' }));
  if (frac > 0) {
    defs.push(el('linearGradient', { id: 'ringg', x1: 0, y1: 0, x2: 1, y2: 1 }, [
      el('stop', { offset: 0, 'stop-color': t.levels[2] }),
      el('stop', { offset: 1, 'stop-color': t.accent }),
    ]));
    parts.push(el('path', { d: arc(a0, a0 + (a1 - a0) * frac), stroke: 'url(#ringg)', 'stroke-width': SW, 'stroke-linecap': 'round', pathLength: 100, class: animated ? 'arc' : undefined }));
  }
  // flame in the gap
  const fs = compact ? 1.5 : 1.65;
  defs.push(el('linearGradient', { id: 'flameg', x1: 0, y1: 1, x2: 0, y2: 0 }, [
    el('stop', { offset: 0, 'stop-color': t.accent }),
    el('stop', { offset: 1, 'stop-color': t.levels[2] }),
  ]));
  parts.push(el('g', { transform: `translate(${n(rx - 8 * fs)} ${n(ry - R - 10.5 * fs)}) scale(${fs})` },
    el('path', { d: FLAME, fill: 'url(#flameg)', class: animated ? 'flame' : undefined })));
  const o = odometer(fonts.bold, fmt(s.current.length), { cx: rx, y: ry + L.ringNum * 0.36, size: L.ringNum, fill: t.ink, animated, delay: 180 });
  defs.push(...o.defs);
  parts.push(o.markup);
  const lab = textPath(fonts.semibold, labels.currentStreak, { x: rx, y: L.ringLab, size: compact ? 15 : 16, anchor: 'middle' });
  const dt = textPath(fonts.medium, s.current.length ? range(s.current.start, s.current.end) : s.today, { x: rx, y: L.ringDate, size: compact ? 12 : 13, anchor: 'middle' });
  parts.push(el('g', { class: animated ? 'col' : undefined, style: animated ? 'animation-delay:180ms' : undefined },
    [el('path', { d: lab.d, fill: t.accent }), el('path', { d: dt.d, fill: t.ink3 })]));

  const style = css(animated, [
    `.odo{animation:odo 1300ms ${motion.ease} both}`,
    `@keyframes odo{from{transform:translateY(var(--dy))}}`,
    `.col{animation:col 700ms ${motion.ease} both}`,
    `@keyframes col{from{opacity:0;transform:translateY(8px)}}`,
    `.grow{transform-box:fill-box;transform-origin:center;animation:grow 900ms ${motion.ease} 200ms both}`,
    `@keyframes grow{from{transform:scaleY(0)}}`,
    `.arc{stroke-dasharray:100 100;animation:arc 1400ms ${motion.ease} 350ms both}`,
    `@keyframes arc{from{stroke-dashoffset:100}}`,
    `.flame{transform-box:fill-box;transform-origin:50% 100%;animation:flick 2.6s ease-in-out infinite}`,
    `@keyframes flick{0%,100%{transform:scale(1,1)}35%{transform:scale(.95,1.06)}70%{transform:scale(1.03,.97)}}`,
  ]);

  return doc({
    width: W, height: L.H,
    title: `${labels.totalContributions} ${s.total} (${s.firstContribution} 〜). ${labels.currentStreak} ${s.current.length}. ${labels.longestStreak} ${s.longest.length} (${s.longest.start} 〜 ${s.longest.end}).`,
    desc: 'All-time contribution total and contribution streaks, computed with the github-readme-streak-stats rules.',
    css: style, defs, body: parts,
  });
}
