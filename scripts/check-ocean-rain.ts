/** Behavioural rain regressions; no copied shader or browser/WebGL context. Run npm run ocean:rain-check. */
import * as THREE from "three";
import { createOceanRain, createRainClock, RAIN_BUILD_SECONDS, RAIN_EMITTER, RAIN_FILM_START, RAIN_START_PROGRESS } from "../app/ocean/ocean-rain";
import { oceanProgressAt } from "../remotion/ocean-journey";

const failures: string[] = [];
let checks = 0;
const check = (condition: boolean, description: string) => { checks++; if (!condition) failures.push(description); };
const close = (actual: number, expected: number, description: string) => {
  check(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-9, `${description}: expected ${expected}, received ${actual}`);
};

// Film time is absolute. Jumping to an earlier/later chapter must not reuse an entry timestamp.
close(oceanProgressAt(RAIN_FILM_START), RAIN_START_PROGRESS, "Film rain start stays aligned with the shared journey timing");
const film = createRainClock(false);
let random = 0x953bf127;
let filmSeeks = 0;
for (let index = 0; index < 2400; index++) {
  random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
  const time = (random % 46001) / 1000 - 5;
  const progress = (index % 101) / 100;
  close(film(time, progress), time - RAIN_FILM_START, `History-free film seek ${index}`);
  filmSeeks++;
}
for (const time of [-1, 0, RAIN_FILM_START, RAIN_FILM_START + 0.5, 35.999, 36]) {
  const expected = film(time, 0.46);
  film(1000, 1); film(-1000, 0);
  close(film(time, 0.9), expected, `Film seek back to ${time} after unrelated calls`);
}
const offsetFilm = createRainClock(false, 3.75);
close(offsetFilm(3.75, 0.4), 0, "Custom film start");
close(offsetFilm(7.75, 0.9), 4, "Custom film timeline elapsed time");

// Interactivity starts empty at the exact moment the scroll position enters the rainy chapter.
const interactive = createRainClock(true);
close(interactive(90, 0), -1, "No rain before the chapter");
close(interactive(100, RAIN_START_PROGRESS), -1, "Rain start threshold is still dry");
close(interactive(101, RAIN_START_PROGRESS + 1e-6), 0, "First entry starts an empty particle field");
close(interactive(101.5, 0.4), 0.5, "Changing scroll within the rain keeps its clock");
for (let frame = 0; frame <= 600; frame++) {
  const time = 102 + frame / 60;
  close(interactive(time, 0.46), time - 101, `Stopped scrolling, advancing rain at frame ${frame}`);
}
const pausedValue = interactive(112, 0.46);
for (let call = 0; call < 50; call++) close(interactive(112, 0.46), pausedValue, `Repeated paused time ${call}`);
close(interactive(113, 0.72), -1, "The bottle-side boundary clears the rain clock");
close(interactive(200, 0.9), -1, "Remaining outside the rain does not age particles");
close(interactive(250, 0.4), 0, "Returning from the bottle restarts rain empty");
close(interactive(253.5, 0.4), 3.5, "Second visit advances normally");
close(interactive(254, 0.2), -1, "Returning toward the calm sea clears rain");
close(interactive(260, 0.4), 0, "Re-entry from the calm sea also starts empty");
close(interactive(262, 0.4), 2, "Third visit advances normally");
close(interactive(4, 0.4), 0, "Time moving backward resets the interactive emitter");
close(interactive(4.75, 0.4), 0.75, "Rain resumes after a timeline reset");
close(interactive(2, 0.1), -1, "Time moving backward outside the rain remains dry");
close(interactive(3, 0.4), 0, "Entry after an outside reset starts empty");
const otherInteractive = createRainClock(true);
close(otherInteractive(50, 0.4), 0, "A separate renderer owns its own entry timestamp");
close(interactive(5, 0.4), 2, "Another renderer does not change the first clock");
check(RAIN_BUILD_SECONDS > 2, "Rain births no longer spread over several seconds");

