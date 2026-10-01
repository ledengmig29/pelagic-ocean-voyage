import * as THREE from "three";
import { BOTTLE_CENTER_Y, BOTTLE_OUTER_PROFILE } from "./bottle-profile";

/** A small, deterministic modelling kit. Everything is geometry; no remote assets. */
const TAU = Math.PI * 2;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function disposeGroup(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material);
      }
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  group.clear();
}

/** Static carved details share a handful of draws; articulated parts stay separate. */
function consolidateStatic(group: THREE.Group, animated: Set<THREE.Object3D>) {
  group.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.Mesh[]>();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || Array.isArray(object.material)) return;
    for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
      if (animated.has(ancestor)) return;
    }
    const meshes = buckets.get(object.material) ?? [];
    meshes.push(object);
    buckets.set(object.material, meshes);
  });
  const removedGeometries = new Set<THREE.BufferGeometry>();
  buckets.forEach((meshes, material) => {
    if (meshes.length < 2) return;
    const transformed = meshes.map((mesh) => {
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld);
      // Mirroring the stern reverses winding; bake that correction as well.
      if (mesh.matrixWorld.determinant() < 0) {
        for (const attribute of Object.values(geometry.attributes)) {
          const array = attribute.array;
          for (let vertex = 0; vertex < attribute.count; vertex += 3) {
            for (let component = 0; component < attribute.itemSize; component++) {
              const b = (vertex + 1) * attribute.itemSize + component;
              const c = (vertex + 2) * attribute.itemSize + component;
              const swap = array[b];
              array[b] = array[c];
              array[c] = swap;
            }
          }
        }
      }
      return geometry;
    });
    const geometry = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "color"]) {
      if (!transformed.every((item) => item.hasAttribute(name))) continue;
      const attributes = transformed.map((item) => item.getAttribute(name));
      const array = new Float32Array(attributes.reduce((length, attribute) => length + attribute.array.length, 0));
      let offset = 0;
      for (const attribute of attributes) {
        array.set(attribute.array, offset);
        offset += attribute.array.length;
      }
      geometry.setAttribute(name, new THREE.BufferAttribute(array, attributes[0].itemSize));
    }
    const merged = new THREE.Mesh(geometry, material);
    merged.castShadow = true;
    merged.receiveShadow = true;
    group.add(merged);
    for (const mesh of meshes) {
      removedGeometries.add(mesh.geometry);
      mesh.removeFromParent();
    }
    transformed.forEach((item) => item.dispose());
  });
  const stillUsed = new Set<THREE.BufferGeometry>();
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) stillUsed.add(object.geometry);
  });
  removedGeometries.forEach((geometry) => {
    if (!stillUsed.has(geometry)) geometry.dispose();
  });
}

function cylinderBetween(
  parent: THREE.Object3D,
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  topRadius = radius,
  radialSegments = 8,
) {
  const direction = b.clone().sub(a);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(topRadius, radius, direction.length(), radialSegments),
    material,
  );
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), direction.normalize());
  parent.add(mesh);
  return mesh;
}

function tube(
  parent: THREE.Object3D,
  points: THREE.Vector3[],
  radius: number,
  material: THREE.Material,
  segments = 64,
  closed = false,
) {
  const curve = new THREE.CatmullRomCurve3(points, closed, "centripetal");
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 6, closed), material);
  parent.add(mesh);
  return mesh;
}

function wood(color: THREE.ColorRepresentation, roughness = 0.78) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.035 });
}

function hullPoint(x: number, q: number, side: number, inset = 0) {
  const u = THREE.MathUtils.clamp((x + 16) / 32, 0, 1);
  const breadth = Math.pow(Math.max(0.002, Math.sin(Math.PI * u)), 0.66);
  const sheer = Math.pow(Math.abs(x) / 16, 3.2) * 2.6;
  return V(
    x,
    -1.9 + 4.65 * Math.pow(q, 1.1) + sheer,
    side * Math.max(0, breadth * 3.65 * Math.sin(q * Math.PI * 0.5) - inset),
  );
}

