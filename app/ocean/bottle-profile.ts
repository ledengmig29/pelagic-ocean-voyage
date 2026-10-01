/** The bottle, its liquid volume, and the ocean cutout share this axial profile. */
export const BOTTLE_CENTER_Y = 8;
export const BOTTLE_WATER_LEVEL = 8.5;

/** [axial x, radius]. Kept identical to the original hand-blown glass shell. */
export const BOTTLE_OUTER_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [-49.2, 0], [-49.2, 14], [-48.7, 22], [-47.3, 25.8], [-44.6, 27.9],
  [-40, 28.8], [-33, 29], [-20, 29.1], [0, 29], [24, 28.9],
  [31, 28.45], [38, 27.15], [43, 24.5], [47, 20.5], [50.7, 15],
  [53, 11.4], [55.5, 10.55], [62.7, 10.5], [63.5, 11.2],
  [64.4, 11.6], [65.7, 11.6], [66.5, 10.9], [66.5, 10],
];

/** Interior ends at the inside face of the cork, with 0.42 units of glass. */
export const BOTTLE_INNER_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [-48.55, 21.7], [-47.15, 25.38], [-44.45, 27.48], [-39.95, 28.38],
  [-33, 28.58], [-20, 28.68], [0, 28.58], [24, 28.48],
  [31, 28.03], [38, 26.73], [43, 24.08], [47, 20.08],
  [50.7, 14.58], [53, 10.98], [55.5, 10.13], [62.7, 10.08],
  [63.5, 10.78], [64.45, 10.9],
];

export function bottleInnerRadiusAt(x: number): number {
  if (x < BOTTLE_INNER_PROFILE[0][0] || x > BOTTLE_INNER_PROFILE[BOTTLE_INNER_PROFILE.length - 1][0]) return 0;
  for (let i = 1; i < BOTTLE_INNER_PROFILE.length; i++) {
    const [bX, bR] = BOTTLE_INNER_PROFILE[i];
    if (x <= bX) {
      const [aX, aR] = BOTTLE_INNER_PROFILE[i - 1];
      return aR + (bR - aR) * (x - aX) / (bX - aX);
    }
  }
  return BOTTLE_INNER_PROFILE[BOTTLE_INNER_PROFILE.length - 1][1];
}

const glslFloat = (value: number) => Number.isInteger(value) ? `${value}.0` : `${value}`;

/** Insert in the ocean shader so the surface meets the volume without a gap. */
export const bottleInnerRadiusAtGLSL = `
float bottleInnerRadiusAt(float x) {
  if (x < ${glslFloat(BOTTLE_INNER_PROFILE[0][0])} || x > ${glslFloat(BOTTLE_INNER_PROFILE[BOTTLE_INNER_PROFILE.length - 1][0])}) return 0.0;
  ${BOTTLE_INNER_PROFILE.slice(1).map(([x, radius], i) => {
    const [previousX, previousRadius] = BOTTLE_INNER_PROFILE[i];
    return `if (x <= ${glslFloat(x)}) return mix(${glslFloat(previousRadius)}, ${glslFloat(radius)}, (x - (${glslFloat(previousX)})) / ${glslFloat(x - previousX)});`;
  }).join("\n  ")}
  return ${glslFloat(BOTTLE_INNER_PROFILE[BOTTLE_INNER_PROFILE.length - 1][1])};
}
`;