// Inspect the actual GPU attributes: paired line vertices describe one independently seeded drop.
const rain = createOceanRain();
const seeds = rain.object.geometry.getAttribute("aSeed");
const tips = rain.object.geometry.getAttribute("aTip");
const positions = rain.object.geometry.getAttribute("position");
const particleCount = seeds.count / 2;
check(particleCount === 1400, `Unexpected particle count ${particleCount}`);
check(seeds.itemSize === 4 && tips.itemSize === 1 && positions.itemSize === 3, "Rain GPU attributes have incompatible shapes");
check(tips.count === seeds.count && positions.count === seeds.count, "Streak endpoints are missing GPU attributes");
const tuples = new Set<string>();
const dimensions: number[][] = [[], [], [], []];
const histogram = Array.from({ length: 4 }, () => Array.from({ length: 8 }, () => 0));
for (let drop = 0; drop < particleCount; drop++) {
  const tuple: number[] = [];
  for (let channel = 0; channel < 4; channel++) {
    const head = seeds.array[drop * 8 + channel];
    const tail = seeds.array[drop * 8 + 4 + channel];
    check(head === tail, `Drop ${drop} endpoint ${channel} has a different seed`);
    check(Number.isFinite(head) && head >= 0 && head < 1, `Drop ${drop} seed ${channel} is outside [0,1)`);
    tuple.push(head); dimensions[channel].push(head); histogram[channel][Math.min(7, Math.floor(head * 8))]++;
  }
  tuples.add(tuple.join(","));
  check(tips.getX(drop * 2) === 0 && tips.getX(drop * 2 + 1) === 1, `Drop ${drop} has no distinct head and tail`);
}
check(tuples.size === particleCount, "Particles share identical four-channel seeds");
for (const value of positions.array) check(Number.isFinite(value), "Position buffer contains a non-finite value");
for (let channel = 0; channel < 4; channel++) {
  check(histogram[channel].every((occupancy) => occupancy > particleCount * 0.065 && occupancy < particleCount * 0.19),
    `Seed channel ${channel} clusters drops into a small part of its range: ${histogram[channel]}`);
}
const correlations: number[] = [];
for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
  const meanA = dimensions[a].reduce((sum, value) => sum + value, 0) / particleCount;
  const meanB = dimensions[b].reduce((sum, value) => sum + value, 0) / particleCount;
  let covariance = 0, varianceA = 0, varianceB = 0;
  for (let i = 0; i < particleCount; i++) {
    const da = dimensions[a][i] - meanA, db = dimensions[b][i] - meanB;
    covariance += da * db; varianceA += da * da; varianceB += db * db;
  }
  const correlation = covariance / Math.sqrt(varianceA * varianceB);
  correlations.push(correlation);
  check(Math.abs(correlation) < 0.15, `Seed channels ${a}/${b} synchronize at correlation ${correlation}`);
}
const secondRain = createOceanRain();
const secondSeeds = secondRain.object.geometry.getAttribute("aSeed");
check(seeds.array.every((value, index) => value === secondSeeds.array[index]), "Recreating the scene changes deterministic particle seeds");
secondRain.dispose();

