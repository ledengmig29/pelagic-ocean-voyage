import * as THREE from "three";

/** A built, closed-hull interpretation of the large Ming junk in the reference. */
export const MING_HULL_LENGTH = 52;
export const MING_HULL_BEAM = 12;
export const MING_HULL_STATIONS: ReadonlyArray<readonly [number, number]> = [
  [-26, 3.5], [-24, 4.45], [-20, 5.2], [-15, 5.72], [-8, 6],
  [0, 6], [8, 5.62], [15, 4.72], [21, 3.15], [26, 1.05],
];

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp;
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);
export function mingHullHalfBeam(x: number) {
  if (x < -26 || x > 26) return 0;
  for (let i = 1; i < MING_HULL_STATIONS.length; i++) {
    const [right, width] = MING_HULL_STATIONS[i];
    const [left, previous] = MING_HULL_STATIONS[i - 1];
    if (x <= right) return THREE.MathUtils.lerp(previous, width, (x - left) / (right - left));
  }
  return MING_HULL_STATIONS[MING_HULL_STATIONS.length - 1][1];
}
export function mingHullDeckHeight(x: number) {
  return 4.8 + 2.7 * smooth(13, 24, -x) + 1.7 * smooth(14, 26, x);
}
/** Same closed hull section used by the renderer's water exclusion. */
export function mingHullHalfWidthAtHeight(x: number, y: number) {
  if (y < -4.4) return 0;
  const factor = y <= 0
    ? 0.12 + 0.74 * Math.sqrt(clamp((y + 4.4) / 4.4, 0, 1))
    : 0.86 + 0.14 * clamp(y / mingHullDeckHeight(x), 0, 1);
  return mingHullHalfBeam(x) * factor;
}

