import { Easing, interpolate } from "remotion";

export type Point = { x: number; y: number };
export const STARRY_FPS = 30;
export const STARRY_DURATION = 42 * STARRY_FPS;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const blend = (frame: number, from: number, to: number) => interpolate(frame, [from, to], [0, 1], {
  ...clamp, easing: Easing.inOut(Easing.cubic),
});
const track = (frame: number, times: number[], values: number[]) => interpolate(frame, times, values, {
  ...clamp, easing: Easing.inOut(Easing.cubic),
});

const cubic = (a: Point, b: Point, c: Point, d: Point, t: number): Point => {
  const s = 1 - t;
  return { x: s ** 3 * a.x + 3 * s * s * t * b.x + 3 * s * t * t * c.x + t ** 3 * d.x,
    y: s ** 3 * a.y + 3 * s * s * t * b.y + 3 * s * t * t * c.y + t ** 3 * d.y };
};

/** One continuous curve, shared by the light on both sides of the window plane. */
export function lightPosition(frame: number): Point {
  const t = interpolate(frame, [32, 440], [0, 1], clamp);
  if (frame <= 440) return cubic({x: 1266, y: 148}, {x: 1435, y: 405}, {x: 560, y: 525}, {x: 1170, y: 785}, t);
  const u = 1 - Math.pow(1 - interpolate(frame, [440, 535], [0, 1], clamp), 2);
  // Match the incoming velocity after accounting for the second curve's easing.
  return cubic({x: 1170, y: 785}, {x: 1241.0171568627, y: 815.2696078431}, {x: 1390, y: 928}, {x: 1480, y: 934}, u);
}

export function journey(frame: number) {
  const cameraTimes = [0, 180, 390, 560, 840, 894, 972, STARRY_DURATION - 1];
  // The original painting remains the same layer throughout the entire journey.
  const scale = track(frame, cameraTimes, [1.45, 1.38, 1.20, 1.14, .571, .571, .534, .534]);
  const x = track(frame, cameraTimes, [-437, -370, -295, -251, 412, 412, 793, 793]);
  const y = track(frame, cameraTimes, [-42, -116, -90, -73, 105, 105, 125, 125]);
  const roomScale = track(frame, [0, 145, 245, 390, 548], [3.8, 3.6, 2.12, 1, 1]);
  const roomOpacity = 1 - blend(frame, 567, 758);
  const crossing = blend(frame, 398, 432);
  const lightOpacity = blend(frame, 0, 36) * (1 - blend(frame, 536, 580));
  const tailLength = interpolate(frame, [0, 70, 360, 495, 550], [4, 90, 100, 60, 12], clamp);
  const points = Array.from({ length: 54 }, (_, i) => lightPosition(Math.max(0, frame - tailLength * (1 - i / 53))));
  return {
    x, y, scale, roomScale, roomOpacity, crossing, lightOpacity, points,
    head: lightPosition(frame),
    headScale: track(frame, [0, 250, 410, 490, 560], [.5, .85, 1.3, 1.75, .15]),
    energy: .90 + .12 * Math.sin(frame * .046),
    settledGlow: blend(frame, 443, 490) * (1 - blend(frame, 545, 641)),
    reveal: blend(frame, 567, 840),
    information: blend(frame, 968, 1014),
  };
}
