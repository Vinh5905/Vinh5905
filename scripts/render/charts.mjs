// Language donut + activity radar in one image. Full: donut block flush left,
// radar block flush right, with a clear gutter. Compact (phones): stacked.
import { el, doc } from '../lib/svg.mjs';
import { css } from '../lib/motion.mjs';
import { FULL_W } from '../lib/layout.mjs';
import { buildLanguages } from './languages.mjs';
import { buildActivity } from './activity.mjs';

const CW = 350; // content width of each chart block
export const CHARTS_COMPACT_W = 360;

export function renderCharts(ctx) {
  const compact = !!ctx.compact;
  const a = buildLanguages({ ...ctx, cw: CW });
  const compactLayout = !!ctx.compact;
  const b = buildActivity({ ...ctx, cw: CW, ox: compactLayout ? 0 : FULL_W - CW, oy: compactLayout ? a.height + 24 : 0 });
  const W = compact ? CHARTS_COMPACT_W : FULL_W;
  const gap = 24;
  const H = compact ? a.height + gap + b.height : Math.max(a.height, b.height);
  return doc({
    width: W, height: H,
    title: `${a.summary}. ${b.summary}.`,
    desc: 'Commits of the past year by repository primary language (donut), and contribution types of the past year on a log scale (radar).',
    css: css(ctx.animated, [...a.css, ...b.css]),
    defs: [...a.defs, ...b.defs],
    body: [
      el('g', {}, a.body),
      el('g', {}, b.body),
    ],
  });
}
