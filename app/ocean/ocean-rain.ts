import * as THREE from "three";

export const RAIN_START_PROGRESS = .25;
// The shared 36-second film reaches p=.25 on its first 0 → .28 / 9s segment.
export const RAIN_FILM_START = 9 * RAIN_START_PROGRESS / .28;
export const RAIN_BUILD_SECONDS = 3.8;
export const RAIN_EMITTER = {
  birthY: 1.18, travelY: 2.68,
  minSpeed: 1.28, maxSpeed: 2.12,
  birthFade: .045, deathFade: .08,
  nearDepth: 18, referenceDepth: 25,
  minShutter: .012, maxShutter: .027,
} as const;
const glsl = (value: number) => value.toFixed(8);

/** Only interactive playback needs an entry timestamp; film seeks stay stateless. */
export function createRainClock(interactive: boolean, filmStart = RAIN_FILM_START) {
  let startedAt: number | null = null;
  let previousTime = -Infinity;
  return (time: number, progress: number) => {
    if (!interactive) return time - filmStart;
    if (time < previousTime || progress <= RAIN_START_PROGRESS || progress >= .72) startedAt = null;
    previousTime = time;
    if (progress > RAIN_START_PROGRESS && progress < .72 && startedAt === null) startedAt = time;
    return startedAt === null ? -1 : time - startedAt;
  };
}

const seeded = (index: number) => THREE.MathUtils.euclideanModulo(Math.sin(index * 127.1 + 311.7) * 43758.5453, 1);

/** Camera-space precipitation with independent, offscreen birth/recycle points. */
export function createOceanRain() {
  const count = 1400;
  const seeds = new Float32Array(count * 2 * 4);
  const tips = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const seed = [seeded(i * 4), seeded(i * 4 + 1), seeded(i * 4 + 2), seeded(i * 4 + 3)];
    seeds.set(seed, i * 8);
    seeds.set(seed, i * 8 + 4);
    tips[i * 2 + 1] = 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 6), 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
  geometry.setAttribute("aTip", new THREE.BufferAttribute(tips, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uClock: { value: -1 }, uStrength: { value: 0 }, uAspect: { value: 1 }, uTanHalfFov: { value: .45 } },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uClock, uStrength, uAspect, uTanHalfFov;
      attribute vec4 aSeed;
      attribute float aTip;
      varying float vAlpha, vTip;
      float hash(float x) { return fract(sin(x * 127.1 + 311.7) * 43758.5453); }
      void main() {
        // Every slot starts empty. Its first drop is born above the viewport,
        // staggered over several seconds, then keeps its own independent cycle.
        float delay = .08 + aSeed.w * ${RAIN_BUILD_SECONDS.toFixed(1)};
        float speed = mix(${glsl(RAIN_EMITTER.minSpeed)}, ${glsl(RAIN_EMITTER.maxSpeed)}, aSeed.y);
        float fallDuration = ${glsl(RAIN_EMITTER.travelY)} / speed;
        float period = fallDuration + mix(.12, .64, aSeed.x);
        float elapsed = uClock - delay;
        float cycle = floor(max(0.0, elapsed) / period);
        float age = mod(max(0.0, elapsed), period);
        float aliveMask = step(0.0, elapsed) * (1.0 - step(fallDuration, age));
        // Horizontal randomness changes only while the drop is offscreen.
        // Wind has no shared modulo/reset and cannot move the whole rain field.
        float originX = mix(-1.16, 1.66, hash(aSeed.x * 719.0 + cycle * 17.17));
        vec2 velocity = vec2(-mix(.16, .29, aSeed.z), -speed);
        vec2 head = vec2(originX, ${glsl(RAIN_EMITTER.birthY)}) + velocity * age;
        float depth = ${glsl(RAIN_EMITTER.nearDepth)} * pow(8.0, aSeed.z);
        float shutter = mix(${glsl(RAIN_EMITTER.minShutter)}, ${glsl(RAIN_EMITTER.maxShutter)}, aSeed.x) * sqrt(${glsl(RAIN_EMITTER.referenceDepth)} / depth);
        // The tail trails opposite to the velocity: up/right in a leftward wind.
        vec2 point = head - velocity * shutter * aTip;
        vec3 viewPosition = vec3(point.x * depth * uTanHalfFov * uAspect,
                                 point.y * depth * uTanHalfFov, -depth);
        gl_Position = projectionMatrix * vec4(viewPosition, 1.0);
        float born = smoothstep(0.0, ${glsl(RAIN_EMITTER.birthFade)}, age);
        float dying = 1.0 - smoothstep(fallDuration - ${glsl(RAIN_EMITTER.deathFade)}, fallDuration, age);
        vAlpha = aliveMask * born * dying * uStrength * mix(.52, 1.0, aSeed.y);
        vTip = aTip;
      }
    `,
    fragmentShader: `
      varying float vAlpha, vTip;
      void main() {
        gl_FragColor = vec4(.57, .70, .80, vAlpha * pow(1.0 - vTip, .65));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const object = new THREE.LineSegments(geometry, material);
  object.name = "Continuous rain — staggered offscreen emitters";
  object.frustumCulled = false;
  object.renderOrder = 7;
  return {
    object,
    update(clock: number, strength: number, camera: THREE.PerspectiveCamera) {
      material.uniforms.uClock.value = clock;
      material.uniforms.uStrength.value = strength;
      material.uniforms.uAspect.value = camera.aspect;
      material.uniforms.uTanHalfFov.value = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      // This only skips a genuinely empty draw; it never reveals a prefilled field.
      object.visible = clock > 0 && strength > 0;
    },
    dispose() { geometry.dispose(); material.dispose(); },
  };
}
