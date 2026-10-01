/**
 * CPU regression checks for the actual ocean, liquid volume, and white tall-ship hull.
 * Run without browser/WebGL or extra dependencies:
 * npm run ocean:check
 */
import * as THREE from "three";
import { BOTTLE_CENTER_Y, BOTTLE_INNER_PROFILE, BOTTLE_WATER_LEVEL, bottleInnerRadiusAt } from "../app/ocean/bottle-profile";
import { createBottleWater } from "../app/ocean/bottle-water";
import { createTallShip } from "../app/ocean/tall-ship";
import { tallShipDeckHeight, tallShipHalfBeam, TALL_SHIP_MIN_X, TALL_SHIP_MAX_X, TALL_SHIP_KEEL_Y } from "../app/ocean/tall-ship-profile";
import { SHIP_STORM_WAVE_SCALE, SHIP_BOTTLE_WAVE_SCALE, SHIP_CLOSE_YAW, SHIP_BOTTLE_YAW } from "../app/ocean/ship-motion";
import { sampleOceanHeight } from "../app/ocean/ocean-shaders";
import { applyShipBuoyancy } from "../app/ocean/ship-buoyancy";

const failures: string[] = [];
const assert = (condition: boolean, message: string) => { if (!condition) failures.push(message); };
const firstX = BOTTLE_INNER_PROFILE[0][0];
const lastX = BOTTLE_INNER_PROFILE[BOTTLE_INNER_PROFILE.length - 1][0];

// Integrate circular-segment area along the real, tapered interior, including its neck.
let capacity = 0;
let waterVolume = 0;
const slices = 20000;
for (let slice = 0; slice < slices; slice++) {
  const x = firstX + (lastX - firstX) * (slice + 0.5) / slices;
  const radius = bottleInnerRadiusAt(x);
  const depth = THREE.MathUtils.clamp(BOTTLE_WATER_LEVEL - BOTTLE_CENTER_Y, -radius, radius);
  capacity += Math.PI * radius * radius;
  waterVolume += radius * radius * Math.acos(-depth / radius) + depth * Math.sqrt(radius * radius - depth * depth);
}
const fillFraction = waterVolume / capacity;
assert(Number.isFinite(fillFraction) && fillFraction >= 0.5, `Bottle only fills ${(fillFraction * 100).toFixed(3)}% of its interior`);

const water = createBottleWater();
let liquidVerticesChecked = 0;
let liquidLowestY = Infinity;
let liquidOutsideVertices = 0;
let nonFiniteVertices = 0;
for (const time of [0, 7.5, 15, 30, 45, 60]) {
  water.update(time, 1, (x, z) => BOTTLE_WATER_LEVEL + SHIP_BOTTLE_WAVE_SCALE * sampleOceanHeight(x, z, time, 0.28));
  water.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      liquidVerticesChecked++;
      if (!Number.isFinite(x + y + z)) nonFiniteVertices++;
      liquidLowestY = Math.min(liquidLowestY, y);
      // The contact highlight intentionally rides 0.028 units above the liquid.
      if (object.name !== "Subtle glass-contact meniscus"
        && Math.hypot(y - BOTTLE_CENTER_Y, z) > bottleInnerRadiusAt(x) + 0.001) liquidOutsideVertices++;
    }
  });
}
assert(nonFiniteVertices === 0, `${nonFiniteVertices} liquid vertices are not finite`);
assert(liquidOutsideVertices === 0, `${liquidOutsideVertices} liquid vertices leave the bottle interior`);
assert(liquidLowestY < -20.5, `Liquid bottom stops at ${liquidLowestY}, above the bottle floor`);
water.update(0, 0, () => 0);
assert(!water.group.visible, "Liquid remains visible before the bottle reveal");
water.dispose();