/** Overlapping strakes rather than a smooth modern hull. The lips catch light. */
function clinkerPlank(strake: number, side: number) {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const base = new THREE.Color(strake % 3 === 0 ? "#755036" : strake % 3 === 1 ? "#956848" : "#875c3f");
  const segments = 72;
  const q0 = strake / 10;
  const q1 = Math.min(1, (strake + 1) / 10 + 0.018);
  for (let i = 0; i <= segments; i++) {
    const x = -16 + (32 * i) / segments;
    for (let edge = 0; edge < 3; edge++) {
      const q = edge === 0 ? q0 : edge === 1 ? q0 + 0.022 : q1;
      const point = hullPoint(x, q, side);
      if (edge === 0) point.z += side * 0.07;
      positions.push(point.x, point.y, point.z);
      const grain = 0.91 + 0.11 * Math.sin(i * 0.67 + strake * 1.93) + 0.025 * edge;
      colors.push(base.r * grain, base.g * grain, base.b * grain);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let edge = 0; edge < 2; edge++) {
      const a = i * 3 + edge;
      const b = a + 3;
      if (side > 0) indices.push(a, b, a + 1, b, b + 1, a + 1);
      else indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createDragonStem(parent: THREE.Group, direction: number, timber: THREE.Material, trim: THREE.Material) {
  const stem = new THREE.Group();
  stem.scale.x = direction;
  parent.add(stem);
  const shape = new THREE.Shape();
  shape.moveTo(14.8, -0.4);
  shape.bezierCurveTo(16.7, 1.3, 17.9, 4.0, 17.35, 6.8);
  shape.bezierCurveTo(16.8, 8.7, 17.1, 10.05, 18.8, 10.7);
  shape.lineTo(19.75, 10.25);
  shape.lineTo(20.0, 9.7);
  shape.lineTo(18.85, 9.63);
  shape.lineTo(19.62, 9.25);
  shape.lineTo(19.3, 8.9);
  shape.bezierCurveTo(18.4, 9.1, 17.98, 9.25, 17.85, 8.6);
  shape.bezierCurveTo(17.95, 6.85, 18.38, 5.2, 17.72, 3.45);
  shape.bezierCurveTo(17.0, 1.3, 15.8, -0.15, 14.8, -0.4);
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
    depth: 0.53, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08,
    bevelSegments: 2, curveSegments: 16,
  }), timber);
  mesh.position.z = -0.265;
  stem.add(mesh);
  tube(stem, [V(15.7, 0.7, 0.34), V(17.55, 4.1, 0.34), V(17.35, 6.9, 0.34), V(17.45, 9.3, 0.34), V(18.75, 10.2, 0.34)], 0.065, trim, 50);
  tube(stem, [V(15.7, 0.7, -0.34), V(17.55, 4.1, -0.34), V(17.35, 6.9, -0.34), V(17.45, 9.3, -0.34), V(18.75, 10.2, -0.34)], 0.065, trim, 50);
  // Swept back antlers and a distinctly carved, narrow dragon snout.
  cylinderBetween(stem, V(17.8, 10.25, 0), V(17.18, 11.2, 0), 0.19, timber, 0.02);
  cylinderBetween(stem, V(18.22, 10.43, 0), V(17.86, 11.45, 0), 0.15, timber, 0.02);
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: "#121713", roughness: 0.22, metalness: 0.35 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), eyeMaterial);
    eye.position.set(18.62, 10.08, side * 0.34);
    eye.scale.z = 0.45;
    stem.add(eye);
    // A small interlaced carving on the exposed stem faces.
    tube(stem, [V(17.4, 4.4, side * 0.32), V(17.83, 5.1, side * 0.32), V(17.13, 5.95, side * 0.32), V(17.48, 6.7, side * 0.32)], 0.03, trim, 26);
  }
  return stem;
}

