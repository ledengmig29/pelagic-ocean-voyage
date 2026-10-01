import * as THREE from "three";
import { BOTTLE_CENTER_Y, bottleInnerRadiusAtGLSL } from "./bottle-profile";
import { tallShipHullGLSL } from "./tall-ship-profile";

export type OceanWave = {
  wavelength: number;
  amplitude: number;
  /** Unit direction on the world X/Z plane. */
  direction: readonly [number, number];
  steepness: number;
  phase: number;
};

const direction = (degrees: number): readonly [number, number] => {
  const angle = (degrees * Math.PI) / 180;
  return [Math.cos(angle), Math.sin(angle)];
};

/** Deep-water dispersion: omega² = g k. Sum of horizontal steepness stays below 1. */
export const OCEAN_WAVES: readonly OceanWave[] = [
  { wavelength: 140, amplitude: 1.80, direction: direction(14), steepness: 0.70, phase: 0.6 },
  { wavelength: 110, amplitude: 1.32, direction: direction(-23), steepness: 0.72, phase: 2.2 },
  { wavelength: 90, amplitude: 1.00, direction: direction(37), steepness: 0.76, phase: 4.3 },
  { wavelength: 70, amplitude: 0.74, direction: direction(-7), steepness: 0.74, phase: 1.1 },
  { wavelength: 48, amplitude: 0.49, direction: direction(72), steepness: 0.79, phase: 3.9 },
  { wavelength: 40, amplitude: 0.40, direction: direction(-54), steepness: 0.75, phase: 5.7 },
  { wavelength: 34, amplitude: 0.31, direction: direction(106), steepness: 0.77, phase: 0.3 },
  { wavelength: 28, amplitude: 0.26, direction: direction(-86), steepness: 0.78, phase: 2.8 },
  { wavelength: 24, amplitude: 0.20, direction: direction(33), steepness: 0.81, phase: 4.8 },
  { wavelength: 21, amplitude: 0.17, direction: direction(-64), steepness: 0.78, phase: 1.6 },
  { wavelength: 18, amplitude: 0.14, direction: direction(119), steepness: 0.81, phase: 5.2 },
  { wavelength: 16, amplitude: 0.12, direction: direction(-122), steepness: 0.79, phase: 3.4 },
];

const glslNumber = (number: number) => number.toFixed(8);
const gerstnerCalls = OCEAN_WAVES.map((wave) => {
  const k = (2 * Math.PI) / wave.wavelength;
  const omega = Math.sqrt(9.81 * k);
  return `gerstner(vec2(${glslNumber(wave.direction[0])}, ${glslNumber(wave.direction[1])}), ${glslNumber(k)}, ${glslNumber(omega)}, ${glslNumber(wave.amplitude)}, ${glslNumber(wave.steepness)}, ${glslNumber(wave.phase)}, base, p, tx, tz, amplitudeSum);`;
}).join("\n  ");

const noiseGLSL = `
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float result = 0.0, amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    result += amplitude * valueNoise(p);
    p = p * 2.03 + vec2(17.17, 9.23);
    amplitude *= 0.5;
  }
  return result / 0.9375;
}
mat2 rotation(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, s, -s, c);
}
`;

