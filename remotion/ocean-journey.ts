export const OCEAN_FPS = 30;
export const OCEAN_SECONDS = 36;
export const OCEAN_DURATION = OCEAN_FPS * OCEAN_SECONDS;

/** The film and HyperFrames composition seek through the same scroll narrative. */
export function oceanProgressAt(seconds: number): number {
  const points = [[0, 0], [9, .28], [10, .30], [22, .60], [23, .62], [32, .90], [36, 1]];
  const time = Math.max(0, Math.min(OCEAN_SECONDS, seconds));
  for (let i = 1; i < points.length; i++) {
    const [end, progress] = points[i];
    const [start, previous] = points[i - 1];
    if (time <= end) return previous + (progress - previous) * (time - start) / (end - start);
  }
  return 1;
}
