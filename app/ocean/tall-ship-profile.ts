/** Shared, DOM-free description of the closed white training-ship hull. */
export const TALL_SHIP_LENGTH = 56;
export const TALL_SHIP_BEAM = 8;
export const TALL_SHIP_MIN_X = -28;
export const TALL_SHIP_MAX_X = 28;
export const TALL_SHIP_KEEL_Y = -3.2;
export const TALL_SHIP_STATIONS: ReadonlyArray<readonly [number, number]> = [
  [-28, 0], [-27.2, 1.25], [-25.5, 2.25], [-22, 3.12], [-17, 3.7],
  [-10, 3.94], [0, 4], [9, 3.75], [17, 3.04], [23, 1.77], [26.5, .55], [28, 0],
];

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smooth = (a: number, b: number, value: number) => {
  const t = clamp((value - a) / (b - a), 0, 1); return t * t * (3 - 2 * t);
};

export function tallShipHalfBeam(x: number) {
  if (x < TALL_SHIP_MIN_X || x > TALL_SHIP_MAX_X) return 0;
  for (let i = 1; i < TALL_SHIP_STATIONS.length; i++) {
    const [right, width] = TALL_SHIP_STATIONS[i], [left, previous] = TALL_SHIP_STATIONS[i - 1];
    if (x <= right) return previous + (width - previous) * (x - left) / (right - left);
  }
  return 0;
}

export function tallShipDeckHeight(x: number) {
  return 2.35 + .9 * smooth(19, 28, -x) + .75 * smooth(20, 28, x);
}

export function tallShipHalfWidthAtHeight(x: number, y: number) {
  if (y < TALL_SHIP_KEEL_Y || x < -28 || x > 28) return 0;
  const q = clamp((y + 3.2) / (tallShipDeckHeight(x) + 3.2), 0, 1);
  // The counter stern recedes below the rail; the bow also rakes inward at the keel.
  const cutback = Math.pow(1 - q, .7) * (2.2 * smooth(18, 28, -x) + .9 * smooth(18, 28, x));
  return Math.max(0, tallShipHalfBeam(x) * (.08 + .92 * Math.pow(q, .27)) - cutback);
}

// The shader receives the same station list and equations, not a fitted ellipse.
const f = (n: number) => Number.isInteger(n) ? `${n}.0` : String(n);
export const TALL_SHIP_PROFILE_GLSL = `
float tallShipHalfBeam(float x) {
  if (x < -28.0 || x > 28.0) return 0.0;
  ${TALL_SHIP_STATIONS.slice(1).map(([x, width], i) => {
    const [left, previous] = TALL_SHIP_STATIONS[i];
    return `if (x <= ${f(x)}) return mix(${f(previous)}, ${f(width)}, (x - (${f(left)})) / ${f(x - left)});`;
  }).join("\n  ")}
  return 0.0;
}
float tallShipDeckHeight(float x) {
  return 2.35 + 0.9 * smoothstep(19.0,28.0,-x) + 0.75 * smoothstep(20.0,28.0,x);
}
float tallShipHalfWidthAtHeight(float x, float y) {
  if (y < -3.2 || x < -28.0 || x > 28.0) return 0.0;
  float q = clamp((y + 3.2) / (tallShipDeckHeight(x) + 3.2), 0.0, 1.0);
  float cutback = pow(1.0-q,0.7) * (2.2*smoothstep(18.0,28.0,-x)+0.9*smoothstep(18.0,28.0,x));
  return max(0.0,tallShipHalfBeam(x)*(0.08+0.92*pow(q,0.27))-cutback);
}
`;

export const tallShipHullGLSL = TALL_SHIP_PROFILE_GLSL;