function createShield(red: boolean, side: number, timber: THREE.Material, bronze: THREE.Material, paints: { red: THREE.Material; ivory: THREE.Material; dark: THREE.Material }) {
  const shield = new THREE.Group();
  const backing = new THREE.Mesh(new THREE.CylinderGeometry(0.91, 0.91, 0.13, 32), timber);
  backing.rotation.x = Math.PI / 2;
  shield.add(backing);
  const paint = red ? paints.red : paints.ivory;
  const pale = red ? paints.ivory : paints.dark;
  const dark = paints.dark;
  for (let sector = 0; sector < 4; sector++) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.87, 12, sector * Math.PI / 2, Math.PI / 2), sector % 2 ? pale : paint);
    face.position.z = side * 0.076;
    if (side < 0) face.rotation.y = Math.PI;
    shield.add(face);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.875, 0.055, 6, 40), bronze);
  rim.position.z = side * 0.076;
  shield.add(rim);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 10), dark);
  boss.position.z = side * 0.14;
  boss.scale.z = 0.62;
  shield.add(boss);
  for (let i = 0; i < 8; i++) {
    const theta = i * TAU / 8;
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), bronze);
    rivet.position.set(Math.cos(theta) * 0.75, Math.sin(theta) * 0.75, side * 0.1);
    shield.add(rivet);
  }
  // A pair of plank joins remain visible through the hand painted quarters.
  for (const x of [-0.32, 0.32]) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 1.55, 0.008), dark);
    seam.position.set(x, 0, side * 0.089);
    shield.add(seam);
  }
  return shield;
}

