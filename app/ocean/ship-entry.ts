import * as THREE from "three";

/** Keep the complete rig outside the left edge, then sail into the actual viewport. */
export function createShipEntry(ship: THREE.Group) {
  const bounds = new THREE.Box3().setFromObject(ship).getBoundingSphere(new THREE.Sphere());
  const approach = new THREE.Vector3();
  const viewProjection = new THREE.Matrix4();
  const leftEdge = new THREE.Plane();
  const centre = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  // Buoyancy rotates around the waterline, so the off-centre bounding sphere
  // also moves. Include its maximum pitch/roll excursion, heave and sail flutter.
  const clearance = bounds.radius + 2 * bounds.center.length() * Math.sin((.22 + .145) / 2) + 12 + .75;

  return (camera: THREE.PerspectiveCamera, amount: number, yaw: number, target: THREE.Vector3) => {
    camera.updateMatrixWorld(true);
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const m = viewProjection.elements;
    leftEdge.setComponents(m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]).normalize();
    // Sail across the screen on the water plane, rather than receding hundreds
    // of metres into the distance on an ultrawide display.
    approach.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize().negate();
    centre.copy(bounds.center).applyAxisAngle(up, yaw);
    const distance = Math.max(0, (leftEdge.distanceToPoint(centre) + clearance) / -leftEdge.normal.dot(approach));
    target.copy(approach).multiplyScalar(distance * (1 - THREE.MathUtils.clamp(amount, 0, 1)));
  };
}
