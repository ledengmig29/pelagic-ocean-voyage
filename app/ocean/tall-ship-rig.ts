import * as THREE from "three";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const SPAN = V(0.9207, 0, 0.3903).normalize();
const WIND = V(-SPAN.z, 0, SPAN.x);
const UP = V(0, 1, 0);

/** Small material-batched modelling kit: spars and fine rigging share six draws. */
class RigBuilder {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(source: THREE.BufferGeometry, material: THREE.Material, matrix = new THREE.Matrix4()) {
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    geometry.applyMatrix4(matrix);
    if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
    if (!geometry.getAttribute("uv")) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute("position").count * 2), 2));
    const bucket = this.buckets.get(material) ?? [];
    bucket.push(geometry); this.buckets.set(material, bucket); source.dispose();
  }
  pole(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material, taper = radius, sides = 5) {
    const direction = b.clone().sub(a);
    this.add(new THREE.CylinderGeometry(taper, radius, direction.length(), sides, 1), material,
      new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize()), V(1, 1, 1)));
  }
  curve(points: THREE.Vector3[], radius: number, material: THREE.Material, segments = 12) {
    this.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 4, false), material);
  }
  ring(center: THREE.Vector3, radius: number, thickness: number, material: THREE.Material) {
    this.add(new THREE.TorusGeometry(radius, thickness, 4, 12), material,
      new THREE.Matrix4().compose(center, new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2), V(1, 1, 1)));
  }
  finish(group: THREE.Group) {
    for (const [material, geometries] of this.buckets) {
      const merged = new THREE.BufferGeometry();
      for (const [name, size] of [["position", 3], ["normal", 3], ["uv", 2]] as const) {
        const values = new Float32Array(geometries.reduce((sum, item) => sum + item.getAttribute(name).array.length, 0));
        let offset = 0;
        for (const geometry of geometries) { const source = geometry.getAttribute(name).array; values.set(source, offset); offset += source.length; }
        merged.setAttribute(name, new THREE.BufferAttribute(values, size));
      }
      merged.computeBoundingBox(); merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
      geometries.forEach((geometry) => geometry.dispose());
    }
    this.buckets.clear();
  }
}

