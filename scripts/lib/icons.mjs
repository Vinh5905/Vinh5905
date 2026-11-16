// Embeds a vendored logo as a nested <svg>. Works on the parsed XML tree:
//  - ids are prefixed (gradients/clipPaths of different logos never collide),
//  - colour overrides are applied to fill/stop-color/stroke attributes and to
//    the same properties inside style="" — never by replacing raw SVG text,
//  - path data is copied untouched (no lossy minification).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { el, n } from './svg.mjs';

const COLOR_PROPS = ['fill', 'stroke', 'stop-color'];
const norm = (c) => (c || '').trim().toLowerCase();


export function loadIcon(root, id, spec, { colorMap = {}, prefix, dir = 'assets/icons' }) {
  const xml = readFileSync(join(root, dir, `${id}.svg`), 'utf8');
  const docx = new DOMParser().parseFromString(xml, 'image/svg+xml');
  const svg = docx.documentElement;
  const map = Object.fromEntries(Object.entries(colorMap).map(([k, v]) => [norm(k), v]));
  const ids = new Map();
  const walk = (node, fn) => { fn(node); for (let c = node.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) walk(c, fn); };
  // pass 1: drop <title>, collect ids
  const drop = [];
  walk(svg, (e) => {
    if (e.tagName === 'title' || e.tagName === 'metadata') drop.push(e);
    const idv = e.getAttribute('id');
    if (idv) ids.set(idv, `${prefix}-${idv}`);
  });
  drop.forEach((e) => e.parentNode.removeChild(e));
  const fixRefs = (v) => v.replace(/url\(#([^)]+)\)/g, (m, ref) => (ids.has(ref) ? `url(#${ids.get(ref)})` : m))
    .replace(/^#(.+)$/, (m, ref) => (ids.has(ref) ? `#${ids.get(ref)}` : m));
  // pass 2: rewrite
  walk(svg, (e) => {
    for (const a of Array.from(e.attributes)) {
      if (a.name === 'id') e.setAttribute('id', ids.get(a.value));
      else if (a.name === 'href' || a.name === 'xlink:href' || /url\(#/.test(a.value)) e.setAttribute(a.name, fixRefs(a.value));
      if (COLOR_PROPS.includes(a.name) && map[norm(a.value)]) e.setAttribute(a.name, map[norm(a.value)]);
      if (a.name === 'style') {
        const decl = a.value.split(';').map((d) => {
          const [k, ...rest] = d.split(':');
          const v = rest.join(':');
          if (COLOR_PROPS.includes(norm(k)) && map[norm(v)]) return `${k}:${map[norm(v)]}`;
          return /url\(#/.test(v) ? `${k}:${fixRefs(v)}` : d;
        }).join(';');
        e.setAttribute('style', decl);
      }
    }
  });
  const inner = [];
  for (let c = svg.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 1) inner.push(new XMLSerializer().serializeToString(c).replace(/ xmlns(:\w+)?="[^"]*"/g, ''));
  }
  // Simple Icons ship a single black path: fill it with the brand colour
  const body = spec.color ? `<g fill="${spec.color}">${inner.join('')}</g>` : inner.join('');
  return { viewBox: svg.getAttribute('viewBox'), inner: body };
}

/**
 * Place a logo so its *drawn* box (metrics.bbox) has the same optical size as
 * the others: equal area, capped by the slot. Centred on (cx, cy).
 */
export function placeIcon(icon, metrics, { cx, cy, box, area = 0.6 }) {
  const [bx, by, bw, bh] = metrics?.bbox || icon.viewBox.split(/\s+/).map(Number);
  const s = Math.min(Math.sqrt((area * box * box) / (bw * bh)), box / Math.max(bw, bh));
  const [vx, vy, vw, vh] = (metrics?.viewBox || icon.viewBox.split(/\s+/).map(Number));
  // nested svg showing the full viewBox at scale s, shifted so bbox centre = (cx, cy)
  const x = cx - (bx + bw / 2 - vx) * s;
  const y = cy - (by + bh / 2 - vy) * s;
  return {
    // fill="#000": restore SVG's initial fill — the asset root sets fill="none", which
    // would otherwise erase logo shapes that rely on the default (Tux's body, the
    // PostgreSQL outline)
    markup: `<svg x="${n(x)}" y="${n(y)}" width="${n(vw * s)}" height="${n(vh * s)}" viewBox="${[vx, vy, vw, vh].join(' ')}" overflow="visible" fill="#000">${icon.inner}</svg>`,
    size: [bw * s, bh * s],
  };
}
