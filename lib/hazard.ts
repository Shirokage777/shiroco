// The hazard stripe above each option is centred and point-symmetric, so its two ends mirror
// each other. Its stripes slant like the page's top bar (down to the right). A width of
// (n + 11/7) stripe periods, n even, makes both ends a small black triangle 2/7 of a period
// tall: top right at one end, bottom left at the other.
export function hazardPeriod(width: number, target = 28): number {
  const n = Math.max(0, 2 * Math.round((width / target - 11 / 7) / 2));
  return width / (n + 11 / 7);
}
