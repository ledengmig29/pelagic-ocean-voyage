import * as THREE from "three";
import { createTallShipRig } from "./tall-ship-rig";
import { tallShipDeckHeight, tallShipHalfBeam, tallShipHalfWidthAtHeight } from "./tall-ship-profile";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A small geometry accumulator keeps the detailed deck to a handful of draws. */
class Builder {
  private buckets = new Map<THREE.Material, { geometries: THREE.BufferGeometry[]; cast: boolean }>();
  add(geometry: THREE.BufferGeometry, material: THREE.Material, matrix = new THREE.Matrix4(), cast = true) {
    const baked = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    baked.applyMatrix4(matrix);
    if (!baked.getAttribute("normal")) baked.computeVertexNormals();
    if (!baked.getAttribute("uv")) baked.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(baked.getAttribute("position").count * 2), 2));
    const bucket = this.buckets.get(material) ?? { geometries: [], cast };
    bucket.geometries.push(baked); this.buckets.set(material, bucket); geometry.dispose();
  }
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, mat: THREE.Material, cast = true) {
    this.add(new THREE.BoxGeometry(sx, sy, sz), mat, new THREE.Matrix4().makeTranslation(x, y, z), cast);
  }
  pole(a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: THREE.Material, top = radius, cast = false, radial = 7) {
    const vector = b.clone().sub(a);
    this.add(new THREE.CylinderGeometry(top, radius, vector.length(), radial), mat,
      new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), vector.normalize()), V(1, 1, 1)), cast);
  }
  tube(points: THREE.Vector3[], radius: number, mat: THREE.Material, segments = 20, cast = false) {
    this.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 5, false), mat, new THREE.Matrix4(), cast);
  }
  finish(group: THREE.Group) {
    for (const [material, { geometries, cast }] of this.buckets) {
      const merged = new THREE.BufferGeometry();
      for (const [name, size] of [["position", 3], ["normal", 3], ["uv", 2]] as const) {
        const array = new Float32Array(geometries.reduce((n, g) => n + g.getAttribute(name).array.length, 0));
        let offset = 0;
        for (const g of geometries) { const a = g.getAttribute(name).array; array.set(a, offset); offset += a.length; }
        merged.setAttribute(name, new THREE.BufferAttribute(array, size));
      }
      merged.computeBoundingBox(); merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material); mesh.castShadow = cast; mesh.receiveShadow = cast;
      group.add(mesh); geometries.forEach((g) => g.dispose());
    }
    this.buckets.clear();
  }
}

function surface(position: number[], index: number[], uv: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(index); g.computeVertexNormals(); return g;
}

