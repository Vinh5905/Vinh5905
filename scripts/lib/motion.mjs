// Motion is plain CSS inside each SVG. Every animated property is declared only
// in a `from` keyframe, so the element's resting style IS the final, true state:
// if animations do not run (static file, reduced motion, an image proxy that
// strips CSS animation) the picture still shows the exact data.
export const reduced = `@media (prefers-reduced-motion: reduce){*{animation:none!important}}`;
export const css = (animated, rules) => (animated ? rules.join('') + reduced : '');