export function createVikingShip(): {
  group: THREE.Group;
  update(time: number, storm: number): void;
  dispose(): void;
} {
  const group = new THREE.Group();
  group.name = "The Northbound — clinker-built Viking longship";
  const timber = wood("#72513a");
  const paleTimber = wood("#a17a51");
  const darkTimber = wood("#302c23", 0.85);
  const bronze = new THREE.MeshStandardMaterial({ color: "#ae8550", roughness: 0.5, metalness: 0.64 });
  const rope = new THREE.MeshStandardMaterial({ color: "#8e8567", roughness: 0.94 });
  const darkRope = new THREE.MeshStandardMaterial({ color: "#39382d", roughness: 0.91 });
  const hullMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.025, side: THREE.DoubleSide });
  const shieldPaints = {
    red: new THREE.MeshStandardMaterial({ color: "#8f332b", roughness: 0.8, metalness: 0.035 }),
    ivory: new THREE.MeshStandardMaterial({ color: "#cbb47d", roughness: 0.84 }),
    dark: new THREE.MeshStandardMaterial({ color: "#2b2c25", roughness: 0.71, metalness: 0.15 }),
  };

  for (const side of [-1, 1]) {
    for (let strake = 0; strake < 10; strake++) {
      group.add(new THREE.Mesh(clinkerPlank(strake, side), hullMaterial));
      const edge = Array.from({ length: 49 }, (_, i) => hullPoint(-15.8 + i * 31.6 / 48, (strake + 1) / 10, side));
      tube(group, edge, strake === 9 ? 0.135 : 0.035, strake === 9 ? paleTimber : darkTimber, 64);
    }
    const rail = Array.from({ length: 49 }, (_, i) => {
      const point = hullPoint(-15.7 + i * 31.4 / 48, 1, side);
      point.y += 0.18;
      return point;
    });
    tube(group, rail, 0.14, timber, 64);
  }
  cylinderBetween(group, V(-15.8, 0.2, 0), V(15.8, 0.2, 0), 0.22, darkTimber);
  createDragonStem(group, 1, timber, bronze);
  const stern = createDragonStem(group, -1, timber, bronze);
  stern.scale.y = 0.84;

  // Narrow, independently coloured deck planks retain the longship's open plan.
  for (let row = -6; row <= 6; row++) {
    const z = row * 0.46;
    const length = 27.2 - Math.pow(Math.abs(z) / 3, 2) * 5.5;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(length, 0.14, 0.43), row % 3 === 0 ? paleTimber : timber);
    plank.position.set(-0.3, 1.31, z);
    group.add(plank);
  }
  for (let i = 0; i < 10; i++) {
    const x = -11.5 + i * 2.55;
    const width = Math.abs(hullPoint(x, 0.84, 1).z) * 1.86;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.21, width), paleTimber);
    bench.position.set(x, 2.0, 0);
    group.add(bench);
    // Curved internal ribs follow the clinker planking.
    const ribs: THREE.Vector3[] = [];
    for (let s = 10; s >= 0; s--) ribs.push(hullPoint(x, s / 10, -1, 0.11));
    for (let s = 1; s <= 10; s++) ribs.push(hullPoint(x, s / 10, 1, 0.11));
    tube(group, ribs, 0.095, darkTimber, 32);
  }

  // Copper nail heads, consolidated into one draw call.
  const nailGeometry = new THREE.SphereGeometry(0.033, 5, 4);
  const nails = new THREE.InstancedMesh(nailGeometry, bronze, 300);
  const nailMatrix = new THREE.Matrix4();
  let nailIndex = 0;
  for (const side of [-1, 1]) {
    for (let strake = 2; strake < 10; strake++) {
      for (let station = 0; station < 16; station++) {
        const point = hullPoint(-13.8 + station * 27.6 / 15, (strake + 0.76) / 10, side);
        point.z += side * 0.025;
        nailMatrix.makeTranslation(point.x, point.y, point.z);
        nails.setMatrixAt(nailIndex++, nailMatrix);
      }
    }
  }
  nails.count = nailIndex;
  group.add(nails);

  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const x = -10.7 + i * 3.05;
      const point = hullPoint(x, 0.98, side);
      const shield = createShield(i % 2 === 0, side, timber, bronze, shieldPaints);
      shield.position.set(x, point.y - 0.15, point.z + side * 0.12);
      shield.rotation.z = 0.08 * Math.sin(i * 1.73);
      group.add(shield);
    }
  }

  const oars: { group: THREE.Group; side: number; phase: number }[] = [];
  const paddleShape = new THREE.Shape();
  paddleShape.moveTo(-0.14, 0);
  paddleShape.quadraticCurveTo(-0.65, 0.65, -0.63, 2.5);
  paddleShape.quadraticCurveTo(0, 3.12, 0.63, 2.5);
  paddleShape.quadraticCurveTo(0.65, 0.65, 0.14, 0);
  paddleShape.closePath();
  const paddleGeometry = new THREE.ExtrudeGeometry(paddleShape, { depth: 0.09, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.03, bevelSegments: 1, curveSegments: 8 });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const x = -10.1 + i * 2.8;
      const railPoint = hullPoint(x, 0.89, side);
      const oar = new THREE.Group();
      oar.position.copy(railPoint);
      const end = V(-1.3, -1.8, side * 6.35);
      cylinderBetween(oar, V(0.22, 0.3, -side * 1.6), end, 0.075, paleTimber, 0.06);
      const blade = new THREE.Mesh(paddleGeometry, paleTimber);
      blade.position.copy(end);
      blade.quaternion.setFromUnitVectors(V(0, 1, 0), end.clone().normalize());
      oar.add(blade);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.048, 5, 10), darkRope);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(0, 0.03, 0);
      oar.add(collar);
      group.add(oar);
      oars.push({ group: oar, side, phase: i * 0.21 });
    }
  }
  // Steering oar mounted aft, a defining detail absent from a modern rudder.
  cylinderBetween(group, V(-11.4, 3.4, 3), V(-16.5, -1.9, 6), 0.16, timber, 0.13);
  const steeringBlade = new THREE.Mesh(paddleGeometry, darkTimber);
  steeringBlade.position.set(-15.8, -1.0, 5.55);
  steeringBlade.scale.set(1.55, 1.7, 1.4);
  steeringBlade.quaternion.setFromUnitVectors(V(0, 1, 0), V(-1.8, -2.3, 0.8).normalize());
  group.add(steeringBlade);

  cylinderBetween(group, V(-0.8, 1.4, 0), V(-0.8, 28, 0), 0.3, timber, 0.15, 12);
  cylinderBetween(group, V(-0.72, 25.3, -9.4), V(-0.72, 25.3, 9.4), 0.19, darkTimber, 0.19, 10);
  const mastFoot = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.6, 1.25), darkTimber);
  mastFoot.position.set(-0.8, 1.65, 0);
  group.add(mastFoot);
  for (const end of [-1, 1]) {
    for (const side of [-1, 1]) {
      cylinderBetween(group, V(-0.8, 27.3, side * 0.06), V(end * 12.5, 3.45, side * 2.7), 0.045, darkRope, 0.045, 5);
      cylinderBetween(group, V(-0.72, 25.35, side * 8.6), V(end * 8.3, 2.7, side * 2.4), 0.035, rope, 0.035, 5);
    }
  }

  const sailColumns = 48;
  const sailRows = 30;
  const sailPositions: number[] = [];
  const sailColors: number[] = [];
  const sailUV: number[] = [];
  const sailIndices: number[] = [];
  const scarlet = new THREE.Color("#9b3d30");
  const ivory = new THREE.Color("#e4d3a6");
  for (let row = 0; row <= sailRows; row++) {
    const v = row / sailRows;
    for (let column = 0; column <= sailColumns; column++) {
      const u = column / sailColumns;
      const z = (u * 2 - 1) * (8.6 - v * 0.95 - Math.sin(v * Math.PI) * 0.32);
      const y = 25.2 - v * 10.65 + Math.pow(Math.abs(u * 2 - 1), 1.8) * v * 1.5;
      const x = -0.42 + Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 2.85;
      sailPositions.push(x, y, z);
      sailUV.push(u, v);
      const color = Math.floor(u * 7 - 0.0001) % 2 === 0 ? scarlet : ivory;
      const weather = 0.89 + 0.095 * Math.sin(u * 31 + v * 17) * Math.sin(v * 26 + u * 5);
      sailColors.push(color.r * weather, color.g * weather, color.b * weather);
    }
  }
  for (let row = 0; row < sailRows; row++) {
    for (let column = 0; column < sailColumns; column++) {
      const a = row * (sailColumns + 1) + column;
      const b = a + sailColumns + 1;
      sailIndices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const sailGeometry = new THREE.BufferGeometry();
  sailGeometry.setAttribute("position", new THREE.Float32BufferAttribute(sailPositions, 3));
  sailGeometry.setAttribute("color", new THREE.Float32BufferAttribute(sailColors, 3));
  sailGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(sailUV, 2));
  sailGeometry.setIndex(sailIndices);
  sailGeometry.computeVertexNormals();
  const sailMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.91, metalness: 0 });
  const sail = new THREE.Mesh(sailGeometry, sailMaterial);
  group.add(sail);
  const sailBase = new Float32Array(sailPositions);

  const topRope: THREE.Vector3[] = [];
  const footRope: THREE.Vector3[] = [];
  for (let column = 0; column <= sailColumns; column += 3) {
    const topOffset = column * 3;
    const footOffset = (sailRows * (sailColumns + 1) + column) * 3;
    topRope.push(V(sailBase[topOffset], sailBase[topOffset + 1], sailBase[topOffset + 2]));
    footRope.push(V(sailBase[footOffset], sailBase[footOffset + 1], sailBase[footOffset + 2]));
  }
  tube(group, topRope, 0.047, rope, 32);
  tube(group, footRope, 0.049, rope, 32);
  for (const side of [-1, 1]) {
    tube(group, [V(-0.42, 25.2, side * 8.6), V(-0.42, 20.65, side * 7.93), V(-0.42, 16.05, side * 7.65)], 0.043, rope, 22);
    cylinderBetween(group, V(-0.42, 16.05, side * 7.65), V(-8.7, 2.85, side * 2.85), 0.044, rope, 0.044, 5);
  }
  // Small mast pennant, useful for judging wind without overwhelming the sail.
  const pennantGeometry = new THREE.BufferGeometry();
  pennantGeometry.setAttribute("position", new THREE.Float32BufferAttribute([-0.8, 27.85, 0, -0.8, 27.2, 0, -3.4, 27.3, 0.4], 3));
  pennantGeometry.setIndex([0, 1, 2]);
  pennantGeometry.computeVertexNormals();
  const pennant = new THREE.Mesh(pennantGeometry, new THREE.MeshStandardMaterial({ color: "#962f27", side: THREE.DoubleSide, roughness: 0.9 }));
  group.add(pennant);

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  consolidateStatic(group, new Set<THREE.Object3D>([sail, pennant, ...oars.map((oar) => oar.group)]));
  return {
    group,
    update(time, storm) {
      const weather = THREE.MathUtils.clamp(storm, 0, 1);
      const position = sailGeometry.getAttribute("position") as THREE.BufferAttribute;
      for (let row = 0; row <= sailRows; row++) {
        const v = row / sailRows;
        for (let column = 0; column <= sailColumns; column++) {
          const u = column / sailColumns;
          const index = row * (sailColumns + 1) + column;
          const offset = index * 3;
          const anchored = Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
          const flutter = Math.sin(time * (2.1 + weather * 2) + u * 12 - v * 6) * (0.15 + weather * 0.42);
          position.setX(index, sailBase[offset] + anchored * (Math.sin(time * 0.85) * 0.28 + flutter + weather * 0.55));
        }
      }
      position.needsUpdate = true;
      sailGeometry.computeVertexNormals();
      for (const oar of oars) {
        oar.group.rotation.x = oar.side * (Math.sin(time * 1.4 + oar.phase) * (0.035 + weather * 0.055));
        oar.group.rotation.y = Math.sin(time * 1.4 + oar.phase + 0.8) * (0.018 + weather * 0.025);
      }
      const flagPosition = pennantGeometry.getAttribute("position") as THREE.BufferAttribute;
      flagPosition.setZ(2, 0.4 + Math.sin(time * 4.5) * (0.2 + weather * 0.4));
      flagPosition.needsUpdate = true;
    },
    dispose() { disposeGroup(group); },
  };
}