const vertexShader = `
uniform float uTime, uStorm, uSeaLevel, uWaveScale;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vCrest, vCompression;
${noiseGLSL}

// Analytic derivatives preserve the broad wave silhouette and specular motion.
void gerstner(vec2 d, float k, float omega, float amplitude, float steepness,
              float phase, vec2 base, inout vec3 p, inout vec3 tx,
              inout vec3 tz, inout float amplitudeSum) {
  float a = amplitude * mix(0.82, 2.50, uStorm);
  float theta = k * dot(d, base) - omega * uTime + phase;
  float s = sin(theta), c = cos(theta);
  // k * horizontal amplitude = steepness / 12, independent of wave height.
  // Consequently the sum remains < 1 even at maximum storm intensity.
  float qa = steepness * mix(0.67, 1.0, uStorm) / (12.0 * k);
  p += vec3(qa * d.x * c, a * s, qa * d.y * c);
  tx += vec3(-qa * k * d.x * d.x * s, a * k * d.x * c, -qa * k * d.x * d.y * s);
  tz += vec3(-qa * k * d.x * d.y * s, a * k * d.y * c, -qa * k * d.y * d.y * s);
  amplitudeSum += a;
}
float irregularHeight(vec2 base) {
  return (fbm(base * 0.037 + vec2(uTime * 0.13, -uTime * 0.09)) - 0.5)
      * mix(1.10, 2.45, uStorm);
}
void main() {
  // Geometry must have its -PI/2 rotation baked into its position attribute.
  vec2 base = position.xz;
  vec3 p = position, tx = vec3(1.0, 0.0, 0.0), tz = vec3(0.0, 0.0, 1.0);
  float amplitudeSum = 0.0;
  ${gerstnerCalls}

  p.y += irregularHeight(base);
  float epsilon = 0.22;
  tx.y += (irregularHeight(base + vec2(epsilon, 0.0)) - irregularHeight(base - vec2(epsilon, 0.0))) / (2.0 * epsilon);
  tz.y += (irregularHeight(base + vec2(0.0, epsilon)) - irregularHeight(base - vec2(0.0, epsilon))) / (2.0 * epsilon);
  vCrest = p.y / max(amplitudeSum, 0.001);
  float compression = mix(8.0, 16.0, uStorm);
  // tanh limits extreme coincident crests. Derivative follows the same function.
  float t = exp(-2.0 * abs(p.y / compression));
  float compressed = sign(p.y) * (1.0 - t) / (1.0 + t);
  p.y = uSeaLevel + compression * compressed * uWaveScale;
  float slopeScale = (1.0 - compressed * compressed) * uWaveScale;
  tx.y *= slopeScale;
  tz.y *= slopeScale;
  vCompression = 1.0 - (tx.x * tz.z - tx.z * tz.x);
  vNormal = normalize(mat3(modelMatrix) * cross(tz, tx));
  vec4 worldPosition = modelMatrix * vec4(p, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = `
uniform samplerCube uSkyCube, uSkyStormCube;
uniform float uTime, uStorm, uReveal, uFlash;
uniform float uOceanRegion, uOuterOceanOpacity;
uniform float uShipActive;
uniform mat4 uShipInverse;
uniform vec3 uSunDirection, uCameraPosition;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying float vCrest, vCompression;
${noiseGLSL}
${bottleInnerRadiusAtGLSL}
${tallShipHullGLSL}
bool insideShip(vec3 world) {
  vec3 p = (uShipInverse * vec4(world, 1.0)).xyz;
  // Keep the cut just inside the planking; the visible waterline stays against the hull.
  return abs(p.z) < tallShipHalfWidthAtHeight(p.x, p.y) * 0.99;
}

// Five independently advected slope bands: the shortest bands fade below a pixel.
vec2 rippleSlope(vec2 worldXZ, float frequency, float angle, float speed,
                 float strength, float pixelFootprint) {
  mat2 r = rotation(angle);
  vec2 p = r * worldXZ * frequency + vec2(uTime * speed, -uTime * speed * 0.31);
  p.y *= 0.63;
  float e = 0.055;
  vec2 gradient = vec2(valueNoise(p + vec2(e, 0.0)) - valueNoise(p - vec2(e, 0.0)),
                       valueNoise(p + vec2(0.0, e)) - valueNoise(p - vec2(0.0, e))) / (2.0 * e);
  gradient.y *= 0.63;
  float bandVisibility = 1.0 - smoothstep(0.22, 1.15, pixelFootprint * frequency);
  return rotation(-angle) * gradient * strength * bandVisibility;
}

float foamBand(vec2 worldXZ, float frequency, float angle, float speed, float offset) {
  vec2 p = rotation(angle) * worldXZ;
  // Stretch along wind, with uneven filaments across it instead of round blobs.
  p *= vec2(frequency * 0.24, frequency * 1.35);
  p += vec2(uTime * speed, -uTime * speed * 0.37) + offset;
  float n = valueNoise(p) * 0.63 + valueNoise(p * 2.17 + 5.7) * 0.37;
  float grain = valueNoise(p * 4.73 + vec2(8.31, 12.17));
  return smoothstep(0.51, 0.74, n) * smoothstep(0.24, 0.70, grain);
}