// Sample throughout the deck independently of the solver's support/crest probes.
const deckPoints: THREE.Vector3[] = [];
for (let station = 0; station <= 80; station++) {
  const x = TALL_SHIP_MIN_X + .08 + (TALL_SHIP_MAX_X - TALL_SHIP_MIN_X - .16) * station / 80;
  const halfBeam = tallShipHalfBeam(x) * 0.995;
  for (let across = 0; across <= 12; across++) {
    deckPoints.push(new THREE.Vector3(x, tallShipDeckHeight(x), halfBeam * (2 * across / 12 - 1)));
  }
}
const pose = new THREE.Group();
const worldPoint = new THREE.Vector3();
let posesChecked = 0;
let deckSamplesChecked = 0;
let minimumDeckClearance = Infinity;
let worstDeckCase: Record<string, number> = {};
let minimumMidshipDraft = Infinity;
for (let tick = 0; tick <= 120; tick++) {
  const time = tick * 0.5;
  for (const storm of [0, 0.28, 1]) {
    for (const waveScale of [SHIP_BOTTLE_WAVE_SCALE, SHIP_STORM_WAVE_SCALE, 1]) {
      for (const yaw of [SHIP_CLOSE_YAW, SHIP_BOTTLE_YAW]) {
        for (const [x, z] of [[0, 0], [-45, -12]]) {
          const meanLevel = waveScale === SHIP_BOTTLE_WAVE_SCALE ? BOTTLE_WATER_LEVEL : 0;
          const heightAt = (px: number, pz: number) => meanLevel + waveScale * sampleOceanHeight(px, pz, time, storm);
          pose.position.set(x, 0, z);
          applyShipBuoyancy(pose, yaw, heightAt);
          if (waveScale === SHIP_STORM_WAVE_SCALE && x === 0 && yaw === SHIP_CLOSE_YAW) {
            worldPoint.set(0, TALL_SHIP_KEEL_Y, 0).applyMatrix4(pose.matrixWorld);
            minimumMidshipDraft = Math.min(minimumMidshipDraft, heightAt(worldPoint.x, worldPoint.z) - worldPoint.y);
          }
          posesChecked++;
          for (const point of deckPoints) {
            worldPoint.copy(point).applyMatrix4(pose.matrixWorld);
            const clearance = worldPoint.y - heightAt(worldPoint.x, worldPoint.z);
            deckSamplesChecked++;
            if (clearance < minimumDeckClearance) {
              minimumDeckClearance = clearance;
              worstDeckCase = { time, storm, waveScale, yaw, shipX: x, shipZ: z, localX: point.x, localZ: point.z };
            }
          }
        }
      }
    }
  }
}
assert(Number.isFinite(minimumDeckClearance) && minimumDeckClearance > 0,
  `Waves cross the deck by ${-minimumDeckClearance} at ${JSON.stringify(worstDeckCase)}`);
assert(minimumMidshipDraft > .4, `The ship lifts clear of the water: minimum midship draft ${minimumMidshipDraft}`);

// Check every rendered ship vertex against the bottle while the final sea continues moving.
const ship = createTallShip();
let shipVerticesChecked = 0;
let minimumBottleClearance = Infinity;
let shipOutsideVertices = 0;
let worstBottleCase: Record<string, number | string> = {};
for (let time = 0; time <= 60; time += 5) {
  const heightAt = (x: number, z: number) => BOTTLE_WATER_LEVEL + SHIP_BOTTLE_WAVE_SCALE * sampleOceanHeight(x, z, time, 0.28);
  ship.group.position.set(0, 0, 0);
  applyShipBuoyancy(ship.group, SHIP_BOTTLE_YAW, heightAt);
  ship.update(time, 0.28);
  ship.group.updateMatrixWorld(true);
  ship.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      worldPoint.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      const radius = bottleInnerRadiusAt(worldPoint.x);
      const clearance = radius - Math.hypot(worldPoint.y - BOTTLE_CENTER_Y, worldPoint.z);
      shipVerticesChecked++;
      if (!Number.isFinite(clearance)) nonFiniteVertices++;
      if (clearance < -0.001) shipOutsideVertices++;
      if (clearance < minimumBottleClearance) {
        minimumBottleClearance = clearance;
        worstBottleCase = { time, mesh: object.name, x: worldPoint.x, y: worldPoint.y, z: worldPoint.z };
      }
    }
  });
}
ship.dispose();
assert(nonFiniteVertices === 0, `${nonFiniteVertices} ship/liquid vertices are not finite`);
assert(shipOutsideVertices === 0,
  `${shipOutsideVertices} ship vertices cross the bottle; worst penetration ${-minimumBottleClearance}: ${JSON.stringify(worstBottleCase)}`);

console.log(JSON.stringify({
  fillFraction, liquidVerticesChecked, liquidLowestY, liquidOutsideVertices,
  posesChecked, deckSamplesChecked, minimumDeckClearance, minimumMidshipDraft, worstDeckCase,
  shipVerticesChecked, minimumBottleClearance, shipOutsideVertices, worstBottleCase,
  failures,
}, null, 2));
if (failures.length > 0) process.exitCode = 1;