function deckTexture() {
  if (typeof document === "undefined") {
    const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t;
  }
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const p = c.getContext("2d");
  if (p) {
    p.fillStyle = "#d7c39e"; p.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1100; i++) {
      const n = Math.sin(i * 32.917) * 19321.92, f = n - Math.floor(n);
      p.strokeStyle = `rgba(88,66,37,${.025 + (i % 7) * .007})`; p.lineWidth = .4;
      p.beginPath(); p.moveTo((i * 73) % 512, f * 512); p.lineTo((i * 73) % 512 + 65, f * 512 + .8); p.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

function hullGeometry(builder: Builder, white: THREE.Material, teak: THREE.Material, seams: THREE.Material, boot: THREE.Material, antifouling: THREE.Material) {
  const nx = 168, ny = 30, paintRing = 14, pos: number[] = [], uv: number[] = [];
  const upper: number[] = [], lower: number[] = [];
  // Clip partially closed end triangles to the true analytic contour instead
  // of leaving their zero-width vertices at arbitrary tessellation stations.
  const clipClosedContour = (positions: number[], texcoords: number[], source: number[]) => {
    const result: number[] = [], intersections = new Map<string, number>();
    const isInside = (vertex: number) => Math.abs(positions[vertex * 3 + 2]) > 1e-7;
    const crossing = (a: number, b: number) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const cached = intersections.get(key); if (cached !== undefined) return cached;
      let inside = isInside(a) ? 0 : 1, outside = 1 - inside;
      const ax = positions[a * 3], ay = positions[a * 3 + 1], bx = positions[b * 3], by = positions[b * 3 + 1];
      for (let iteration = 0; iteration < 27; iteration++) {
        const t = (inside + outside) * .5;
        if (tallShipHalfWidthAtHeight(ax + (bx - ax) * t, ay + (by - ay) * t) > 1e-8) inside = t;
        else outside = t;
      }
      const t = (inside + outside) * .5, index = positions.length / 3;
      positions.push(ax + (bx - ax) * t, ay + (by - ay) * t, 0);
      texcoords.push(texcoords[a * 2] + (texcoords[b * 2] - texcoords[a * 2]) * t, texcoords[a * 2 + 1] + (texcoords[b * 2 + 1] - texcoords[a * 2 + 1]) * t);
      intersections.set(key, index); return index;
    };
    for (let i = 0; i < source.length; i += 3) {
      const triangle = source.slice(i, i + 3), polygon: number[] = [];
      for (let edge = 0; edge < 3; edge++) {
        const a = triangle[edge], b = triangle[(edge + 1) % 3], ai = isInside(a), bi = isInside(b);
        if (ai) polygon.push(a);
        if (ai !== bi) polygon.push(crossing(a, b));
      }
      for (let fan = 1; fan < polygon.length - 1; fan++) result.push(polygon[0], polygon[fan], polygon[fan + 1]);
    }
    return result;
  };
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i <= nx; i++) {
      const x = -28 + 56 * i / nx;
      for (let j = 0; j <= ny; j++) {
        // One exact horizontal ring is the paint boundary, even at the sheer.
        const y = j <= paintRing ? -3.2 + 2.97 * j / paintRing : -.23 + (tallShipDeckHeight(x) + .23) * (j - paintRing) / (ny - paintRing);
        pos.push(x, y, (side === 0 ? 1 : -1) * tallShipHalfWidthAtHeight(x, y)); uv.push(x / 12, y / 4);
        if (i < nx && j < ny) {
          const a = side * (nx + 1) * (ny + 1) + i * (ny + 1) + j, b = a + ny + 1;
          const indices = j < paintRing ? lower : upper;
          if (side === 0) indices.push(a, b, a + 1, b, b + 1, a + 1);
          else indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
  }
  const second = (nx + 1) * (ny + 1);
  for (let i = 0; i < nx; i++) { const a = i * (ny + 1), b = a + ny + 1; lower.push(a, a + second, b, b, a + second, b + second); }
  const upperIndices = clipClosedContour(pos, uv, upper), lowerIndices = clipClosedContour(pos, uv, lower);
  builder.add(surface(pos, upperIndices, uv), white);
  builder.add(surface(pos, lowerIndices, uv), antifouling);
  const dp: number[] = [], du: number[] = [], di: number[] = [];
  for (let i = 0; i <= nx; i++) {
    const x = -28 + 56 * i / nx, w = tallShipHalfBeam(x), y = tallShipDeckHeight(x);
    dp.push(x, y, -w, x, y, w); du.push(x / 8, -w / 3, x / 8, w / 3);
    if (i < nx) { const a = i * 2; di.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  builder.add(surface(dp, di, du), teak);
  // Narrow burgundy boot topping; no heavy dark slab below the white topsides.
  for (const side of [-1, 1]) {
    const bp: number[] = [], bu: number[] = [], bi: number[] = [];
    for (let i = 0; i <= nx; i++) {
      const x = -28 + 56 * i / nx;
      for (const y of [-.23, .025]) { const w = tallShipHalfWidthAtHeight(x, y); bp.push(x, y, side * (w + (w > .05 ? .016 : 0))); bu.push(i / nx, y); }
      if (i < nx) { const a = i * 2; if (side > 0) bi.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); else bi.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
    }
    const bandIndices = clipClosedContour(bp, bu, bi);
    builder.add(surface(bp, bandIndices, bu), boot, new THREE.Matrix4(), false);
    for (const y of [.69, 1.89]) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 110; i++) {
        const x = -27.7 + 55.4 * i / 110, w = tallShipHalfWidthAtHeight(x, y);
        if (w > .1) points.push(V(x, y, side * (w + .012)));
      }
      builder.tube(points, .011, seams, 110);
    }
  }
  // Deck seams are unlit thin strips without microscopic shadow casters.
  for (let z = -3.78, plank = 0; z <= 3.78; z += .36, plank++) {
    const sp: number[] = [], su: number[] = [], si: number[] = [];
    let count = 0;
    for (let x = -27.7; x <= 27.7; x += .5) {
      if (Math.abs(z) > tallShipHalfBeam(x) - .08) continue;
      sp.push(x, tallShipDeckHeight(x) + .012, z - .009, x, tallShipDeckHeight(x) + .012, z + .009); su.push(0, count, 1, count);
      if (count) { const a = (count - 1) * 2; si.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } count++;
    }
    if (count > 1) builder.add(surface(sp, si, su), seams, new THREE.Matrix4(), false);
    for (let x = -26 + (plank % 4) * 1.2; x < 26; x += 4.8) {
      if (Math.abs(z) + .38 < tallShipHalfBeam(x) - .12) builder.box(x, tallShipDeckHeight(x) + .014, z + .18, .015, .007, .345, seams, false);
    }
  }
}

function rail(builder: Builder, points: THREE.Vector3[], mat: THREE.Material) {
  for (const h of [.37, .72]) builder.tube(points.map((p) => p.clone().add(V(0, h, 0))), h === .72 ? .035 : .018, mat, points.length * 2);
  for (const p of points) builder.pole(p, p.clone().add(V(0, .74, 0)), .025, mat);
}

function roundedCabin(builder: Builder, x: number, z: number, base: number, length: number, width: number, height: number, mat: THREE.Material) {
  const s = new THREE.Shape(), a = length / 2, b = width / 2, r = .20;
  s.moveTo(-a + r, -b); s.lineTo(a - r, -b); s.quadraticCurveTo(a, -b, a, -b + r); s.lineTo(a, b - r); s.quadraticCurveTo(a, b, a - r, b);
  s.lineTo(-a + r, b); s.quadraticCurveTo(-a, b, -a, b - r); s.lineTo(-a, -b + r); s.quadraticCurveTo(-a, -b, -a + r, -b);
  const g = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false, curveSegments: 5 });
  builder.add(g, mat, new THREE.Matrix4().compose(V(x, base, z), new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2), V(1, 1, 1)));
}

