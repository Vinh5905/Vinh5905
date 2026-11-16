// Fonts are downloaded from a pinned google/fonts commit into .cache/fonts and
// verified by SHA-256. Text is converted to outlines at build time, so the SVGs
// never depend on fonts installed on the viewer's machine.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import opentype from 'opentype.js';

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export async function loadFonts(root) {
  const { fonts } = JSON.parse(readFileSync(join(root, 'config/sources.json'), 'utf8'));
  const dir = join(root, '.cache/fonts');
  mkdirSync(dir, { recursive: true });
  const out = {};
  for (const [weight, { url, sha256: want }] of Object.entries(fonts.files)) {
    const file = join(dir, basename(new URL(url).pathname));
    let buf = existsSync(file) ? readFileSync(file) : null;
    if (!buf || sha256(buf) !== want) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`font download failed ${res.status}: ${url}`);
      buf = Buffer.from(await res.arrayBuffer());
      if (sha256(buf) !== want) throw new Error(`font checksum mismatch: ${url}`);
      writeFileSync(file, buf);
    }
    out[weight] = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return out;
}

// Own serializer: opentype.js' toPathData() "optimize" step mangles some
// contours at certain sizes/positions, so commands are written verbatim.
const f2 = (v) => (Math.round(v * 100) / 100).toString();
export function serialize(cmds) {
  let out = '';
  for (const c of cmds) {
    if (c.type === 'M' || c.type === 'L') out += `${c.type}${f2(c.x)} ${f2(c.y)}`;
    else if (c.type === 'Q') out += `Q${f2(c.x1)} ${f2(c.y1)} ${f2(c.x)} ${f2(c.y)}`;
    else if (c.type === 'C') out += `C${f2(c.x1)} ${f2(c.y1)} ${f2(c.x2)} ${f2(c.y2)} ${f2(c.x)} ${f2(c.y)}`;
    else if (c.type === 'Z') out += 'Z';
  }
  return out;
}

/**
 * Text → outline path. Returns { d, width }. `anchor` is start|middle|end.
 * `tracking` is extra letter spacing in em.
 */
export function textPath(font, text, { x = 0, y = 0, size = 16, anchor = 'start', tracking = 0 } = {}) {
  const glyphs = font.stringToGlyphs(text);
  const missing = glyphs.filter((g) => g.index === 0).length;
  if (missing) throw new Error(`font is missing ${missing} glyph(s) for "${text}"`);
  const scale = size / font.unitsPerEm;
  let adv = 0;
  const parts = [];
  glyphs.forEach((g, i) => {
    parts.push({ g, at: adv });
    adv += g.advanceWidth * scale + tracking * size;
    if (i < glyphs.length - 1 && !tracking) adv += font.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  const width = adv - (glyphs.length ? tracking * size : 0);
  const x0 = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const d = parts.map(({ g, at }) => serialize(g.getPath(x0 + at, y, size).commands)).join('');
  return { d, width, x0 };
}

export const measure = (font, text, size, tracking = 0) => textPath(font, text, { size, tracking }).width;