// Actual draw updates preserve seeds and use each camera's current aspect/FOV.
const seedSnapshot = new Float32Array(seeds.array);
const camera = new THREE.PerspectiveCamera(49, 16 / 9, 0.1, 1000);
// Conservative kinematic bounds, not a second implementation of the particle shader.
// Test the slowest/fastest/nearest permitted drop and its entire motion-blurred tail.
const maximumShutter = RAIN_EMITTER.maxShutter * Math.sqrt(RAIN_EMITTER.referenceDepth / RAIN_EMITTER.nearDepth);
const birthFadeLowestY = RAIN_EMITTER.birthY - RAIN_EMITTER.maxSpeed * RAIN_EMITTER.birthFade;
const recycleHighestY = RAIN_EMITTER.birthY - RAIN_EMITTER.travelY + RAIN_EMITTER.maxSpeed * maximumShutter;
const deathFadeHighestY = recycleHighestY + RAIN_EMITTER.maxSpeed * RAIN_EMITTER.deathFade;
check(RAIN_EMITTER.minSpeed > 0 && RAIN_EMITTER.maxSpeed >= RAIN_EMITTER.minSpeed, "Rain can stall or travel upward");
check(RAIN_EMITTER.birthY > 1, "Drops are born inside the visible viewport");
check(birthFadeLowestY > 1, "Birth fading happens within the viewport and can reveal a whole rain layer");
check(recycleHighestY < -1, "A drop can recycle while its tail remains on screen");
check(deathFadeHighestY < -1, "Recycling/fading can make visible rain disappear together");
let cameraBoundaryChecks = 0;
rain.update(-1, 1, camera); check(!rain.object.visible, "Rain draws before entry");
rain.update(0, 1, camera); check(!rain.object.visible, "Rain reveals a prefilled field at clock zero");
rain.update(1, 0, camera); check(!rain.object.visible, "Rain draws at zero strength");
for (const [fov, aspect] of [[49, 16 / 9], [36, 9 / 16], [52, 1]]) {
  camera.fov = fov; camera.aspect = aspect; camera.updateProjectionMatrix();
  rain.update(5.25, 0.61, camera);
  check(rain.object.visible, "Active precipitation is hidden");
  close(rain.object.material.uniforms.uClock.value, 5.25, "GPU clock receives elapsed rain time");
  close(rain.object.material.uniforms.uStrength.value, 0.61, "GPU strength follows weather");
  close(rain.object.material.uniforms.uAspect.value, aspect, "GPU camera aspect follows resizing");
  close(rain.object.material.uniforms.uTanHalfFov.value, Math.tan(THREE.MathUtils.degToRad(fov) / 2), "GPU camera FOV follows the moving camera");
  for (const depth of [RAIN_EMITTER.nearDepth, RAIN_EMITTER.nearDepth * 2, RAIN_EMITTER.nearDepth * 8]) {
    for (const [edgeY, above] of [[RAIN_EMITTER.birthY, true], [birthFadeLowestY, true], [recycleHighestY, false], [deathFadeHighestY, false]] as const) {
      const view = new THREE.Vector3(0, edgeY * depth * rain.object.material.uniforms.uTanHalfFov.value, -depth);
      const projected = view.applyMatrix4(camera.projectionMatrix);
      check(above ? projected.y > 1 : projected.y < -1,
        `Birth/recycle boundary enters NDC at FOV ${fov}, aspect ${aspect}, depth ${depth}: ${projected.y}`);
      cameraBoundaryChecks++;
    }
  }
}
check(seeds.array.every((value, index) => value === seedSnapshot[index]), "Rain update reshuffles the field instead of advancing independent drops");
check(!rain.object.frustumCulled, "Dummy-origin rain geometry can be incorrectly culled by the world camera");
check(!rain.object.material.depthWrite, "Transparent rain writes an opaque depth layer over the scene");
let geometryDisposals = 0, materialDisposals = 0;
rain.object.geometry.addEventListener("dispose", () => geometryDisposals++);
rain.object.material.addEventListener("dispose", () => materialDisposals++);
rain.dispose();
check(geometryDisposals === 1 && materialDisposals === 1, "Rain leaves GPU resources allocated on disposal");

console.log(JSON.stringify({ checks, filmSeeks, stoppedScrollFrames: 601, particles: particleCount,
  uniqueSeeds: tuples.size, maximumSeedCorrelation: Math.max(...correlations.map(Math.abs)),
  offscreenBoundaryBounds: { birthFadeLowestY, recycleHighestY, deathFadeHighestY, cameraBoundaryChecks },
  seedHistograms: histogram, failures: failures.length, ...(failures.length ? { details: failures.slice(0, 30) } : {}),
}, null, 2));
if (failures.length) process.exitCode = 1;
