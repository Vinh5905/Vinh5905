// Minimal SVG string builder. Every element goes through `el`, so attribute
// values are always escaped and the output structure is explicit.
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const n = (v) => (Math.round(v * 100) / 100).toString();

export const el = (tag, attrs = {}, children = []) => {
  const a = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${k}="${esc(typeof v === 'number' ? n(v) : v)}"`)
    .join('');
  const kids = (Array.isArray(children) ? children : [children]).flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false);
  return kids.length ? `<${tag}${a}>${kids.join('')}</${tag}>` : `<${tag}${a}/>`;
};
export const raw = (s) => s; // marks pre-built markup
export const pts = (list) => list.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
export const pathOf = (list, close = true) => 'M' + list.map(([x, y]) => `${n(x)} ${n(y)}`).join('L') + (close ? 'Z' : '');

/** Root document. `title`/`desc` give the image an accessible name inside the SVG too. */
export const doc = ({ width, height, title, desc, css = '', defs = [], body = [] }) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  el('svg', {
    xmlns: 'http://www.w3.org/2000/svg', 'xmlns:xlink': 'http://www.w3.org/1999/xlink',
    width, height, viewBox: `0 0 ${n(width)} ${n(height)}`,
    role: 'img', 'aria-labelledby': 'title desc', fill: 'none',
  }, [
    el('title', { id: 'title' }, esc(title)),
    el('desc', { id: 'desc' }, esc(desc)),
    css ? `<style>${css}</style>` : null,
    defs.length ? el('defs', {}, defs) : null,
    body,
  ]) + '\n';
