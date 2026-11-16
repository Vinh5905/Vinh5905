// One grid for every asset: full-width pieces are 760 units, paired pieces are
// 376 units (2 × 376 + the inline gap fits inside a 760px README column).
// Images are placed at these widths and only ever scale *down* (GitHub sets
// max-width:100%), so 1 unit = 1 CSS px on desktop.
export const FULL_W = 760;
export const HALF_W = 376;
export const COMPACT_W = 480; // landscape variant for narrow screens (≤ 600px)
