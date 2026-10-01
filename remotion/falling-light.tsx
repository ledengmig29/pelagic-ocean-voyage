import React, {useId} from 'react';

export type LightPoint = Readonly<{x: number; y: number}>;

export type FallingLightProps = {
  /** Screen-space positions in the 1920 × 1080 composition, oldest first. */
  points: readonly LightPoint[];
  opacity?: number;
  headScale?: number;
  energy?: number;
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount;
const number = (value: number) => Number(value.toFixed(2));
const coordinates = (point: LightPoint) => `${number(point.x)} ${number(point.y)}`;
const hash = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

const tangentAt = (points: readonly LightPoint[], index: number) => {
  const before = points[Math.max(0, index - 1)];
  const after = points[Math.min(points.length - 1, index + 1)];
  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const length = Math.hypot(dx, dy) || 1;
  return {x: dx / length, y: dy / length};
};

// Catmull–Rom control points preserve the supplied camera trajectory, including
// its exact leading point; the overlapping, rounded strokes have no hard joins.
const segmentPath = (points: readonly LightPoint[], index: number) => {
  const p0 = points[Math.max(0, index - 1)];
  const p1 = points[index];
  const p2 = points[index + 1];
  const p3 = points[Math.min(points.length - 1, index + 2)];
  const c1 = {x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6};
  const c2 = {x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6};
  return `M ${coordinates(p1)} C ${coordinates(c1)} ${coordinates(c2)} ${coordinates(p2)}`;
};

/**
 * A deterministic light ribbon. All motion belongs to the caller: supplying
 * recent, projected positions keeps the falling light attached to the camera.
 */
export const FallingLight: React.FC<FallingLightProps> = ({
  points,
  opacity = 1,
  headScale = 1,
  energy = 1,
}) => {
  const id = `falling-light-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const visiblePoints = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const count = Math.min(60, visiblePoints.length);
  const samples = Array.from({length: count}, (_, index) =>
    visiblePoints[Math.round((index / Math.max(1, count - 1)) * (visiblePoints.length - 1))],
  );
  const alpha = clamp(opacity, 0, 1);
  const power = clamp(energy, 0, 2);
  const scale = Math.max(0.01, headScale);
  if (!count || alpha <= 0 || power <= 0) return null;

  const widthScale = Math.sqrt(scale) * (0.78 + power * 0.22);
  const head = samples[count - 1];
  const heading = tangentAt(samples, count - 1);
  const angle = count > 1 ? Math.atan2(heading.y, heading.x) * 180 / Math.PI : 45;
  const tail = samples.map((point, index) => {
    const t = index / Math.max(1, count - 1);
    const direction = tangentAt(samples, index);
    // A slight liquid ripple lives in the wake and vanishes at the head.
    const ripple = Math.sin(t * 15 + head.x * 0.006 + head.y * 0.009)
      * Math.sin(Math.PI * t) * 1.65 * widthScale;
    return {x: point.x - direction.y * ripple, y: point.y + direction.x * ripple};
  });
  const edgePoints = (side: number) => tail.map((point, index) => {
    const t = index / Math.max(1, count - 1);
    const direction = tangentAt(tail, index);
    const width = (0.15 + 6.5 * t ** 1.7) * widthScale;
    return {x: point.x - direction.y * width * side, y: point.y + direction.x * width * side};
  });
  const silhouette = [...edgePoints(1), ...edgePoints(-1).reverse()];
  const haloPath = silhouette.length > 2
    ? `M ${silhouette.map(coordinates).join(' L ')} Z`
    : '';
  const secondary = (side: number) => tail.map((point, index) => {
    const t = index / Math.max(1, count - 1);
    const direction = tangentAt(tail, index);
    const separation = Math.sin(Math.PI * t)
      * (3.5 + 3.2 * Math.sin(t * 9 + side * 2 + head.y * 0.007)) * widthScale * side;
    return {x: point.x - direction.y * separation, y: point.y + direction.x * separation};
  });
  const copper = secondary(1);
  const blue = secondary(-1);
  const particleCount = Math.min(30, Math.max(0, count - 1));

  return (
    <svg
      viewBox="0 0 1920 1080"
      width="1920"
      height="1080"
      aria-hidden="true"
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', opacity: alpha * Math.min(1, Math.sqrt(power))}}
    >
      <defs>
        <filter id={`${id}-wake`} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="5.5" />
        </filter>
        <radialGradient id={`${id}-aura`}>
          <stop offset="0" stopColor="#fff4c6" stopOpacity="0.55" />
          <stop offset="0.2" stopColor="#efbd5d" stopOpacity="0.22" />
          <stop offset="0.55" stopColor="#dca044" stopOpacity="0.07" />
          <stop offset="1" stopColor="#c58937" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-hot`}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#fffbea" />
          <stop offset="0.63" stopColor="#ffe7a0" stopOpacity="0.92" />
          <stop offset="1" stopColor="#edbd60" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-pearl`} x1="0" x2="1">
          <stop offset="0" stopColor="#f1bc58" stopOpacity="0" />
          <stop offset="0.6" stopColor="#fff4c9" stopOpacity="0.75" />
          <stop offset="0.92" stopColor="#fffef7" />
          <stop offset="1" stopColor="#fff2c3" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {haloPath && <path d={haloPath} fill="#efba61" opacity={0.32 * Math.min(power, 1.3)} filter={`url(#${id}-wake)`} />}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {tail.slice(0, -1).map((_, index) => {
          const t = (index + 1) / Math.max(1, count - 1);
          return (
            <g key={index} opacity={t ** 1.35}>
              <path d={segmentPath(copper, index)} stroke="#e6a64e" strokeWidth={(0.3 + t * 1.05) * widthScale} opacity="0.3" />
              <path d={segmentPath(blue, index)} stroke="#c1d6e4" strokeWidth={(0.3 + t * 0.65) * widthScale} opacity="0.18" />
              <path d={segmentPath(tail, index)} stroke="#f1c36e" strokeWidth={(0.35 + 4.25 * t ** 1.8) * widthScale} opacity="0.62" />
              <path d={segmentPath(tail, index)} stroke="#fff3c7" strokeWidth={(0.2 + 1.55 * t ** 2) * widthScale} opacity="0.93" />
            </g>
          );
        })}
      </g>

      <g>
        {Array.from({length: particleCount}, (_, index) => {
          const t = 0.07 + (index + hash(index + 9) * 0.6) / Math.max(1, particleCount) * 0.82;
          const position = t * Math.max(1, count - 1);
          const startIndex = Math.min(count - 1, Math.floor(position));
          const endIndex = Math.min(count - 1, startIndex + 1);
          const blend = position - startIndex;
          const direction = tangentAt(tail, startIndex);
          const lateral = (hash(index + 41) - 0.5) * (9 + (1 - t) * 35) * widthScale;
          const x = mix(tail[startIndex].x, tail[endIndex].x, blend) - direction.y * lateral;
          const y = mix(tail[startIndex].y, tail[endIndex].y, blend) + direction.x * lateral;
          const radius = (0.45 + hash(index + 82) * 1.05) * widthScale;
          const flicker = 0.64 + 0.36 * Math.sin(head.x * 0.014 + head.y * 0.017 + index * 2.4) ** 2;
          return (
            <ellipse
              key={index}
              cx={x}
              cy={y}
              rx={radius * (index % 5 === 0 ? 2.6 : 1.25)}
              ry={radius * 0.62}
              fill={index % 6 === 0 ? '#c5d8e8' : '#f8d891'}
              opacity={(0.1 + 0.45 * t) * flicker * Math.min(power, 1.25)}
              transform={`rotate(${Math.atan2(direction.y, direction.x) * 180 / Math.PI} ${x} ${y})`}
            />
          );
        })}
      </g>

      <g transform={`translate(${head.x} ${head.y}) rotate(${angle}) scale(${scale})`}>
        <ellipse cx="-7" rx={65 + power * 7} ry={32 + power * 3} fill={`url(#${id}-aura)`} />
        <ellipse cx="-7" rx="25" ry="10" fill={`url(#${id}-hot)`} opacity="0.7" />
        <path d="M -33 0 C -18 -1.25 -6 -3.3 0 -2.3 C 3.7 -1.3 4 0.7 0 2.1 C -8 2.8 -19 0.7 -33 0 Z" fill={`url(#${id}-pearl)`} />
        <ellipse cx="0" rx="3.7" ry="2.7" fill="#fffdf1" />
        <ellipse cx="-0.5" rx="1.6" ry="1.2" fill="#ffffff" />
      </g>
    </svg>
  );
};