function canvasTexture(width: number, height: number, paint: (c: CanvasRenderingContext2D) => void) {
  // The fallback also lets geometry validation run without a browser or WebGL context.
  if (typeof document === "undefined") {
    const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) paint(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const noise = (a: number, b = 0) => {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

function timberTexture() {
  const texture = canvasTexture(512, 512, (c) => {
    c.fillStyle = "#baa17e";
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1600; i++) {
      const y = noise(i, 2) * 512;
      const x = noise(i, 3) * 512;
      c.strokeStyle = i % 3 ? `rgba(64,35,15,${0.02 + noise(i, 4) * 0.09})` : "rgba(255,229,185,.08)";
      c.lineWidth = 0.35 + noise(i, 5) * 0.65;
      c.beginPath();
      c.moveTo(x - 90, y);
      c.bezierCurveTo(x - 30, y - 1.5, x + 55, y + 2.4, x + 170, y - 0.6);
      c.stroke();
    }
    for (let y = 0; y < 512; y += 64) {
      c.fillStyle = "rgba(32,20,12,.4)";
      c.fillRect(0, y, 512, 1.4);
      const joint = (y / 64 % 3) * 170 + 55;
      c.fillRect(joint, y, 1.2, 64);
      c.fillStyle = "rgba(35,24,16,.55)";
      for (const x of [joint - 5, joint + 6]) for (const dy of [7, 56]) {
        c.beginPath(); c.arc(x, y + dy, 1.1, 0, Math.PI * 2); c.fill();
      }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Original ink dragon: a coiled body, scales, claws, whiskers, mane and horns. */
function dragonRoundel(c: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  c.save(); c.translate(cx, cy); c.scale(r / 100, r / 100);
  c.strokeStyle = "#543626"; c.fillStyle = "#543626";
  c.lineWidth = 2.2;
  for (const radius of [97, 90, 83]) { c.beginPath(); c.arc(0, 0, radius, 0, Math.PI * 2); c.stroke(); }
  for (let i = 0; i < 36; i++) {
    const a = i * Math.PI / 18;
    c.beginPath(); c.arc(Math.cos(a) * 86.5, Math.sin(a) * 86.5, 2.3, 0, Math.PI * 2); c.stroke();
  }
  c.lineWidth = 10;
  c.beginPath(); c.moveTo(39, -36);
  c.bezierCurveTo(2, -81, -65, -52, -61, -3);
  c.bezierCurveTo(-58, 52, 24, 65, 47, 28);
  c.bezierCurveTo(79, -18, 16, -34, -9, -6);
  c.bezierCurveTo(-34, 24, 3, 42, 23, 20); c.stroke();
  c.strokeStyle = "#c79c63"; c.lineWidth = 3;
  c.beginPath(); c.moveTo(37, -37); c.bezierCurveTo(0, -74, -59, -50, -56, -4);
  c.bezierCurveTo(-50, 46, 19, 56, 41, 27); c.bezierCurveTo(69, -10, 19, -27, -3, -6); c.stroke();
  c.strokeStyle = "#543626"; c.lineWidth = 2.4;
  for (let i = 0; i < 25; i++) {
    const a = -0.5 + i * 0.2;
    const x = Math.cos(a) * (60 - i * 0.8), y = Math.sin(a) * (50 - i * 0.55);
    c.beginPath(); c.moveTo(x - 4, y - 3); c.lineTo(x + 2, y + 2); c.lineTo(x + 5, y - 3); c.stroke();
  }
  // Curled muzzle and strong forehead, with negative-space eye.
  c.beginPath(); c.moveTo(24, -46); c.lineTo(27, -67); c.lineTo(42, -62); c.lineTo(48, -50);
  c.lineTo(67, -44); c.lineTo(69, -34); c.lineTo(51, -30); c.lineTo(39, -35); c.closePath(); c.fill();
  c.fillStyle = "#e0b782"; c.beginPath(); c.arc(43, -51, 2.4, 0, Math.PI * 2); c.fill();
  for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(31 + s * 6, -61); c.lineTo(21 + s * 11, -77); c.lineTo(31 + s * 14, -81); c.stroke();
    c.beginPath(); c.moveTo(57, -36); c.bezierCurveTo(75, -30, 84, -57 + s * 7, 69, -61 + s * 8); c.stroke();
  }
  for (const [x, y, sign] of [[-47, -25, -1], [-31, 40, -1], [39, 26, 1], [17, -21, 1]]) {
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + sign * 12, y - 14); c.lineTo(x + sign * 23, y - 9); c.stroke();
    for (let claw = -1; claw <= 1; claw++) {
      c.beginPath(); c.moveTo(x + sign * 23, y - 9); c.lineTo(x + sign * (27 + claw * 3), y - 20 + claw * 6); c.stroke();
    }
  }
  c.restore();
}

function sailTexture(index: number) {
  return canvasTexture(512, 768, (c) => {
    const gradient = c.createLinearGradient(0, 0, 512, 0);
    gradient.addColorStop(0, "#ad7647"); gradient.addColorStop(0.36, "#d6b17a"); gradient.addColorStop(1, "#b47d4e");
    c.fillStyle = gradient; c.fillRect(0, 0, 512, 768);
    for (let i = 0; i < 3400; i++) {
      const x = noise(i, 6) * 512, y = noise(i, 7) * 768;
      c.fillStyle = i % 2 ? "rgba(62,32,12,.07)" : "rgba(255,229,180,.1)";
      c.fillRect(x, y, 0.5 + noise(i, 8) * 3, 0.6);
    }
    c.lineWidth = 1.4; c.strokeStyle = "rgba(77,45,22,.29)";
    for (let x = 72; x < 512; x += 84) {
      c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x - 9, 210, x + 10, 580, x, 768); c.stroke();
      c.setLineDash([2, 4]); c.beginPath(); c.moveTo(x + 3, 0); c.lineTo(x + 3, 768); c.stroke(); c.setLineDash([]);
    }
    c.strokeStyle = "rgba(70,36,15,.27)";
    for (let y = 7; y < 768; y += 85) { c.beginPath(); c.moveTo(0, y); c.lineTo(512, y); c.stroke(); }
    if (index === 2) dragonRoundel(c, 270, 377, 123);
    if (index === 1 || index === 3) {
      c.fillStyle = "#563e2c"; c.strokeStyle = "#69492d"; c.lineWidth = 3;
      c.textAlign = "center"; c.textBaseline = "middle";
      c.font = 'bold 47px "Noto Serif SC", "SimSun", serif';
      ["大", "明", "水", "師"].forEach((character, i) => {
        const y = 246 + i * 87;
        c.beginPath(); c.ellipse(278, y, 32, 35, 0, 0, Math.PI * 2); c.stroke(); c.fillText(character, 278, y + 1);
      });
    }
    c.strokeStyle = "rgba(67,36,17,.6)"; c.lineWidth = 9; c.strokeRect(3, 3, 506, 762);
  });
}

function material(color: string, map?: THREE.Texture, roughness = 0.7, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, ...(map ? { map } : {}), roughness, metalness });
}

/** Geometry is combined by material, preserving UVs and normals. */
class ShipBuilder {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geometry: THREE.BufferGeometry, material: THREE.Material, matrix = new THREE.Matrix4()) {
    const transformed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    transformed.applyMatrix4(matrix);
    if (!transformed.getAttribute("normal")) transformed.computeVertexNormals();
    if (!transformed.getAttribute("uv")) transformed.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(transformed.getAttribute("position").count * 2), 2));
    const bucket = this.buckets.get(material) ?? [];
    bucket.push(transformed); this.buckets.set(material, bucket); geometry.dispose();
  }
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material, rot = 0) {
    this.add(new THREE.BoxGeometry(sx, sy, sz), mat, new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), V(1, 1, 1)));
  }
  pole(a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: THREE.Material, top = radius, sides = 7) {
    const delta = b.clone().sub(a);
    this.add(new THREE.CylinderGeometry(top, radius, delta.length(), sides), mat,
      new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), delta.normalize()), V(1, 1, 1)));
  }
  tube(points: THREE.Vector3[], radius: number, mat: THREE.Material, segments = 20) {
    this.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 5, false), mat);
  }
  sphere(x: number, y: number, z: number, r: number, mat: THREE.Material) {
    this.add(new THREE.SphereGeometry(r, 8, 6), mat, new THREE.Matrix4().makeTranslation(x, y, z));
  }
  finish(group: THREE.Group) {
    for (const [mat, items] of this.buckets) {
      const geometry = new THREE.BufferGeometry();
      for (const [name, size] of [["position", 3], ["normal", 3], ["uv", 2]] as const) {
        const values = new Float32Array(items.reduce((sum, item) => sum + item.getAttribute(name).array.length, 0));
        let offset = 0;
        for (const item of items) { const array = item.getAttribute(name).array; values.set(array, offset); offset += array.length; }
        geometry.setAttribute(name, new THREE.BufferAttribute(values, size));
      }
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, mat); mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh); items.forEach((item) => item.dispose());
    }
    this.buckets.clear();
  }
}

