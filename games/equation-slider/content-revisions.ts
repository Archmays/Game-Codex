/** Only these authored boards changed. Kept levels 01 and 11 have no revision. */
export const EQUATION_SLIDER_CONTENT_REVISIONS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map((order) => [
    `es-1-${String(order).padStart(2, "0")}`,
    "slider-pilot-12-r1"
  ]))
);