export function createTallShip() {
  const group = new THREE.Group(); group.name = "White three-masted training tall ship";
  const builder = new Builder(), materials = new Set<THREE.Material>(), texture = deckTexture();
  const material = (color: string, roughness = .56, metalness = .05) => { const m = new THREE.MeshStandardMaterial({ color, roughness, metalness }); materials.add(m); return m; };
  const white = material("#d8dcdb", .58), trim = material("#d3d5cf", .58), railWhite = material("#daddd7", .58, .1);
  for (const paint of [white, trim, railWhite]) paint.envMapIntensity = .45;
  const teak = new THREE.MeshStandardMaterial({ color: "#e3c699", map: texture, roughness: .88 }); materials.add(teak);
  const seams = material("#9a9c8d", .86), boot = material("#70343b", .61), metal = material("#626e71", .4, .65);
  const antifouling = material("#4d3033", .82, 0); antifouling.envMapIntensity = .15;
  const dark = material("#2b3437", .49), glass = material("#425765", .25, .27), rope = material("#ae9c7b", .94), red = material("#cb5839", .71);
  hullGeometry(builder, white, teak, seams, boot, antifouling);

  for (const side of [-1, 1]) {
    const points = Array.from({ length: 43 }, (_, i) => {
      const x = -27.4 + i * 54.6 / 42; return V(x, tallShipDeckHeight(x) + .035, side * Math.max(.09, tallShipHalfBeam(x) - .065));
    });
    rail(builder, points, railWhite);
    // Tiny portholes and a few pairs of cabin lights, kept to the scale of the photo.
    for (let x = -24.6; x <= 24.3; x += 1.3) {
      const y = 1.45 + .28 * THREE.MathUtils.smoothstep(Math.abs(x), 18, 27), w = tallShipHalfWidthAtHeight(x, y);
      if (w < .35) continue;
      builder.pole(V(x, y, side * (w + .012)), V(x, y, side * (w + .035)), .065, dark, .065, false, 10);
      if (x > -22 && x < 21 && Math.round(x * 10) % 3 !== 0) {
        const w2 = tallShipHalfWidthAtHeight(x + .28, y);
        builder.pole(V(x + .28, y, side * (w2 + .012)), V(x + .28, y, side * (w2 + .035)), .047, dark, .047, false, 9);
      }
    }
    for (let x = -21; x <= 22; x += 2.45) {
      const y = .47, w = tallShipHalfWidthAtHeight(x, y);
      builder.pole(V(x, y, side * (w + .009)), V(x, y, side * (w + .035)), .047, dark, .047, false, 9);
    }
    const x = 25.2, y = 1.66, z = side * (tallShipHalfWidthAtHeight(x, y) + .04);
    builder.pole(V(x - .06, y + .28, z), V(x + .18, y - .45, z), .055, dark);
    builder.tube([V(x - .33, y - .19, z), V(x - .24, y - .49, z), V(x + .18, y - .46, z), V(x + .48, y - .16, z)], .055, dark, 13);
    builder.pole(V(x - .24, y + .19, z), V(x + .21, y + .31, z), .035, dark);
  }

  // Low steel deckhouses; their windows, hatch combings and bridge wings match
  // a twentieth-century sail-training vessel rather than a fantasy warship.
  const mainY = tallShipDeckHeight(-7);
  roundedCabin(builder, -7, 0, mainY + .015, 8, 3.55, 1.16, white);
  roundedCabin(builder, -7, 0, mainY + 1.18, 8.18, 3.72, .11, trim);
  for (const side of [-1, 1]) {
    for (let x = -10.2; x <= -3.8; x += 1.05) builder.box(x, mainY + .78, side * 1.79, .7, .40, .035, glass, false);
    builder.box(-10.9, mainY + .55, side * 1.79, .50, .98, .035, seams, false);
    builder.box(-10.9, mainY + .75, side * 1.814, .30, .32, .018, glass, false);
    rail(builder, [-10.5, -9, -7.5, -6, -4.5, -3.5].map((x) => V(x, mainY + 1.31, side * 1.73)), railWhite);
  }
  const bridgeY = tallShipDeckHeight(-21);
  roundedCabin(builder, -21, 0, bridgeY + .02, 4.6, 3.38, 1.05, white);
  roundedCabin(builder, -20.65, 0, bridgeY + 1.07, 3.0, 2.94, .84, white);
  roundedCabin(builder, -20.65, 0, bridgeY + 1.93, 3.18, 3.13, .095, trim);
  for (const side of [-1, 1]) for (const x of [-21.68, -20.71, -19.74]) builder.box(x, bridgeY + 1.55, side * 1.49, .76, .47, .035, glass, false);
  for (const z of [-.95, 0, .95]) builder.box(-19.12, bridgeY + 1.55, z, .035, .48, .72, glass, false);
  for (const side of [-1, 1]) rail(builder, [-23.1, -21.5, -19.2].map((x) => V(x, bridgeY + 1.10, side * 2.08)), railWhite);
  roundedCabin(builder, 19, 0, tallShipDeckHeight(19) + .02, 3.4, 2.6, .95, white);
  roundedCabin(builder, 19, 0, tallShipDeckHeight(19) + .98, 3.62, 2.8, .08, trim);
  for (const side of [-1, 1]) for (const x of [18, 19, 20]) builder.box(x, 3.02, side * 1.32, .63, .34, .035, glass, false);

  // Four conspicuously real pieces of safety equipment: two white lifeboats
  // on steel cradles and curved davits, plus spare inflatables on the cabin roof.
  const lifeboat = (x: number, z: number) => {
    const bottom = 3.48, top = 4.04, nx = 24, p: number[] = [], u: number[] = [], idx: number[] = [];
    for (let i = 0; i <= nx; i++) {
      const t = i / nx, dx = (t - .5) * 5.2, w = .63 * Math.pow(Math.sin(t * Math.PI), .65);
      const rise = .15 * Math.pow(Math.abs(t - .5) * 2, 2);
      p.push(x + dx, bottom + rise, z, x + dx, top + rise, z - w, x + dx, top + rise, z + w);
      u.push(t, 0, t, 1, t, 1);
      if (i < nx) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a, a + 2, a + 3, a + 2, a + 5, a + 3, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
    }
    builder.add(surface(p, idx, u), white);
    for (const side of [-1, 1]) builder.tube(Array.from({ length: 25 }, (_, i) => {
      const t = i / 24; return V(x + (t - .5) * 5.2, top + .15 * Math.pow(Math.abs(t - .5) * 2, 2), z + side * .63 * Math.pow(Math.sin(t * Math.PI), .65));
    }), .041, red, 26);
    for (const dx of [-1.8, 1.8]) {
      builder.box(x + dx, 3.02, z, .18, 1.0, .64, railWhite, false);
      const inward = -Math.sign(z);
      builder.tube([V(x + dx, 2.4, z + inward * .8), V(x + dx, 4.3, z + inward * .8), V(x + dx, 4.75, z + inward * .6), V(x + dx, 4.92, z), V(x + dx, 4.75, z - inward * .22)], .065, railWhite, 20);
      builder.pole(V(x + dx, 4.75, z - inward * .22), V(x + dx, 4.07, z), .023, rope);
    }
  };
  lifeboat(-7.0, -3.12); lifeboat(-7.0, 3.12);
  for (const x of [-9.1, -6.0]) {
    builder.pole(V(x - .55, 3.92, 0), V(x + .55, 3.92, 0), .32, trim, .32, true, 12);
    for (const dx of [-.3, .3]) builder.pole(V(x + dx, 3.62, -.24), V(x + dx, 3.62, .24), .032, metal);
  }

  // White ventilators, compact winches, bollards, coiled sheets and anchor gear.
  for (const [x, z] of [[-17.8, -2.2], [-17.8, 2.2], [-11.7, -2.55], [-11.7, 2.55], [6.1, -2.7], [6.1, 2.7], [17.0, -1.2], [17.0, 1.2]]) {
    const y = tallShipDeckHeight(x);
    builder.pole(V(x, y, z), V(x, y + .51, z), .12, railWhite, .12);
    builder.pole(V(x, y + .45, z), V(x, y + .6, z), .27, white, .21, true, 10);
  }
  for (const x of [-24.0, -13.5, 3.0, 10.8, 23]) for (const side of [-1, 1]) {
    const z = side * (tallShipHalfBeam(x) - .75), y = tallShipDeckHeight(x);
    builder.pole(V(x, y + .08, z), V(x, y + .48, z), .17, metal, .21, true, 10);
    builder.pole(V(x, y + .39, z), V(x, y + .53, z), .27, railWhite, .27, false, 10);
    builder.box(x + .55, y + .17, z, .19, .28, .37, dark, false);
    builder.pole(V(x + .55, y + .28, z - .28), V(x + .55, y + .28, z + .28), .044, metal);
    if (x > -20 && x < 20) {
      const coil = Array.from({ length: 60 }, (_, i) => { const t = i / 59, a = t * Math.PI * 7, r = .1 + .24 * t; return V(x - .56 + Math.cos(a) * r, y + .07, z + Math.sin(a) * r); });
      builder.tube(coil, .028, rope, 59);
    }
  }
  builder.box(23.8, 3.15, 0, 1.7, .55, 1.25, white);
  builder.pole(V(23.8, 3.56, -.77), V(23.8, 3.56, .77), .24, metal, .24, true, 12);
  for (const side of [-1, 1]) builder.tube([V(23.8, 3.51, side * .43), V(25.0, 3.03, side * .65), V(26.3, 2.5, side * .5)], .033, dark, 16);
  for (const [x, length, width] of [[3.7, 2.4, 1.9], [9.0, 1.8, 1.6], [-25.0, 1.4, 1.1]]) {
    const y = tallShipDeckHeight(x);
    builder.box(x, y + .11, 0, length, .22, width, trim);
    builder.box(x, y + .24, 0, length - .18, .035, width - .18, glass, false);
    for (let dx = -.4 * length; dx <= .4 * length; dx += .42) builder.box(x + dx, y + .27, 0, .035, .025, width - .12, railWhite, false);
  }
  // Life rings and companionway steps give the rail/deck a believable human scale.
  for (const side of [-1, 1]) for (const x of [-18, 7.5]) {
    const z = side * (tallShipHalfBeam(x) - .07), y = tallShipDeckHeight(x) + .39;
    builder.add(new THREE.TorusGeometry(.23, .052, 6, 18), red, new THREE.Matrix4().makeTranslation(x, y, z), false);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) builder.box(x + Math.cos(a) * .23, y + Math.sin(a) * .23, z, .075, .075, .12, railWhite, false);
  }
  for (const z of [-1.2, 1.2]) for (let i = 0; i < 6; i++) builder.box(-11.75 + i * .13, 2.44 + i * .2, z, .19, .07, .6, railWhite, false);

  builder.finish(group);
  const rig = createTallShipRig(); group.add(rig.group);
  group.userData.hullLength = 56; group.userData.hullBeam = 8; group.userData.waterline = 0; group.userData.closedDeck = true; group.userData.mastCount = 3;
  return {
    group,
    update(time: number, storm: number) { rig.update(time, storm); },
    dispose() {
      rig.group.removeFromParent(); rig.dispose();
      group.traverse((object) => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      materials.forEach((m) => m.dispose()); texture.dispose(); group.clear();
    },
  };
}