function bottleRing(parent: THREE.Group, x: number, radius: number, thickness: number, material: THREE.Material) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 6, 96), material);
  ring.rotation.y = Math.PI / 2;
  ring.position.set(x, 8, 0);
  parent.add(ring);
  return ring;
}

export function createBottle(environment: THREE.CubeTexture): {
  group: THREE.Group;
  setReveal(amount: number): void;
  dispose(): void;
} {
  const group = new THREE.Group();
  group.name = "The bottled North Sea — hand blown glass and walnut cradle";
  group.visible = false;
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#cedfd7", roughness: 0.075, metalness: 0,
    envMap: environment, envMapIntensity: 1.05,
    transmission: 0.98, thickness: 0.55, ior: 1.46,
    attenuationColor: new THREE.Color("#a0c7ba"), attenuationDistance: 240,
    clearcoat: 0.55, clearcoatRoughness: 0.06, specularIntensity: 0.65,
    transparent: true, opacity: 0.21, side: THREE.DoubleSide,
    depthWrite: false,
  });
  const rimGlass = new THREE.MeshPhysicalMaterial({
    color: "#c7e1d8", envMap: environment, envMapIntensity: 1.2,
    roughness: 0.14, metalness: 0.025, transmission: 0.8,
    thickness: 0.9, ior: 1.46, transparent: true, opacity: 0.28,
    depthWrite: false,
  });
  const profile = BOTTLE_OUTER_PROFILE.map(([axial, radius]) => new THREE.Vector2(radius, axial));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 128), glass);
  body.rotation.z = -Math.PI / 2;
  body.position.y = BOTTLE_CENTER_Y;
  body.renderOrder = 8;
  group.add(body);
  bottleRing(group, 64.8, 11.55, 0.48, rimGlass).renderOrder = 9;
  bottleRing(group, 53.5, 11.05, 0.13, rimGlass).renderOrder = 9;
  bottleRing(group, -46.7, 25.9, 0.16, rimGlass).renderOrder = 9;
  bottleRing(group, -48.1, 23.6, 0.1, rimGlass).renderOrder = 9;

  // Tiny glints on the body give the glass a readable silhouette even on a dark sky.
  const glint = new THREE.MeshBasicMaterial({ color: "#e4f5ec", transparent: true, opacity: 0.09, depthWrite: false, toneMapped: false });
  for (const angle of [0.32, 2.56]) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const x = -40 + i * 75 / 32;
      const radius = 29 + 0.035 * Math.sin(i * 0.5);
      const twist = angle + 0.025 * Math.sin(i * 0.1);
      points.push(V(x, 8 + Math.cos(twist) * radius, Math.sin(twist) * radius));
    }
    tube(group, points, 0.075, glint, 48).renderOrder = 10;
  }

  const corkMaterial = new THREE.MeshStandardMaterial({ color: "#987748", roughness: 0.97, vertexColors: true });
  const corkGeometry = new THREE.CylinderGeometry(10.1, 9.9, 6.6, 48, 5);
  const corkColors: number[] = [];
  const corkPositions = corkGeometry.getAttribute("position");
  for (let i = 0; i < corkPositions.count; i++) {
    const fleck = 0.7 + 0.3 * Math.abs(Math.sin(i * 12.9898 + 3.1) * Math.cos(i * 4.13));
    corkColors.push(fleck, fleck, fleck);
  }
  corkGeometry.setAttribute("color", new THREE.Float32BufferAttribute(corkColors, 3));
  const cork = new THREE.Mesh(corkGeometry, corkMaterial);
  cork.rotation.z = -Math.PI / 2;
  cork.position.set(67.8, 8, 0);
  cork.castShadow = true;
  group.add(cork);
  const corkBand = new THREE.MeshStandardMaterial({ color: "#54432d", roughness: 0.87 });
  bottleRing(group, 68.4, 10.08, 0.075, corkBand);
  bottleRing(group, 70.4, 10.08, 0.055, corkBand);

  const walnut = new THREE.MeshStandardMaterial({ color: "#28241f", roughness: 0.37, metalness: 0.08 });
  const brass = new THREE.MeshStandardMaterial({ color: "#b09a66", roughness: 0.42, metalness: 0.73 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(97, 3.4, 43), walnut);
  base.position.set(-3.5, -28.2, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  const lowerBase = new THREE.Mesh(new THREE.BoxGeometry(99, 0.9, 45), walnut);
  lowerBase.position.set(-3.5, -30.2, 0);
  group.add(lowerBase);
  for (const x of [-28, 23]) {
    const cradlePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const angle = -0.82 + i * 1.64 / 32;
      cradlePoints.push(V(x, 8 - Math.cos(angle) * 30.2, Math.sin(angle) * 30.2));
    }
    const support = tube(group, cradlePoints, 1.05, walnut, 40);
    support.castShadow = true;
    for (const side of [-1, 1]) {
      cylinderBetween(group, V(x, -26.5, side * 14.7), V(x, -17.1, side * 16.4), 0.85, walnut, 0.75, 8);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.65, 5.4), walnut);
      foot.position.set(x, -26.5, side * 15.1);
      group.add(foot);
    }
    // A very restrained brass trim follows each walnut saddle.
    tube(group, cradlePoints.map((point) => point.clone().add(V(1.02, 0, 0))), 0.08, brass, 40);
  }
  const inset = new THREE.Mesh(new THREE.BoxGeometry(26, 0.7, 0.15), brass);
  inset.position.set(-3.5, -28.0, 21.57);
  group.add(inset);
  // An engraved abstract compass mark, no baked-in caption or remote font.
  const compass = new THREE.Group();
  compass.position.set(-3.5, -28, 21.67);
  const engraving = new THREE.MeshBasicMaterial({ color: "#413827" });
  const compassRing = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.02, 4, 24), engraving);
  compass.add(compassRing);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    cylinderBetween(compass, V(Math.cos(angle) * 0.14, Math.sin(angle) * 0.14, 0), V(Math.cos(angle) * 0.48, Math.sin(angle) * 0.48, 0), 0.017, engraving, 0.017, 4);
  }
  group.add(compass);

  const revealMaterials = new Map<THREE.Material, number>();
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.material) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!revealMaterials.has(material)) revealMaterials.set(material, material.opacity);
    }
  });
  return {
    group,
    setReveal(amount) {
      const reveal = THREE.MathUtils.clamp(amount, 0, 1);
      group.visible = reveal > 0.001;
      revealMaterials.forEach((opacity, material) => {
        material.opacity = opacity * reveal;
        // Keep native transmission transparent; solid display materials return
        // to depth-writing once the camera has finished its pullback.
        const transparent = material === glass || material === rimGlass || material === glint || reveal < 0.999;
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
      });
    },
    dispose() { disposeGroup(group); },
  };
}