function surface(positions: number[], indices: number[], uv: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function buildHull(builder: ShipBuilder, hull: THREE.Material, deck: THREE.Material, trim: THREE.Material, red: THREE.Material, black: THREE.Material) {
  const count = 130, rings = 26;
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  // A continuous closed shell: port, starboard, flat keel, deck and both transoms.
  for (let side = 0; side < 2; side++) {
    for (let ix = 0; ix <= count; ix++) {
      const x = -26 + 52 * ix / count;
      for (let iy = 0; iy <= rings; iy++) {
        const y = -4.4 + (mingHullDeckHeight(x) + 4.4) * iy / rings;
        positions.push(x, y, (side === 0 ? 1 : -1) * mingHullHalfWidthAtHeight(x, y)); uv.push(x / 11, y / 4);
        if (ix < count && iy < rings) {
          const a = side * (count + 1) * (rings + 1) + ix * (rings + 1) + iy, b = a + rings + 1;
          if (side === 0) indices.push(a, b, a + 1, b, b + 1, a + 1);
          else indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
  }
  const sideOffset = (count + 1) * (rings + 1);
  for (let ix = 0; ix < count; ix++) {
    const a = ix * (rings + 1), b = (ix + 1) * (rings + 1);
    indices.push(a, a + sideOffset, b, b, a + sideOffset, b + sideOffset);
  }
  for (const ix of [0, count]) for (let iy = 0; iy < rings; iy++) {
    const a = ix * (rings + 1) + iy, b = a + sideOffset;
    if (ix === 0) indices.push(a, a + 1, b, b, a + 1, b + 1);
    else indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  builder.add(surface(positions, indices, uv), hull);
  const dp: number[] = [], duv: number[] = [], di: number[] = [];
  for (let ix = 0; ix <= count; ix++) {
    const x = -26 + 52 * ix / count;
    for (const sign of [-1, 1]) { dp.push(x, mingHullDeckHeight(x), sign * mingHullHalfBeam(x)); duv.push(x / 9, sign * mingHullHalfBeam(x) / 3); }
    if (ix < count) { const a = ix * 2; di.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  builder.add(surface(dp, di, duv), deck);
  // Fine caulk seams are geometry so the planking survives texture minification
  // in the ship approach shot; butt joints are staggered like a laid timber deck.
  let plank = 0;
  for (let z = -5.7; z <= 5.7; z += .44, plank++) {
    const points: THREE.Vector3[] = [];
    for (let x = -25.9; x <= 25.9; x += .4) {
      if (Math.abs(z) < mingHullHalfBeam(x) - .14) points.push(V(x, mingHullDeckHeight(x) + .026, z));
    }
    if (points.length > 1) {
      const seamPositions: number[] = [], seamUv: number[] = [], seamIndices: number[] = [];
      points.forEach((point, i) => {
        seamPositions.push(point.x, point.y, point.z - .019, point.x, point.y, point.z + .019);
        seamUv.push(0, i, 1, i);
        if (i < points.length - 1) { const a = i * 2; seamIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      });
      builder.add(surface(seamPositions, seamIndices, seamUv), black);
    }
    for (let x = -25 + (plank % 3) * 1.8; x < 25; x += 5.4) {
      if (Math.abs(z) + .48 >= mingHullHalfBeam(x) - .15) continue;
      builder.box(x, mingHullDeckHeight(x) + .035, z + .22, .033, .014, .42, black);
      for (const dx of [-.12, .12]) for (const dz of [.08, .35]) {
        builder.box(x + dx, mingHullDeckHeight(x + dx) + .039, z + dz, .039, .014, .039, black);
      }
    }
  }
  // Long wale mouldings, planking seams and bright brass rubbing strakes.
  for (const side of [-1, 1]) {
    for (const y of [-2.5, -1.05, 0.1, 2.25, 3.5]) {
      const points = Array.from({ length: 105 }, (_, i) => {
        const x = -26 + i * .5; return V(x, y, side * (mingHullHalfWidthAtHeight(x, y) + .035));
      });
      builder.tube(points, y === .1 || y === 3.5 ? .12 : .045, y === .1 ? red : black, 104);
    }
    for (const offset of [0, .24]) {
      const points = Array.from({ length: 105 }, (_, i) => {
        const x = -26 + i * .5; return V(x, mingHullDeckHeight(x) + offset, side * (mingHullHalfBeam(x) + .05));
      });
      builder.tube(points, offset ? .045 : .18, offset ? trim : red, 104);
    }
    // Bands and fasteners on the transom and upper clinker edges.
    for (let x = -24; x <= 24; x += 2) {
      const y = mingHullDeckHeight(x);
      builder.box(x, y - .32, side * (mingHullHalfBeam(x) + .025), .055, .48, .075, trim);
      builder.sphere(x, y - .2, side * (mingHullHalfBeam(x) + .08), .045, trim);
    }
  }
  builder.box(-26.1, 3.6, 0, .24, .22, 6.7, trim);
  builder.box(26.08, 5.7, 0, .24, .2, 2.05, trim);
}

function railing(builder: ShipBuilder, points: THREE.Vector3[], timber: THREE.Material, gold: THREE.Material) {
  const low = points.map((p) => p.clone().add(V(0, .45, 0)));
  const high = points.map((p) => p.clone().add(V(0, 1.25, 0)));
  builder.tube(high, .09, timber, points.length * 2);
  builder.tube(low, .055, gold, points.length * 2);
  for (let i = 0; i < points.length; i++) {
    const p = points[i]; builder.pole(p, p.clone().add(V(0, 1.28, 0)), .07, timber);
    builder.sphere(p.x, p.y + 1.31, p.z, .10, gold);
    if (i < points.length - 1) {
      const next = points[i + 1];
      builder.pole(p.clone().add(V(0, .49, 0)), next.clone().add(V(0, 1.17, 0)), .032, gold);
      builder.pole(p.clone().add(V(0, 1.17, 0)), next.clone().add(V(0, .49, 0)), .032, gold);
    }
  }
}

function roof(builder: ShipBuilder, x: number, y: number, sx: number, sz: number, mat: THREE.Material, edge: THREE.Material) {
  const pos: number[] = [], uv: number[] = [], indices: number[] = [], n = 20, m = 18;
  const height = (u: number, v: number) => y + .95 * (1 - Math.pow(Math.abs(v), .8)) - .1 * Math.abs(u) + .39 * Math.pow(Math.abs(v), 8) + .24 * Math.pow(Math.abs(u * v), 4);
  for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
    const u = 2 * i / n - 1, v = 2 * j / m - 1;
    pos.push(x + u * sx / 2, height(u, v), v * sz / 2); uv.push(i / n * 4, j / m * 2);
    if (i < n && j < m) { const a = i * (m + 1) + j; indices.push(a, a + 1, a + m + 1, a + 1, a + m + 2, a + m + 1); }
  }
  builder.add(surface(pos, indices, uv), mat);
  for (const side of [-1, 1]) {
    const points = Array.from({ length: 21 }, (_, i) => { const u = i / 10 - 1; return V(x + u * sx / 2, height(u, side), side * sz / 2); });
    builder.tube(points, .085, edge, 30);
  }
  for (let i = 0; i <= 20; i++) {
    const u = i / 10 - 1;
    const points = Array.from({ length: 19 }, (_, j) => { const v = j / 9 - 1; return V(x + u * sx / 2, height(u, v) + .04, v * sz / 2); });
    builder.tube(points, .033, edge, 20);
  }
  builder.pole(V(x - sx / 2, y + .98, 0), V(x + sx / 2, y + .98, 0), .09, edge);
}

type MovingCloth = { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>; base: Float32Array; kind: "sail" | "flag"; phase: number };

export function createMingWarship() {
  const group = new THREE.Group(); group.name = "Ming imperial war junk";
  const b = new ShipBuilder(), textures = new Set<THREE.Texture>(), materials = new Set<THREE.Material>();
  const grain = timberTexture(); textures.add(grain);
  const mk = (color: string, textured = true, roughness = .73, metalness = .025) => {
    const m = material(color, textured ? grain : undefined, roughness, metalness); materials.add(m); return m;
  };
  const hull = mk("#39251d"), deck = mk("#d9b384"), mahogany = mk("#753b2b"), red = mk("#81312b");
  const gold = mk("#d6b06a", false, .37, .65), ivory = mk("#c4b797", false, .68);
  const black = mk("#1e211d", false, .8), gunmetal = mk("#454c43", false, .37, .7);
  const rope = mk("#6d6049", false, .93), bamboo = mk("#6b4930", true, .7), roofmat = mk("#283d39", true, .72);
  roofmat.side = THREE.DoubleSide;
  const interior = mk("#090e0e", false, .95);
  buildHull(b, hull, deck, gold, red, black);

  // Closed gun-port shutters with pale surrounds: there is never a hole into the sea.
  const gunport = (x: number, y: number, side: number, width = 1.06) => {
    const z = side * (mingHullHalfWidthAtHeight(x, y) + .06);
    b.box(x, y, z, width, .76, .09, interior);
    for (const dx of [-width / 2, width / 2]) b.box(x + dx, y, z + side * .06, .13, .96, .13, ivory);
    for (const dy of [-.42, .42]) b.box(x, y + dy, z + side * .07, width + .14, .13, .14, ivory);
    b.pole(V(x, y, z), V(x, y + .045, z + side * 1.02), .15, gunmetal, .105, 12);
    b.pole(V(x, y + .045, z + side * .94), V(x, y + .046, z + side * 1.07), .145, gold, .145, 12);
    // Dark recessed muzzle, facing the correct side.
    b.pole(V(x, y + .046, z + side * 1.073), V(x, y + .046, z + side * 1.079), .09, interior, .09, 12);
  };
  for (const side of [-1, 1]) {
    for (let x = -23; x <= 22; x += 2.8) gunport(x, 1.15, side);
    for (let x = -23; x <= -13; x += 2.6) gunport(x, 4.1, side, .88);
    const points = Array.from({ length: 31 }, (_, i) => {
      const x = -25.5 + i * 51 / 30; return V(x, mingHullDeckHeight(x) + .18, side * (mingHullHalfBeam(x) - .15));
    });
    railing(b, points, red, gold);
  }
  railing(b, [-3, -2, -1, 0, 1, 2, 3].map((z) => V(-25.7, 7.65, z)), red, gold);
  // High transom windows, galleries, broad stern rudder and iron straps.
  for (const z of [-2.5, -1.5, -.5, .5, 1.5, 2.5]) {
    b.box(-26.075, 5.3, z, .10, 1.2, .7, interior);
    for (const dz of [-.39, .39]) b.box(-26.14, 5.3, z + dz, .08, 1.45, .08, gold);
    for (const dy of [-.66, 0, .66]) b.box(-26.14, 5.3 + dy, z, .08, .07, .84, gold);
  }
  b.box(-26.32, -.6, 0, .8, 6.4, .35, mahogany);
  b.box(-26.55, -2.7, 0, 2.0, 3.0, .45, hull);
  for (const y of [-2.8, -1, .7]) b.box(-26.77, y, 0, .15, .14, .53, gunmetal);

  // Stern gallery: two enclosed levels, carved galleries and a sweeping tiled roof.
  b.box(-20.5, 8.9, 0, 8.5, 3.2, 7.0, mahogany);
  b.box(-20.5, 10.55, 0, 9.2, .3, 8.0, deck);
  for (const side of [-1, 1]) {
    for (let x = -24; x <= -17; x += 1.16) {
      b.box(x, 9.0, side * 3.53, .87, 1.43, .075, interior);
      for (const dx of [-.45, .45]) b.box(x + dx, 9.0, side * 3.58, .07, 1.7, .08, gold);
      for (const dy of [-.74, 0, .74]) b.box(x, 9 + dy, side * 3.59, .95, .06, .08, gold);
      b.box(x, 9.0, side * 3.61, .045, 1.5, .08, gold);
    }
    railing(b, Array.from({ length: 9 }, (_, i) => V(-24.7 + i * 1.05, 10.7, side * 3.87)), red, gold);
  }
  b.box(-21.1, 11.82, 0, 5.6, 2.3, 4.5, red);
  for (const side of [-1, 1]) for (let x = -23.2; x <= -19; x += 1.4) {
    b.box(x, 11.95, side * 2.29, .95, 1.3, .08, interior);
    for (const dy of [-.67, 0, .67]) b.box(x, 11.95 + dy, side * 2.34, 1.03, .075, .08, gold);
    for (const dx of [-.48, 0, .48]) b.box(x + dx, 11.95, side * 2.34, .06, 1.38, .08, gold);
  }
  roof(b, -21.1, 13.0, 7.4, 6.4, roofmat, gold);
  // Eave brackets, bright corner posts, and a small lookout atop the stern pavilion.
  for (const x of [-23.7, -18.5]) for (const side of [-1, 1]) {
    b.pole(V(x, 10.7, side * 2.5), V(x, 13.3, side * 2.5), .12, red);
    b.pole(V(x, 12.5, side * 2.5), V(x, 13.05, side * 3.0), .10, gold);
  }
  // Symmetric flights with independent timber treads and brass handrails.
  for (const z of [-3.2, 3.2]) {
    for (let i = 0; i < 10; i++) b.box(-13.8 - i * .34, 5.12 + i * .55, z, .45, .12, 1.45, deck);
    for (const side of [-1, 1]) {
      b.pole(V(-13.5, 5.45, z + side * .73), V(-17.1, 10.95, z + side * .73), .065, gold);
      for (let i = 0; i < 6; i++) b.pole(V(-13.8 - i * .6, 5.12 + i * .95, z + side * .73), V(-13.8 - i * .6, 6.16 + i * .95, z + side * .73), .045, red);
    }
  }

  // Deck furniture: planked hatch coamings, inset gratings and cross beams.
  for (const [x, z, sx, sz] of [[-9, 0, 3.4, 3], [5, 0, 3.2, 3.1], [15.5, 0, 2.5, 2.4]]) {
    const y = mingHullDeckHeight(x);
    b.box(x, y + .21, z, sx, .4, sz, mahogany); b.box(x, y + .43, z, sx - .35, .05, sz - .35, interior);
    for (let u = -.5 * sx + .3; u < sx * .5 - .1; u += .27) b.box(x + u, y + .47, z, .085, .065, sz - .32, deck);
    for (let v = -.5 * sz + .3; v < sz * .5 - .1; v += .35) b.box(x, y + .49, z + v, sx - .31, .05, .08, deck);
  }
  const capstan = (x: number, z: number) => {
    const y = mingHullDeckHeight(x);
    b.pole(V(x, y + .08, z), V(x, y + 1.3, z), .37, mahogany, .44, 12);
    b.pole(V(x, y + .14, z), V(x, y + .3, z), .57, gunmetal, .57, 12);
    b.pole(V(x, y + 1.16, z), V(x, y + 1.35, z), .53, gold, .53, 12);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; b.pole(V(x - Math.cos(a) * 1.22, y + 1.24, z - Math.sin(a) * 1.22), V(x + Math.cos(a) * 1.22, y + 1.24, z + Math.sin(a) * 1.22), .065, bamboo); }
  };
  capstan(21.5, 0); capstan(-11.5, 0);
  // Working deck details are kept clear of the central hatchways and gun lanes.
  const barrel = (x: number, z: number, scale = 1) => {
    const y = mingHullDeckHeight(x);
    const profile = [[.37, 0], [.43, .1], [.49, .38], [.5, .68], [.46, 1.04], [.37, 1.22]];
    const geometry = new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r * scale, h * scale)), 16);
    b.add(geometry, mahogany, new THREE.Matrix4().makeTranslation(x, y + .04, z));
    b.pole(V(x, y + .055, z), V(x, y + .085, z), .37 * scale, bamboo, .37 * scale, 16);
    b.pole(V(x, y + 1.21 * scale, z), V(x, y + 1.25 * scale, z), .365 * scale, deck, .365 * scale, 16);
    for (const h of [.14, .38, .94, 1.12]) {
      const radius = (h < .3 || h > 1.05 ? .433 : .494) * scale;
      const points = Array.from({ length: 25 }, (_, i) => { const a = i / 24 * Math.PI * 2; return V(x + Math.cos(a) * radius, y + .04 + h * scale, z + Math.sin(a) * radius); });
      b.tube(points, .037 * scale, gunmetal, 28);
    }
    for (let stave = 0; stave < 16; stave++) {
      const a = stave / 16 * Math.PI * 2;
      b.tube(profile.map(([r, h]) => V(x + Math.cos(a) * (r + .006) * scale, y + .04 + h * scale, z + Math.sin(a) * (r + .006) * scale)), .012, black, 10);
    }
    b.box(x, y + 1.255 * scale, z, .63 * scale, .017, .025, black);
  };
  for (const side of [-1, 1]) {
    for (const [x, z, scale] of [[-3.3, 4.65, 1], [-4.2, 4.45, .82], [9.0, 3.9, .88], [-12, 4.2, .8]]) barrel(x, z * side, scale);
    for (const x of [-5.3, .0, 12.9]) {
      const z = side * (mingHullHalfBeam(x) - 1.12), y = mingHullDeckHeight(x) + .1;
      const coil = Array.from({ length: 121 }, (_, i) => {
        const t = i / 120, a = t * Math.PI * 9, r = .11 + .53 * t;
        return V(x + Math.cos(a) * r, y + .018 * t, z + Math.sin(a) * r);
      });
      b.tube(coil, .043, rope, 120);
      b.tube([coil[coil.length - 1], V(x + .9, y, z), V(x + 1.15, y + .28, z + side * .3)], .043, rope, 16);
      // Cross-headed cleats and bollards associated with the nearby lines.
      b.pole(V(x + 1.15, y, z + side * .3), V(x + 1.15, y + .65, z + side * .3), .12, mahogany);
      b.pole(V(x + .82, y + .55, z + side * .3), V(x + 1.48, y + .55, z + side * .3), .08, gold);
    }
    // Two stowed bamboo spars with lashings just inboard of each gunwale.
    for (const offset of [0, .17]) {
      const z = side * (5.42 - offset);
      b.pole(V(-2.2, 5.05, z), V(3.9, 5.05, z), .068, bamboo);
      for (const x of [-1.1, 2.8]) b.pole(V(x, 5.12, z - .1), V(x, 5.12, z + .1), .035, rope);
    }
  }
  for (const x of [-10, 7, 17]) for (const side of [-1, 1]) {
    const z = side * (mingHullHalfBeam(x) - 1.05), y = mingHullDeckHeight(x);
    // Deck gun carriages, axle wheels and trunnions.
    b.box(x, y + .4, z, 1.1, .55, .85, mahogany);
    for (const dx of [-.4, .4]) for (const dz of [-.48, .48]) b.pole(V(x + dx, y + .25, z + dz - .06), V(x + dx, y + .25, z + dz + .06), .24, black, .24, 10);
    b.pole(V(x, y + .86, z - side * .52), V(x, y + 1.02, z + side * 1.02), .19, gunmetal, .12, 12);
  }
  for (const side of [-1, 1]) {
    // Forged anchors suspended beside the bow, with a wood stock and curved flukes.
    const x = 23.4, z = side * 3.2;
    b.pole(V(x, 6.6, z), V(x, 2.7, z), .1, gunmetal);
    b.pole(V(x - .85, 5.8, z), V(x + .85, 5.8, z), .13, mahogany);
    b.tube([V(x - 1.05, 3.4, z), V(x - .8, 2.72, z), V(x, 2.6, z), V(x + .8, 2.72, z), V(x + 1.05, 3.4, z)], .13, gunmetal);
    b.pole(V(x - 1.05, 3.4, z), V(x - .68, 3.32, z), .2, gunmetal, .025);
    b.pole(V(x + 1.05, 3.4, z), V(x + .68, 3.32, z), .2, gunmetal, .025);
    b.tube([V(21.5, 7.3, 0), V(23.1, 7.0, z), V(x, 6.6, z)], .07, rope);
  }

  const moving: MovingCloth[] = [];
  const masts = [
    { x: -16.2, top: 22.0, base: 11.1, width: 7.4, height: 9.3, yaw: -.11 },
    { x: -7.0, top: 24.1, base: 7.1, width: 9.2, height: 14.6, yaw: .06 },
    { x: 2.0, top: 25.35, base: 6.65, width: 10.6, height: 16.0, yaw: -.12 },
    { x: 11.8, top: 23.1, base: 7.0, width: 9.0, height: 13.7, yaw: .08 },
    { x: 20.2, top: 18.8, base: 8.0, width: 6.6, height: 8.7, yaw: -.1 },
  ];
  masts.forEach((mast, mastIndex) => {
    const y0 = mingHullDeckHeight(mast.x);
    b.pole(V(mast.x, y0, 0), V(mast.x + .38, mast.top, 0), .26, bamboo, .09, 14);
    b.box(mast.x, y0 + .2, 0, 1.0, .4, 1.0, mahogany);
    for (const sign of [-1, 1]) b.pole(V(mast.x, y0 + 1.2, 0), V(mast.x + sign * .67, y0 + .1, 0), .14, mahogany);
    const mastPoint = (u: number, v: number) => {
      const width = mast.width * (.81 + .19 * v);
      const localX = (u - .46) * width + .6 * v;
      const y = mast.base + v * mast.height + (u - .46) * (.3 + 1.3 * v);
      const bulge = Math.sin(u * Math.PI) * (.44 + Math.sin(v * Math.PI) * .46);
      return V(mast.x + Math.cos(mast.yaw) * localX, y, -Math.sin(mast.yaw) * localX + bulge);
    };
    const p: number[] = [], uv: number[] = [], index: number[] = [], cols = 24, rows = 36;
    for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
      const u = col / cols, v = row / rows, point = mastPoint(u, v);
      // Cloth sags gently between bamboo battens while retaining a hard junk outline.
      point.z += .11 * Math.sin(v * Math.PI * 9) * Math.sin(u * Math.PI);
      p.push(point.x, point.y, point.z); uv.push(u, v);
      if (col < cols && row < rows) { const a = row * (cols + 1) + col; index.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1); }
    }
    const texture = sailTexture(mastIndex); textures.add(texture);
    const cloth = new THREE.MeshStandardMaterial({ map: texture, color: "#fff4da", roughness: .9, side: THREE.DoubleSide, metalness: 0, emissive: "#412c12", emissiveIntensity: .06 });
    materials.add(cloth);
    const geometry = surface(p, index, uv);
    const mesh = new THREE.Mesh(geometry, cloth); mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.name = `Fully battened junk sail ${mastIndex + 1}`; group.add(mesh);
    moving.push({ mesh, base: new Float32Array(p), kind: "sail", phase: mastIndex * 1.2 });
    for (let rib = 0; rib <= 9; rib++) {
      const points = Array.from({ length: 13 }, (_, col) => mastPoint(col / 12, rib / 9));
      b.tube(points, rib === 0 || rib === 9 ? .085 : .052, bamboo, 18);
      for (const u of [0, .46, 1]) {
        const pt = mastPoint(u, rib / 9); b.sphere(pt.x, pt.y, pt.z, .085, rope);
      }
    }
    for (const u of [0, 1]) b.tube(Array.from({ length: 20 }, (_, i) => mastPoint(u, i / 19)), .035, rope, 25);
    // Halyards / lifts connect to spars; sheets fan from each batten to the deck.
    const mastHead = V(mast.x + .3, mast.top - .7, 0);
    for (const u of [0, .47, 1]) b.pole(mastHead, mastPoint(u, 1), .023, rope, .023, 5);
    for (const side of [-1, 1]) {
      for (const dx of [-2.7, 2.7]) {
        const xx = clamp(mast.x + dx, -25, 25), anchor = V(xx, mingHullDeckHeight(xx) + .32, side * (mingHullHalfBeam(xx) - .5));
        b.pole(V(mast.x + .26, mast.top - 2.3, 0), anchor, .031, rope, .031, 5);
        // Seized deadeye blocks at every standing stay.
        b.sphere(anchor.x, anchor.y + .3, anchor.z, .13, mahogany);
      }
      const anchor = V(mast.x + 1.8, y0 + .4, side * Math.max(1, mingHullHalfBeam(mast.x) - .8));
      for (let rib = 1; rib <= 8; rib += 2) b.pole(mastPoint(1, rib / 9), anchor, .019, rope, .019, 5);
    }
    // Mast climbing ratlines on the visible shrouds.
    for (let rung = 0; rung < 13; rung++) {
      const t = .1 + rung * .043;
      const y = THREE.MathUtils.lerp(y0 + .5, mast.top - 2.3, t), spread = 2.7 * (1 - t);
      b.pole(V(mast.x - spread, y, -3.8 * (1 - t)), V(mast.x + spread, y, -3.8 * (1 - t)), .018, rope, .018, 4);
    }
    // Long red command pennants are small enough to stay within the bottle crown.
    const flagGeo = new THREE.PlaneGeometry(2.7, .55, 14, 3);
    flagGeo.translate(mast.x + 1.67, mast.top - .42, .04);
    const flagMaterial = mk(mastIndex === 2 ? "#b1442c" : "#942f27", false, .88); flagMaterial.side = THREE.DoubleSide;
    const flag = new THREE.Mesh(flagGeo, flagMaterial); group.add(flag);
    moving.push({ mesh: flag, base: new Float32Array(flagGeo.getAttribute("position").array), kind: "flag", phase: mastIndex * .9 });
  });
  // Large painted eyes on each side of the squared Chinese bow.
  for (const side of [-1, 1]) {
    const x = 24.6, y = 4.45, z = side * (mingHullHalfWidthAtHeight(x, y) + .09);
    b.pole(V(x, y, z), V(x, y, z + side * .1), .4, ivory, .4, 20);
    b.pole(V(x + .05, y, z + side * .11), V(x + .05, y, z + side * .13), .18, black, .18, 16);
    b.pole(V(x + .08, y + .05, z + side * .14), V(x + .08, y + .05, z + side * .145), .055, ivory, .055, 10);
  }
  b.finish(group);
  group.userData.hullLength = MING_HULL_LENGTH; group.userData.hullBeam = MING_HULL_BEAM;
  group.userData.waterline = 0; group.userData.closedDeck = true; group.userData.sailCount = 5;
  return {
    group,
    update(time: number, storm: number) {
      for (const cloth of moving) {
        const positions = cloth.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
        const uv = cloth.mesh.geometry.getAttribute("uv") as THREE.BufferAttribute;
        for (let i = 0; i < positions.count; i++) {
          const u = uv.getX(i), v = uv.getY(i), j = i * 3;
          const displacement = cloth.kind === "sail"
            ? Math.sin(v * Math.PI * 9) * Math.sin(u * Math.PI) * Math.sin(time * (1.2 + storm) + u * 5 + cloth.phase) * (.035 + storm * .085)
            : Math.sin(time * (2 + storm * 2) - u * 7 + cloth.phase) * u * (.10 + storm * .2);
          positions.setXYZ(i, cloth.base[j], cloth.base[j + 1], cloth.base[j + 2] + displacement);
        }
        positions.needsUpdate = true;
        // Small cloth motions retain the accurate rest-shape normals and avoid per-frame CPU rebuilds.
      }
    },
    dispose() {
      group.traverse((object) => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      materials.forEach((m) => m.dispose()); textures.forEach((t) => t.dispose()); group.clear();
    },
  };
}
