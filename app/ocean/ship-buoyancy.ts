import * as THREE from "three";
import { tallShipDeckHeight, tallShipHalfBeam, TALL_SHIP_MIN_X, TALL_SHIP_MAX_X } from "./tall-ship-profile";

const hullLength = TALL_SHIP_MAX_X - TALL_SHIP_MIN_X;
const stations = [.054, .18, .34, .5, .66, .82, .946].map(t=>TALL_SHIP_MIN_X+hullLength*t);
const local = new THREE.Vector3();

/** Fit a water plane across the hull, then keep the lowest deck edge clear of crests. */
export function applyShipBuoyancy(ship: THREE.Group, yaw: number, heightAt: (x: number, z: number) => number) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  let sum = 0, xHeight = 0, zHeight = 0, xx = 0, zz = 0, xSum = 0, weightSum = 0;
  for (const x of stations) {
    const beam = tallShipHalfBeam(x) * 0.72;
    // The broad submerged midships carry more displacement than the fine bow/stern.
    const weight = Math.max(0.1, beam);
    for (const z of [-beam, 0, beam]) {
      const height = heightAt(ship.position.x + c * x + s * z, ship.position.z - s * x + c * z);
      sum += weight * height; xHeight += weight * x * height; zHeight += weight * z * height;
      xx += weight * x * x; zz += weight * z * z; xSum += weight * x; weightSum += weight;
    }
  }
  const longitudinalSlope = (xHeight - xSum * sum / weightSum) / (xx - xSum * xSum / weightSum);
  const pitch = THREE.MathUtils.clamp(Math.atan(longitudinalSlope), -0.22, 0.22);
  const roll = THREE.MathUtils.clamp(-Math.atan(zHeight / zz), -0.145, 0.145);
  ship.rotation.set(roll, yaw, pitch, "YXZ");
  let heave = sum / weightSum - longitudinalSlope * xSum / weightSum;
  for (let station = 0; station <= 36; station++) {
    const x = TALL_SHIP_MIN_X + .15 + (hullLength - .3) * station / 36;
    const beam = tallShipHalfBeam(x) * 0.985;
    for (const z of [-beam, 0, beam]) {
      local.set(x, tallShipDeckHeight(x), z).applyQuaternion(ship.quaternion);
      const crest = heightAt(ship.position.x + local.x, ship.position.z + local.z);
      heave = Math.max(heave, crest - local.y + 0.45);
    }
  }
  ship.position.y = heave;
  ship.updateMatrixWorld(true);
}
