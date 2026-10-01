/** Project the real ship, including its rig, through the shared entry placement. */
import * as THREE from "three";
import { createTallShip } from "../app/ocean/tall-ship";
import { createShipEntry } from "../app/ocean/ship-entry";
import { applyShipBuoyancy } from "../app/ocean/ship-buoyancy";
import { sampleOceanHeight } from "../app/ocean/ocean-shaders";
import { SHIP_CLOSE_YAW, SHIP_STORM_WAVE_SCALE } from "../app/ocean/ship-motion";

const failures: string[] = [];
let checks = 0;
const check = (condition: boolean, description: string) => { checks++; if (!condition) failures.push(description); };
const smooth = (a: number, b: number, value: number) => {
  const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const ship = createTallShip();
const initialBounds = new THREE.Box3().setFromObject(ship.group, true);
check(initialBounds.max.x > 38 && initialBounds.max.y > 26,
  "The regression model must include the bowsprit and all three masts, beyond the 56 m hull");
const placeShip = createShipEntry(ship.group);
const camera = new THREE.PerspectiveCamera(49, 16 / 9, .5, 6000);
const look = new THREE.Vector3();
const world = new THREE.Vector3();
const projected = new THREE.Vector3();
const cameraPoint = new THREE.Vector3();

// The pre-pullback camera varies during entry, as it does in the live scene.
function setCamera(progress: number, aspect: number) {
  const close = smooth(.18, .40, progress);
  camera.aspect = aspect;
  camera.position.set(THREE.MathUtils.lerp(0, 24, close), THREE.MathUtils.lerp(12, 18, close), THREE.MathUtils.lerp(83, 88, close));
  look.set(THREE.MathUtils.lerp(-22, aspect < .8 ? 0 : -4, close), THREE.MathUtils.lerp(3, 10, close), THREE.MathUtils.lerp(-150, 0, close));
  camera.lookAt(look);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

function pose(progress: number, aspect: number, time: number, rough = false) {
  setCamera(progress, aspect);
  const amount = smooth(.235, .395, progress);
  placeShip(camera, amount, SHIP_CLOSE_YAW, ship.group.position);
  const storm = rough ? 1 : smooth(.25, .41, progress);
  const waveScale = rough ? SHIP_STORM_WAVE_SCALE : THREE.MathUtils.lerp(1, SHIP_STORM_WAVE_SCALE, amount);
  applyShipBuoyancy(ship.group, SHIP_CLOSE_YAW, (x, z) => waveScale * sampleOceanHeight(x, z, time, storm));
  ship.update(time, storm);
}

// Checking actual vertices catches a wrong local origin, an omitted rig,
// a tilted/bobbing vessel, and an edge that only works at one aspect ratio.
function screenBounds() {
  let minX = Infinity, maxX = -Infinity, nearest = Infinity;
  ship.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute("position");
    for (let vertex = 0; vertex < positions.count; vertex++) {
      world.fromBufferAttribute(positions, vertex).applyMatrix4(object.matrixWorld);
      cameraPoint.copy(world).applyMatrix4(camera.matrixWorldInverse);
      projected.copy(world).project(camera);
      minX = Math.min(minX, projected.x);
      maxX = Math.max(maxX, projected.x);
      nearest = Math.min(nearest, -cameraPoint.z);
    }
  });
  return { minX, maxX, nearest };
}

const aspects = [21 / 9, 16 / 9, 4 / 3, 9 / 16];
for (const aspect of aspects) {
  for (const time of [0, 7.65, 15.2, 73.75]) {
    for (const rough of [false, true]) {
      pose(.235, aspect, time, rough);
      const bounds = screenBounds();
      check(bounds.maxX < -1.001, `The entire ship must start outside the left edge (${aspect}, ${time}, rough=${rough}); max NDC x=${bounds.maxX}`);
      check(bounds.nearest > camera.near, `The starting ship must stay in front of the camera (${aspect}, ${time})`);
    }
  }
  for (const progress of [0, .18]) {
    pose(progress, aspect, 7.65);
    check(screenBounds().maxX < -1.001, `The calm chapter must not expose a portion of the ship (${aspect}, p=${progress})`);
  }

  // A tiny first movement must not toggle a previously hidden slice into view.
  pose(.235, aspect, 7.65);
  const firstPosition = ship.group.position.clone();
  const firstMatrix = ship.group.matrixWorld.clone();
  pose(.235 + 1e-6, aspect, 7.65);
  check(ship.group.position.distanceTo(firstPosition) < .002, `Entry position is discontinuous at its first step (${aspect})`);
  check(ship.group.matrixWorld.elements.every((value, i) => Math.abs(value - firstMatrix.elements[i]) < .002), `The first buoyant pose is discontinuous (${aspect})`);
  check(screenBounds().maxX < -1.001, `A tiny entry step exposes a pre-existing ship slice (${aspect})`);

  // Flat water isolates the camera/approach path from intentional wave rocking.
  let previousX = -Infinity;
  let firstVisible = NaN;
  for (let frame = 0; frame <= 32; frame++) {
    const progress = .235 + (.395 - .235) * frame / 32;
    setCamera(progress, aspect);
    placeShip(camera, smooth(.235, .395, progress), SHIP_CLOSE_YAW, ship.group.position);
    applyShipBuoyancy(ship.group, SHIP_CLOSE_YAW, () => 0);
    ship.update(7.65, 0);
    const bounds = screenBounds();
    check(bounds.maxX >= previousX - 1e-6, `The ship reverses screen direction while entering (${aspect}, p=${progress})`);
    if (bounds.maxX > -1 && Number.isNaN(firstVisible)) firstVisible = progress;
    previousX = bounds.maxX;
  }
  check(firstVisible > .235 && firstVisible < .34, `Entry must cross the edge gradually within its chapter (${aspect}); first visible p=${firstVisible}`);
  check(Math.abs(ship.group.position.x) < 1e-9 && Math.abs(ship.group.position.z) < 1e-9, `The completed entry must meet the established ship position (${aspect})`);

  // Seeking backwards and resizing cannot inherit an earlier spawn position.
  pose(.30, aspect, 9.8);
  const expectedPosition = ship.group.position.clone();
  const expectedMatrix = ship.group.matrixWorld.clone();
  pose(.395, 21 / 9, 18);
  pose(.235, 9 / 16, 35);
  pose(.30, aspect, 9.8);
  check(ship.group.position.distanceTo(expectedPosition) < 1e-9, `A reverse seek changed the entry position (${aspect})`);
  check(ship.group.matrixWorld.elements.every((value, i) => Math.abs(value - expectedMatrix.elements[i]) < 1e-9), `A reverse seek changed the buoyant entry pose (${aspect})`);
  check(ship.group.visible, "Entry should use viewport clipping, rather than a visibility switch");
}

ship.dispose();
if (failures.length) {
  failures.forEach((failure) => console.error(failure));
  throw new Error(`${failures.length} of ${checks} ship-entry checks failed`);
}
console.log(`PASS: ${checks} ship-entry checks — complete rig offscreen, gradual forward entry, buoyant continuity, four aspect ratios and deterministic reverse seeks.`);