function linenTexture() {
  if (typeof document === "undefined") {
    const texture = new THREE.DataTexture(new Uint8Array([249, 249, 242, 255]), 1, 1);
    texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true; return texture;
  }
  const canvas = document.createElement("canvas"); canvas.width = 768; canvas.height = 512;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#fafaf5"; context.fillRect(0, 0, 768, 512);
  // Subtle, deterministic yarn and salt staining. The visible joins run vertically.
  for (let y = 0; y < 512; y += 2) {
    const value = 0.014 + 0.017 * (0.5 + 0.5 * Math.sin(y * 17.73));
    context.fillStyle = `rgba(109,110,103,${value})`; context.fillRect(0, y, 768, 1);
  }
  for (let x = 0; x < 768; x += 3) {
    context.fillStyle = `rgba(94,98,89,${0.012 + 0.01 * Math.abs(Math.sin(x * 9.81))})`;
    context.fillRect(x, 0, 1, 512);
  }
  for (let panel = 1; panel < 12; panel++) {
    const x = panel * 64;
    const fold = context.createLinearGradient(x - 26, 0, x + 27, 0);
    fold.addColorStop(0, "rgba(118,119,112,0)"); fold.addColorStop(0.42, "rgba(118,119,112,.025)");
    fold.addColorStop(0.63, "rgba(255,255,251,.16)"); fold.addColorStop(1, "rgba(255,255,251,0)");
    context.fillStyle = fold; context.fillRect(x - 26, 0, 53, 512);
    context.fillStyle = "rgba(111,110,103,.072)"; context.fillRect(x, 0, 1, 512);
    context.fillStyle = "rgba(255,255,255,.36)"; context.fillRect(x + 1, 0, 1, 512);
    context.fillStyle = "rgba(112,111,102,.12)";
    for (let y = 1; y < 512; y += 11) context.fillRect(x - 2, y, 1, 3);
  }
  const shade = context.createLinearGradient(0, 0, 0, 512);
  shade.addColorStop(0, "rgba(119,116,98,.075)"); shade.addColorStop(0.14, "rgba(119,116,98,0)");
  shade.addColorStop(0.9, "rgba(119,116,98,0)"); shade.addColorStop(1, "rgba(119,116,98,.06)");
  context.fillStyle = shade; context.fillRect(0, 0, 768, 512);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

export function createTallShipRig(): { group: THREE.Group; update(time: number, storm: number): void; dispose(): void } {
  const group = new THREE.Group(); group.name = "Three-masted full-rigged sailing ship — white canvas and standing rigging";
  const b = new RigBuilder();
  const materials: THREE.Material[] = [];
  const standard = (color: string, roughness = 0.73, metalness = 0) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.push(material); return material;
  };
  const timber = standard("#b2a07d", 0.67);
  const white = standard("#eeeeea", 0.6);
  const steel = standard("#575d5d", 0.5, 0.3);
  const standing = standard("#575b58", 0.9);
  const running = standard("#959282", 0.9);
  const texture = linenTexture();
  const canvas = new THREE.MeshStandardMaterial({ color: "#d8d5cc", map: texture, roughness: 0.94, metalness: 0, envMapIntensity: 0.35, side: THREE.DoubleSide, vertexColors: true });
  materials.push(canvas);

  // All canvas is one indexed animated mesh. Each vertex retains its anchored envelope.
  const positions: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = [];
  const envelopes: number[] = [], phases: number[] = [], windDirections: number[] = [];
  const addVertex = (point: THREE.Vector3, u: number, v: number, envelope: number, phase: number, normal: THREE.Vector3, color = V(1, 1, 0.99)) => {
    positions.push(point.x, point.y, point.z); uvs.push(u, v); colors.push(color.x, color.y, color.z);
    envelopes.push(envelope); phases.push(phase); windDirections.push(normal.x, normal.y, normal.z);
  };
  const patch = (pointAt: (u: number, v: number) => THREE.Vector3, phase: number, normal: THREE.Vector3, columns = 22, rows = 12, colorAt?: (u: number, v: number) => THREE.Vector3) => {
    const start = positions.length / 3;
    for (let row = 0; row <= rows; row++) {
      const v = row / rows;
      for (let column = 0; column <= columns; column++) {
        const u = column / columns;
        addVertex(pointAt(u, v), u, v, Math.sin(Math.PI * u) * Math.sin(Math.PI * v), phase + u * 2.1 + v * 3.8, normal, colorAt?.(u, v));
      }
    }
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const a = start + row * (columns + 1) + column, c = a + columns + 1;
      indices.push(a, a + 1, c, a + 1, c + 1, c);
    }
  };

  const masts = [
    { x: -15.5, top: 23.8, yards: [22.6, 18.55, 14.55, 10.45], widths: [7.5, 9.35, 11.0, 12.6], heights: [3.55, 3.5, 3.48, 3.7] },
    { x: -1.0, top: 26.2, yards: [25.0, 21.05, 17.2, 13.45, 9.75], widths: [8.15, 9.95, 11.55, 12.9, 13.6], heights: [3.4, 3.3, 3.2, 3.13, 4.4] },
    { x: 13.6, top: 25.5, yards: [24.35, 20.45, 16.6, 12.85, 9.2], widths: [7.9, 9.7, 11.2, 12.45, 13.3], heights: [3.35, 3.25, 3.2, 3.08, 4.2] },
  ];
  masts.forEach((mast, mastIndex) => {
    const platformY = mastIndex === 0 ? 11.8 : 12.4;
    b.pole(V(mast.x, 2.35, 0), V(mast.x, 5.1, 0), 0.25, white, 0.225, 12);
    b.pole(V(mast.x, 5.1, 0), V(mast.x, platformY + 1.1, 0), 0.225, timber, 0.17, 12);
    b.pole(V(mast.x, platformY + 1.1, 0), V(mast.x, mast.top - 5.0, 0), 0.163, timber, 0.11, 10);
    b.pole(V(mast.x, mast.top - 5.0, 0), V(mast.x, mast.top, 0), 0.103, timber, 0.038, 8);
    for (let y = 5.6; y < mast.top - 0.5; y += 2.45) b.ring(V(mast.x, y, 0), y < 13 ? 0.217 : 0.129, 0.023, steel);
    // Open fighting top and trestletrees, visibly much lighter than a crow's nest.
    b.add(new THREE.CylinderGeometry(0.68, 0.60, 0.11, 12), white, new THREE.Matrix4().makeTranslation(mast.x, platformY, 0));
    b.ring(V(mast.x, platformY + 0.55, 0), 0.65, 0.024, steel);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      b.pole(V(mast.x + Math.cos(angle) * 0.65, platformY + 0.04, Math.sin(angle) * 0.65), V(mast.x + Math.cos(angle) * 0.65, platformY + 0.55, Math.sin(angle) * 0.65), 0.019, steel);
    }

    // Seven shrouds per side and the closely spaced rope rungs between them.
    for (const side of [-1, 1]) {
      for (let shroud = 0; shroud < 7; shroud++) {
        const anchor = V(mast.x - 1.8 + shroud * 0.58, 2.65, side * 3.48);
        b.pole(anchor, V(mast.x, platformY + 0.9, side * 0.13), 0.021, standing);
        b.pole(anchor, anchor.clone().add(V(0, 0.35, 0)), 0.058, steel, 0.058, 6);
      }
      for (let rung = 0; rung < 25; rung++) {
        const t = 0.04 + rung * 0.035, y = THREE.MathUtils.lerp(2.65, platformY + 0.9, t), z = side * THREE.MathUtils.lerp(3.48, 0.13, t);
        b.pole(V(mast.x - 1.8 * (1 - t), y, z), V(mast.x + 1.68 * (1 - t), y, z), 0.014, standing, 0.014, 4);
      }
      for (let stay = 0; stay < 3; stay++) {
        b.pole(V(mast.x, mast.top - 1.2 - stay * 3.5, 0), V(mast.x - 3.3 - stay * 0.6, 2.85, side * 3.35), 0.020, standing);
      }
      b.pole(V(mast.x, mast.top - 1.7, 0), V(mast.x, platformY + 0.1, side * 0.62), 0.014, standing);
    }

    mast.yards.forEach((topY, tier) => {
      const width = mast.widths[tier], height = mast.heights[tier], center = V(mast.x, topY, 0.10);
      const left = center.clone().addScaledVector(SPAN, -width * 0.55), right = center.clone().addScaledVector(SPAN, width * 0.55);
      b.pole(left, center, 0.041, timber, 0.092 - tier * 0.004, 7);
      b.pole(center, right, 0.092 - tier * 0.004, timber, 0.041, 7);
      b.pole(V(mast.x, topY + 0.75, 0), left, 0.015, running);
      b.pole(V(mast.x, topY + 0.75, 0), right, 0.015, running);
      const sailPoint = (u: number, v: number) => {
        const arch = Math.sin(Math.PI * u), fill = Math.sin(Math.PI * v);
        // Leech edges pull inward between the yard and clew; the foot rises at its centre.
        const spread = (u - 0.5) * width * (1 + 0.08 * v - 0.067 * fill);
        const footLift = arch * v * v * (0.68 + height * 0.035);
        const bag = Math.pow(arch, 0.83) * fill * (0.70 + height * 0.085);
        const folds = Math.sin(u * Math.PI * 16 + v * 0.8) * arch * fill * 0.034;
        return center.clone().addScaledVector(SPAN, spread).add(V(0, -height * v + footLift - arch * (1 - v) * 0.055, 0)).addScaledVector(WIND, bag + folds + 0.06);
      };
      patch(sailPoint, mastIndex * 2.0 + tier * 0.71, WIND, 32, 16, (u, v) => {
        const belly = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
        const folds = Math.sin(u * Math.PI * 16 + v * 0.8) * Math.sin(Math.PI * v);
        const tone = 0.76 + 0.22 * Math.pow(belly, 0.7) + 0.013 * folds - 0.018 * v;
        return V(tone, tone * 0.998, tone * 0.986);
      });
      // Narrow bolt ropes and curved footropes support the canvas perimeter.
      for (const u of [0, 1]) b.curve(Array.from({ length: 7 }, (_, i) => sailPoint(u, i / 6)), 0.016, running, 10);
      b.curve(Array.from({ length: 13 }, (_, i) => sailPoint(i / 12, 1)), 0.018, running, 18);
      b.curve([left.clone().add(V(0, -0.15, -0.10)), center.clone().add(V(0, -0.46, -0.10)), right.clone().add(V(0, -0.15, -0.10))], 0.015, standing, 14);
      for (const side of [-1, 1]) {
        const clew = sailPoint(side < 0 ? 0 : 1, 1);
        b.pole(clew, V(mast.x - 1.8, Math.max(2.85, topY - height - 3.1), side * 2.7), 0.014, running);
        b.pole(side < 0 ? left : right, V(mast.x - 4.0, Math.max(3, topY - 5.2), side * 2.8), 0.014, standing);
      }
    });
    // Small masthead pennants never exceed the mast's declared height.
    patch((u, v) => V(mast.x - 0.06 - u * 1.28, mast.top - 0.18 - v * (0.26 * (1 - u)), 0.08 + Math.sin(u * 5) * 0.04), 3 + mastIndex, V(0, 0, 1), 10, 2,
      (u) => mastIndex === 1 && u < 0.5 ? V(0.25, 0.36, 0.51) : V(0.92, 0.94, 0.96));
  });

  // Fore-and-aft stays, kept finer than the painted lower masts.
  b.pole(V(-15.5, 22.7, 0), V(-1, 13.5, 0), 0.024, standing);
  b.pole(V(-1, 25.4, 0), V(13.6, 12.7, 0), 0.025, standing);
  b.pole(V(-15.5, 17.7, 0), V(-1, 3.0, 0), 0.022, standing);
  b.pole(V(-1, 19.8, 0), V(13.6, 3.0, 0), 0.023, standing);
  b.pole(V(-15.5, 21.5, 0), V(-26.6, 3.5, 0), 0.022, standing);

  const bowspritRoot = V(25.4, 3.5, 0), bowspritTip = V(39, 7.7, 0);
  b.pole(bowspritRoot, V(29.2, 4.67, 0), 0.19, white, 0.155, 10);
  b.pole(V(29.2, 4.67, 0), bowspritTip, 0.155, timber, 0.047, 9);
  for (const side of [-1, 1]) {
    b.pole(V(26.4, 1.2, side * 1.5), bowspritTip, 0.024, standing);
    b.pole(V(24.1, 3.5, side * 2.0), V(36, 6.8, 0), 0.022, standing);
  }
  b.pole(V(28.2, 4.3, 0), V(28.9, 1.3, 0), 0.055, steel);
  b.pole(V(26.4, 0.9, 0), V(28.9, 1.3, 0), 0.025, standing);
  b.pole(V(28.9, 1.3, 0), bowspritTip, 0.025, standing);

  // Three individually cut triangular headsails with soft belly, no rigid battens.
  const jibs = [
    [V(14.3, 19.5, -0.32), V(38.4, 7.57, -0.32), V(29.8, 9.55, -0.32)],
    [V(14.15, 15.6, 0.20), V(34.6, 6.60, 0.20), V(25.4, 7.10, 0.20)],
    [V(14.4, 11.9, 0.62), V(30.2, 5.55, 0.62), V(20.5, 5.55, 0.62)],
  ];
  for (let sail = 0; sail < jibs.length; sail++) {
    const [a, c, d] = jibs[sail], divisions = 24;
    const jibPoint = (u: number, v: number) => {
      const w = 1 - u - v;
      const point = a.clone().multiplyScalar(w).addScaledVector(c, u).addScaledVector(d, v);
      point.x += 0.16 * 4 * w * v;
      point.y += 0.25 * 4 * u * v;
      point.z += 0.72 * 27 * u * v * w;
      return point;
    };
    const vertexRow: number[] = [];
    for (let row = 0; row <= divisions; row++) {
      vertexRow.push(positions.length / 3);
      const v = row / divisions;
      for (let col = 0; col <= divisions - row; col++) {
        const u = col / divisions, w = 1 - u - v;
        const fullness = 27 * u * v * w;
        const tone = 0.735 + 0.225 * Math.sqrt(Math.max(0, fullness)) - sail * 0.012;
        addVertex(jibPoint(u, v), u, v, fullness, 1.3 + sail * 0.9 + u * 4 + v * 2, V(0, 0, 1), V(tone, tone, tone * 0.992));
      }
    }
    for (let row = 0; row < divisions; row++) for (let col = 0; col < divisions - row; col++) {
      const i = vertexRow[row] + col, below = vertexRow[row + 1] + col;
      indices.push(i, i + 1, below);
      if (col < divisions - row - 1) indices.push(i + 1, below + 1, below);
    }
    b.pole(a, c, 0.021, standing);
    b.curve(Array.from({ length: 9 }, (_, i) => jibPoint(0, i / 8)), 0.016, running, 12);
    b.curve(Array.from({ length: 9 }, (_, i) => jibPoint(i / 8, 1 - i / 8)), 0.016, running, 12);
    for (const side of [-1, 1]) b.pole(d, V(18 + sail * 0.8, 3.1, side * 2.9), 0.017, running);
  }

  // Low mizzen spanker, with white boom and ochre gaff like the reference vessel.
  const lowerA = V(-15.65, 4.7, -0.07), lowerB = V(-26.1, 4.7, -0.07);
  const upperA = V(-15.65, 10.5, -0.07), upperB = V(-23.4, 9.0, -0.07);
  b.pole(lowerA, lowerB, 0.058, white, 0.041, 7);
  b.pole(upperA, upperB, 0.047, timber, 0.034, 7);
  patch((u, v) => upperA.clone().lerp(upperB, u).lerp(lowerA.clone().lerp(lowerB, u), v).add(V(0, 0, -Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.58)), 5, V(0, 0, 1), 24, 14,
    (u, v) => { const tone = 0.77 + 0.18 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI); return V(tone, tone, tone * 0.989); });
  b.pole(upperB, V(-15.5, 15.5, 0), 0.018, running);
  b.pole(lowerB, V(-26.5, 3.2, 1.0), 0.019, running);
  // Small red-and-white ensign flown clear of the aft canvas.
  const ensignRoot = V(-24.0, 11.1, -0.1);
  b.pole(V(-23.4, 9.0, -0.07), ensignRoot, 0.024, timber);
  patch((u, v) => ensignRoot.clone().add(V(-u * 1.65, -v * 0.84 - u * 0.10, Math.sin(u * 7) * 0.15)), 7, V(0, 0, 1), 14, 4,
    (_u, v) => v > 0.5 ? V(0.72, 0.10, 0.12) : V(0.98, 0.98, 0.97));

  b.finish(group);
  const clothGeometry = new THREE.BufferGeometry();
  clothGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  clothGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  clothGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  clothGeometry.setIndex(indices); clothGeometry.computeVertexNormals(); clothGeometry.computeBoundingBox(); clothGeometry.computeBoundingSphere();
  const cloth = new THREE.Mesh(clothGeometry, canvas); cloth.name = "Fourteen white square sails, three jibs and a spanker";
  cloth.castShadow = true; cloth.receiveShadow = true; group.add(cloth);
  const rest = new Float32Array(positions);
  group.userData.squareSails = 14; group.userData.jibs = 3; group.userData.mastHeights = [23.8, 26.2, 25.5];
  return {
    group,
    update(time, storm) {
      const position = clothGeometry.getAttribute("position") as THREE.BufferAttribute;
      const strength = 0.018 + THREE.MathUtils.clamp(storm, 0, 1) * 0.042;
      for (let i = 0; i < position.count; i++) {
        const p = i * 3;
        const flutter = Math.sin(time * (1.35 + storm * 0.55) + phases[i]) * strength * envelopes[i];
        position.setXYZ(i, rest[p] + windDirections[p] * flutter, rest[p + 1] + windDirections[p + 1] * flutter, rest[p + 2] + windDirections[p + 2] * flutter);
      }
      position.needsUpdate = true;
    },
    dispose() {
      group.traverse((object) => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      materials.forEach((material) => material.dispose()); texture.dispose(); group.clear();
    },
  };
}
