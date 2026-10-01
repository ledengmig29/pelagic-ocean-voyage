import * as THREE from "three";
import { BOTTLE_CENTER_Y, BOTTLE_INNER_PROFILE, BOTTLE_WATER_LEVEL, bottleInnerRadiusAt } from "./bottle-profile";

const ARC_SEGMENTS = 40;
const CAP_TOP_SEGMENTS = 24;
const TAU = Math.PI * 2;

/** Water against the inside of the bottle. The ocean mesh supplies its free surface. */
export function createBottleWater(): {
  group: THREE.Group;
  update(time: number, reveal: number, getHeight: (x: number, z: number) => number, lighting?: number): void;
  dispose(): void;
} {
  const group = new THREE.Group();
  group.name = "Half-full bottle — continuous enclosed liquid";
  group.visible = false;

  // Preserve every change in the glass profile, including its narrow neck.
  const stations: number[] = [BOTTLE_INNER_PROFILE[0][0]];
  for (let i = 1; i < BOTTLE_INNER_PROFILE.length; i++) {
    const a = BOTTLE_INNER_PROFILE[i - 1][0];
    const b = BOTTLE_INNER_PROFILE[i][0];
    const divisions = Math.max(2, Math.ceil((b - a) / 0.75));
    for (let j = 1; j <= divisions; j++) stations.push(a + (b - a) * j / divisions);
  }
  const radii = stations.map(bottleInnerRadiusAt);
  const rows = ARC_SEGMENTS + 1;
  const position = new Float32Array(stations.length * rows * 3);
  const normal = new Float32Array(position.length);
  const indices: number[] = [];
  for (let station = 0; station < stations.length - 1; station++) {
    for (let arc = 0; arc < ARC_SEGMENTS; arc++) {
      const a = station * rows + arc;
      const b = a + rows;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const shellGeometry = new THREE.BufferGeometry();
  shellGeometry.setAttribute("position", new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
  shellGeometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3).setUsage(THREE.DynamicDrawUsage));
  shellGeometry.setIndex(indices);

  const liquidMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uLevel: { value: BOTTLE_WATER_LEVEL }, uLighting: { value: 1 } },
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uReveal;
      uniform float uLevel;
      uniform float uLighting;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      void main() {
        vec3 eye = normalize(cameraPosition - vWorldPosition);
        vec3 n = normalize(vWorldNormal);
        float depth = max(0.0, uLevel - vWorldPosition.y);
        float depthFraction = clamp(depth / 29.2, 0.0, 1.0);
        float grazing = pow(1.0 - abs(dot(eye, n)), 3.0);
        // Beer-Lambert-style absorption stays luminous turquoise at the glass.
        // It is intentionally translucent: the far wall and cradle remain legible.
        vec3 shallow = vec3(0.035, 0.32, 0.37);
        vec3 deep = vec3(0.022, 0.155, 0.235);
        vec3 color = mix(shallow, deep, smoothstep(0.0, 1.0, depthFraction));
        float causticA = sin(vWorldPosition.x * 0.31 + vWorldPosition.z * 0.49 + uTime * 0.17);
        float causticB = sin(vWorldPosition.x * 0.19 - vWorldPosition.z * 0.43 - uTime * 0.13 + depth * 0.3);
        float caustic = pow(max(0.0, 1.0 - abs(causticA + causticB)), 12.0);
        color += vec3(0.10, 0.24, 0.24) * caustic * (0.045 + depthFraction * 0.085);
        color += vec3(0.045, 0.105, 0.11) * grazing;
        float underSurface = exp(-depth * 1.2);
        color += vec3(0.035, 0.095, 0.10) * underSurface;
        // Studio light rises with the enclosure: avoid a luminous cyan block
        // while the surrounding sea is dissolving into the dark background.
        color *= mix(0.24, 1.0, uLighting);
        // The submerged wall becomes visible together with its glass enclosure;
        // a free-floating half-cylinder must never precede the bottle reveal.
        float alpha = (0.49 + depthFraction * 0.14 + grazing * 0.14) * uReveal * smoothstep(0.0, 0.65, uLighting);
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const shell = new THREE.Mesh(shellGeometry, liquidMaterial);
  shell.name = "Glass-contact water volume";
  shell.renderOrder = 4;
  shell.frustumCulled = false;
  group.add(shell);

  const caps = [0, stations.length - 1].map((station, capIndex) => {
    // One interior fan vertex, the lower circular perimeter, and a sampled free-surface chord.
    const perimeterCount = rows + CAP_TOP_SEGMENTS - 1;
    const vertices = new Float32Array((perimeterCount + 1) * 3);
    const normals = new Float32Array(vertices.length);
    const triangles: number[] = [];
    for (let i = 0; i < perimeterCount; i++) {
      const a = i + 1;
      const b = (i + 1) % perimeterCount + 1;
      if (capIndex === 0) triangles.push(0, b, a);
      else triangles.push(0, a, b);
    }
    for (let i = 0; i < normals.length; i += 3) normals[i] = capIndex === 0 ? -1 : 1;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(triangles);
    const mesh = new THREE.Mesh(geometry, liquidMaterial);
    mesh.renderOrder = 4;
    mesh.frustumCulled = false;
    group.add(mesh);
    return { station, vertices, geometry };
  });

  const contactPosition = new Float32Array(stations.length * 2 * 2 * 3);
  const contactIndices: number[] = [];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < stations.length - 1; i++) {
      const a = (side * stations.length + i) * 2;
      contactIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const contactGeometry = new THREE.BufferGeometry();
  contactGeometry.setAttribute("position", new THREE.BufferAttribute(contactPosition, 3).setUsage(THREE.DynamicDrawUsage));
  contactGeometry.setIndex(contactIndices);
  const contactMaterial = new THREE.MeshBasicMaterial({
    color: "#94c9c6", transparent: true, opacity: 0,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const contact = new THREE.Mesh(contactGeometry, contactMaterial);
  contact.name = "Subtle glass-contact meniscus";
  contact.renderOrder = 5;
  contact.frustumCulled = false;
  group.add(contact);

  const endpoint = (x: number, radius: number, sign: number, getHeight: (x: number, z: number) => number) => {
    let z = sign * Math.sqrt(Math.max(0, radius * radius - (BOTTLE_WATER_LEVEL - BOTTLE_CENTER_Y) ** 2));
    let height = BOTTLE_WATER_LEVEL;
    for (let iteration = 0; iteration < 3; iteration++) {
      height = THREE.MathUtils.clamp(getHeight(x, z), BOTTLE_CENTER_Y - radius + 0.01, BOTTLE_CENTER_Y + radius - 0.01);
      z = sign * Math.sqrt(Math.max(0, radius * radius - (height - BOTTLE_CENTER_Y) ** 2));
    }
    return { height, z, angle: Math.acos((height - BOTTLE_CENTER_Y) / radius) };
  };

  return {
    group,
    update(time, reveal, getHeight, lighting = 1) {
      const amount = THREE.MathUtils.clamp(reveal, 0, 1);
      group.visible = amount > 0.001;
      liquidMaterial.uniforms.uTime.value = time;
      liquidMaterial.uniforms.uReveal.value = amount;
      liquidMaterial.uniforms.uLighting.value = THREE.MathUtils.clamp(lighting, 0, 1);
      contactMaterial.opacity = 0.18 * amount * liquidMaterial.uniforms.uLighting.value;
      if (!group.visible) return;
      for (let station = 0; station < stations.length; station++) {
        const x = stations[station];
        const radius = radii[station];
        const positive = endpoint(x, radius, 1, getHeight);
        const negative = endpoint(x, radius, -1, getHeight);
        const before = Math.max(0, station - 1);
        const after = Math.min(stations.length - 1, station + 1);
        const drdx = (radii[after] - radii[before]) / (stations[after] - stations[before]);
        const normalScale = 1 / Math.sqrt(1 + drdx * drdx);
        for (let arc = 0; arc <= ARC_SEGMENTS; arc++) {
          const angle = THREE.MathUtils.lerp(positive.angle, TAU - negative.angle, arc / ARC_SEGMENTS);
          const i = (station * rows + arc) * 3;
          position[i] = x;
          position[i + 1] = BOTTLE_CENTER_Y + Math.cos(angle) * radius;
          position[i + 2] = Math.sin(angle) * radius;
          normal[i] = -drdx * normalScale;
          normal[i + 1] = Math.cos(angle) * normalScale;
          normal[i + 2] = Math.sin(angle) * normalScale;
        }
        for (let side = 0; side < 2; side++) {
          const edge = side === 0 ? positive : negative;
          const sign = side === 0 ? 1 : -1;
          const i = (side * stations.length + station) * 6;
          contactPosition[i] = contactPosition[i + 3] = x;
          contactPosition[i + 1] = edge.height + 0.028;
          contactPosition[i + 2] = edge.z;
          contactPosition[i + 4] = edge.height + 0.008;
          contactPosition[i + 5] = edge.z - sign * 0.11;
        }
      }
      shellGeometry.attributes.position.needsUpdate = true;
      shellGeometry.attributes.normal.needsUpdate = true;
      contactGeometry.attributes.position.needsUpdate = true;
      for (const { station, vertices, geometry } of caps) {
        const x = stations[station];
        const radius = radii[station];
        vertices[0] = x;
        vertices[1] = BOTTLE_CENTER_Y - radius * 0.4;
        vertices[2] = 0;
        for (let arc = 0; arc <= ARC_SEGMENTS; arc++) {
          const from = (station * rows + arc) * 3;
          const to = (arc + 1) * 3;
          vertices[to] = position[from];
          vertices[to + 1] = position[from + 1];
          vertices[to + 2] = position[from + 2];
        }
        const positiveZ = position[station * rows * 3 + 2];
        const negativeZ = position[(station * rows + ARC_SEGMENTS) * 3 + 2];
        for (let sample = 1; sample < CAP_TOP_SEGMENTS; sample++) {
          const to = (rows + sample) * 3;
          const z = THREE.MathUtils.lerp(negativeZ, positiveZ, sample / CAP_TOP_SEGMENTS);
          vertices[to] = x;
          vertices[to + 1] = Math.min(getHeight(x, z), BOTTLE_CENTER_Y + Math.sqrt(Math.max(0, radius * radius - z * z)));
          vertices[to + 2] = z;
        }
        geometry.attributes.position.needsUpdate = true;
      }
    },
    dispose() {
      shellGeometry.dispose();
      for (const cap of caps) cap.geometry.dispose();
      contactGeometry.dispose();
      liquidMaterial.dispose();
      contactMaterial.dispose();
      group.clear();
    },
  };
}