void main() {
  vec2 xz = vWorldPosition.xz;
  // Two complementary surfaces share the exact same waves and tessellation.
  // The interior never shrinks; only the exterior dissolves before glass appears.
  float reveal = uReveal;
  float radius = bottleInnerRadiusAt(xz.x);
  float edge = length(vec2(xz.y, vWorldPosition.y - ${glslNumber(BOTTLE_CENTER_Y)})) / max(radius, 0.001);
  bool interior = edge <= 1.0 && radius >= 0.001;
  if (uOceanRegion > 0.5 ? !interior : interior) discard;
  if (uShipActive > 0.5 && insideShip(vWorldPosition)) discard;

  vec3 view = normalize(uCameraPosition - vWorldPosition);
  float distanceToEye = length(uCameraPosition - vWorldPosition);
  float footprint = max(length(dFdx(xz)), length(dFdy(xz)));
  vec2 slope = rippleSlope(xz, 0.12, 0.23, 0.26, 0.210, footprint);
  slope += rippleSlope(xz, 0.31, -0.54, -0.40, 0.165, footprint);
  slope += rippleSlope(xz, 0.72, 1.08, 0.63, 0.120, footprint);
  slope += rippleSlope(xz, 1.50, -1.21, -0.85, 0.080, footprint);
  slope += rippleSlope(xz, 2.90, 0.47, 1.14, 0.055, footprint);
  slope *= mix(1.0, 1.52, uStorm);
  vec3 normal = normalize(vNormal + vec3(-slope.x, 0.0, -slope.y));
  if (!gl_FrontFacing) normal = -normal;

  float nv = max(dot(normal, view), 0.0);
  float fresnel = 0.0204 + 0.9796 * pow(1.0 - nv, 5.0);
  vec3 reflectionDirection = reflect(-view, normal);
  // Rays directed into other wave faces do not receive an unobstructed bright sky.
  float skyVisibility = smoothstep(-0.08, 0.16, reflectionDirection.y);
  reflectionDirection.y = max(0.018, reflectionDirection.y);
  vec3 reflectedRay = normalize(reflectionDirection);
  vec3 sky = mix(textureCube(uSkyCube, reflectedRay).rgb, textureCube(uSkyStormCube, reflectedRay).rgb, uStorm);
  sky *= mix(vec3(0.63, 0.78, 0.90), vec3(0.76, 0.86, 0.93), uStorm);
  vec3 deep = mix(vec3(0.005, 0.036, 0.065), vec3(0.005, 0.018, 0.033), uStorm);
  vec3 jade = mix(vec3(0.009, 0.142, 0.166), vec3(0.015, 0.071, 0.097), uStorm);
  sky = mix(deep * 0.75, sky, 0.20 + skyVisibility * 0.80);
  float faceLight = clamp(0.25 + normal.y * 0.27 + vCrest * 0.28, 0.0, 1.0);
  vec3 body = mix(deep, jade, faceLight);

  // Light transmitted through a thin crest; stronger when looking toward the sun.
  float backlight = pow(max(dot(view, -uSunDirection), 0.0), 3.0);
  float crestTransmission = smoothstep(0.08, 0.55, vCrest) * backlight;
  body += mix(vec3(0.015, 0.13, 0.12), vec3(0.020, 0.075, 0.090), uStorm)
      * crestTransmission * (0.45 + 0.55 * (1.0 - nv));
  vec3 color = mix(body, sky, fresnel);

  // Narrow solar disk, broken glints, and a soft surrounding sun streak.
  vec3 halfway = normalize(view + uSunDirection);
  float nh = max(dot(normal, halfway), 0.0);
  float specular = pow(nh, 5800.0) * 7.2 + pow(nh, 950.0) * 0.34 + pow(nh, 120.0) * 0.013;
  float sunVisibility = (1.0 - uStorm * 0.97) * smoothstep(-0.02, 0.04, dot(normal, uSunDirection));
  color += vec3(1.00, 0.79, 0.47) * specular * sunVisibility;

  // Four scales of stretched whitecaps, activated by the Gerstner Jacobian.
  float foam = foamBand(xz, 0.12, 0.23, 0.18, 0.0) * 0.43;
  foam += foamBand(xz, 0.24, 0.36, -0.29, 7.1) * 0.28;
  foam += foamBand(xz, 0.49, -0.15, 0.42, 19.4) * 0.19;
  foam += foamBand(xz, 0.91, 0.71, -0.66, 31.8) * 0.10;
  float breaking = smoothstep(mix(0.30, 0.16, uStorm), mix(0.53, 0.40, uStorm), vCompression);
  breaking *= smoothstep(-0.08, 0.27, vCrest);
  float foamMask = smoothstep(0.08, 0.38, foam) * breaking * smoothstep(0.12, 0.58, uStorm) * 0.91;
  vec3 foamColor = mix(vec3(0.64, 0.75, 0.72), vec3(0.47, 0.61, 0.68), uStorm);
  color = mix(color, foamColor, foamMask);
  // A broken, narrow contact wake joins the slender hull to the surrounding sea.
  if (uShipActive > 0.5) {
    vec3 hullPoint = (uShipInverse * vec4(vWorldPosition, 1.0)).xyz;
    float width = tallShipHalfWidthAtHeight(hullPoint.x, hullPoint.y);
    float gap = abs(hullPoint.z) - width;
    float contact = exp(-max(gap, 0.0) * 3.0) * step(0.0, gap) * step(0.08, width);
    contact *= 1.0 - smoothstep(1.0, 2.8, abs(hullPoint.y));
    contact *= smoothstep(0.40, 0.78, valueNoise(xz * 2.7 + vec2(-uTime * 1.1, uTime * .24)));
    color = mix(color, foamColor, contact * (0.16 + 0.15 * uStorm) * (1.0 - 0.5 * reveal));
  }
  color += vec3(0.29, 0.43, 0.56) * uFlash * (0.28 + fresnel * 0.55);

  vec3 horizon = mix(vec3(0.27, 0.40, 0.46), vec3(0.080, 0.12, 0.165), uStorm);
  float fog = 1.0 - exp(-distanceToEye * mix(0.00062, 0.00138, uStorm));
  color = mix(color, horizon + vec3(0.22, 0.30, 0.40) * uFlash, fog * (1.0 - reveal));
  // A small dark rim reads as a waterline through the glass in the final view.
  color *= mix(1.0, 0.90, smoothstep(0.985, 1.0, edge) * uOceanRegion * (1.0 - uOuterOceanOpacity));
  gl_FragColor = vec4(color, uOceanRegion > 0.5 ? 1.0 : uOuterOceanOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createOceanMaterial(skyCube: THREE.CubeTexture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSkyCube: { value: skyCube },
      uSkyStormCube: { value: skyCube },
      uTime: { value: 0 },
      uStorm: { value: 0 },
      uReveal: { value: 0 },
      uOceanRegion: { value: 0 },
      uOuterOceanOpacity: { value: 1 },
      uSeaLevel: { value: 0 },
      uWaveScale: { value: 1 },
      uShipActive: { value: 0 },
      uShipInverse: { value: new THREE.Matrix4() },
      uSunDirection: { value: new THREE.Vector3(-0.52, 0.17, -0.84).normalize() },
      uCameraPosition: { value: new THREE.Vector3(0, 9, 40) },
      uFlash: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
}

const fract = (value: number) => value - Math.floor(value);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function hash21(x: number, z: number) {
  let px = fract(x * 0.1031), py = fract(z * 0.1031), pz = fract(x * 0.1031);
  const dot = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  px += dot; py += dot; pz += dot;
  return fract((px + py) * pz);
}
function valueNoise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let fx = fract(x), fz = fract(z);
  fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  return mix(mix(hash21(ix, iz), hash21(ix + 1, iz), fx),
    mix(hash21(ix, iz + 1), hash21(ix + 1, iz + 1), fx), fz);
}
function fbm(x: number, z: number) {
  let result = 0, amplitude = 0.5;
  for (let i = 0; i < 4; i++) {
    result += amplitude * valueNoise(x, z);
    x = x * 2.03 + 17.17; z = z * 2.03 + 9.23; amplitude *= 0.5;
  }
  return result / 0.9375;
}

/** CPU mirror for buoyancy. Invert horizontal displacement before sampling Y. */
export function sampleOceanHeight(x: number, z: number, time: number, storm: number): number {
  const intensity = Math.min(1, Math.max(0, storm));
  const amplitudeScale = mix(0.82, 2.50, intensity);
  const steepnessScale = mix(0.67, 1, intensity);
  let baseX = x, baseZ = z;
  for (let iteration = 0; iteration < 5; iteration++) {
    let displacementX = 0, displacementZ = 0;
    for (const wave of OCEAN_WAVES) {
      const k = (2 * Math.PI) / wave.wavelength;
      const phase = k * (wave.direction[0] * baseX + wave.direction[1] * baseZ) - Math.sqrt(9.81 * k) * time + wave.phase;
      const horizontal = (wave.steepness * steepnessScale * Math.cos(phase)) / (12 * k);
      displacementX += horizontal * wave.direction[0];
      displacementZ += horizontal * wave.direction[1];
    }
    baseX = x - displacementX; baseZ = z - displacementZ;
  }
  let height = 0;
  for (const wave of OCEAN_WAVES) {
    const k = (2 * Math.PI) / wave.wavelength;
    height += wave.amplitude * amplitudeScale * Math.sin(k * (wave.direction[0] * baseX + wave.direction[1] * baseZ) - Math.sqrt(9.81 * k) * time + wave.phase);
  }
  height += (fbm(baseX * 0.037 + time * 0.13, baseZ * 0.037 - time * 0.09) - 0.5) * mix(1.10, 2.45, intensity);
  const compression = mix(8, 16, intensity);
  return compression * Math.tanh(height / compression);
}
