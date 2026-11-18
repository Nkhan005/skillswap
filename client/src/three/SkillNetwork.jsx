import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * The hero scene: a network of members (points) joined by skill exchanges
 * (lines), breathing slowly.
 *
 * The shape is the message. SkillSwap is not a catalogue of people, it is the
 * connections between them, so the visual subject is the edges as much as the
 * nodes.
 *
 * ---------------------------------------------------------------------------
 * Why it is built this way
 *
 * The naive version of this effect keeps 220 meshes in an array and nudges
 * each one's position from JavaScript every frame. That means 220 draw calls
 * and 220 matrix updates per frame on the CPU, which is what makes most
 * portfolio 3D scenes stutter on a mid-range phone.
 *
 * Instead:
 *   - Every node lives in ONE BufferGeometry drawn as THREE.Points, so the
 *     whole cloud is a single draw call.
 *   - Movement happens in the vertex shader. The CPU uploads one number per
 *     frame (uTime) and the GPU computes all 220 positions in parallel. GPUs
 *     are built for exactly this; the CPU is not.
 *   - Edges are one LineSegments object, also a single draw call.
 *
 * Total: two draw calls and one uniform write per frame, regardless of how
 * many nodes there are.
 * ---------------------------------------------------------------------------
 */

const NODE_COUNT = 220;
const CONNECT_DISTANCE = 1.45; // world units; tuned to ~2.5 edges per node
const MAX_EDGES = 900; // hard ceiling so a dense cluster cannot explode the count
const CLOUD_RADIUS = 4.2;

/**
 * A tiny seeded pseudo-random generator (mulberry32).
 *
 * Math.random() would reshuffle the constellation on every reload and every
 * hot-reload while styling. A fixed seed means the layout is deterministic:
 * the composition we tune is the composition users see, and a screenshot in
 * the docs stays accurate.
 */
function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Scatter points through a sphere, then flatten slightly on Z.
 *
 * The cube root on the radius matters: sampling radius uniformly would pile
 * most points near the centre, because a shell's volume grows with r^2. The
 * cube root undoes that bias and spreads them evenly through the volume.
 */
function buildNodes(rng) {
  const positions = new Float32Array(NODE_COUNT * 3);
  const phases = new Float32Array(NODE_COUNT);

  for (let i = 0; i < NODE_COUNT; i += 1) {
    const u = rng();
    const v = rng();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const r = CLOUD_RADIUS * Math.cbrt(rng());

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.72;
    positions[i * 3 + 2] = r * Math.cos(phi) * 0.55;

    // Per-node offset so the cloud shimmers unevenly instead of pulsing as
    // one block, which reads as mechanical.
    phases[i] = rng() * Math.PI * 2;
  }

  return { positions, phases };
}

/**
 * Join nodes that are already close together.
 *
 * This is O(n^2) - 24,090 distance checks for 220 nodes. That is fine because
 * it runs once, inside useMemo, and never again. Optimising it with a spatial
 * grid would add real complexity to save a fraction of a millisecond at
 * startup, which is the wrong trade.
 */
function buildEdges(positions) {
  const verts = [];

  outer: for (let i = 0; i < NODE_COUNT; i += 1) {
    for (let j = i + 1; j < NODE_COUNT; j += 1) {
      const dx = positions[i * 3] - positions[j * 3];
      const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
      const dz = positions[i * 3 + 2] - positions[j * 3 + 2];

      // Compare squared distances to skip a square root in the inner loop.
      if (dx * dx + dy * dy + dz * dz < CONNECT_DISTANCE * CONNECT_DISTANCE) {
        verts.push(
          positions[i * 3],
          positions[i * 3 + 1],
          positions[i * 3 + 2],
          positions[j * 3],
          positions[j * 3 + 1],
          positions[j * 3 + 2]
        );
        if (verts.length / 6 >= MAX_EDGES) break outer;
      }
    }
  }

  return new Float32Array(verts);
}

// Brand indigo -> mint, matching the --color-brand-* / --color-mint-* tokens
// in index.css so the scene cannot drift away from the rest of the UI.
const COLOR_IDLE = new THREE.Color('#4f46e5');
const COLOR_ACTIVE = new THREE.Color('#34d399');

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  attribute float aPhase;
  varying float vGlow;

  void main() {
    vec3 p = position;

    // Drift. Two different frequencies keep it from looking like a wobble.
    p.x += sin(uTime * 0.28 + aPhase) * 0.14;
    p.y += cos(uTime * 0.22 + aPhase * 1.3) * 0.14;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);

    // 0..1 breathing value, reused by the fragment shader for colour.
    vGlow = 0.5 + 0.5 * sin(uTime * 1.1 + aPhase * 2.7);

    // Dividing by -mv.z gives perspective scaling: near points draw larger.
    // Without it every point is the same pixel size and the cloud looks flat.
    // uSize is a WORLD-space radius, not pixels. The 260.0 converts it to
    // screen pixels at this fov and camera distance: a value of 0.13 lands
    // around 4px, which is what reads as a star rather than a blob.
    gl_PointSize = uSize * (0.55 + 0.75 * vGlow) * (260.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColorIdle;
  uniform vec3 uColorActive;
  varying float vGlow;

  void main() {
    // gl_PointCoord is 0..1 across the point's quad. Measuring from the
    // centre turns that square into a soft disc.
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float edge = smoothstep(0.5, 0.08, d);
    vec3 c = mix(uColorIdle, uColorActive, vGlow);

    gl_FragColor = vec4(c, edge * (0.30 + 0.70 * vGlow));
  }
`;

export default function SkillNetwork({ pointer, animate = true }) {
  const group = useRef();
  const uniforms = useRef({
    uTime: { value: 0 },
    uSize: { value: 0.38 },
    uColorIdle: { value: COLOR_IDLE },
    uColorActive: { value: COLOR_ACTIVE },
  });

  // useMemo, not useState or a plain call: generating the cloud on every
  // render would rebuild 220 nodes and ~24k distance checks each time React
  // re-renders the parent for an unrelated reason.
  const { positions, phases, edges } = useMemo(() => {
    const rng = mulberry32(20260118);
    const built = buildNodes(rng);
    return { ...built, edges: buildEdges(built.positions) };
  }, []);

  useFrame((state, delta) => {
    if (!animate) return;

    // delta, not a frame counter: elapsed seconds make the motion run at the
    // same speed on a 60Hz laptop and a 144Hz monitor.
    uniforms.current.uTime.value += delta;

    if (!group.current) return;

    // Slow continuous yaw gives the cloud depth without the user doing
    // anything.
    group.current.rotation.y += delta * 0.045;

    // Parallax: ease toward the pointer rather than snapping to it. The 0.04
    // factor is a cheap exponential smoothing - each frame closes 4% of the
    // remaining gap, which feels like weight.
    const targetX = pointer.current.y * 0.18;
    const targetY = pointer.current.x * 0.28;
    group.current.rotation.x += (targetX - group.current.rotation.x) * 0.04;
    group.current.rotation.z += (targetY * 0.1 - group.current.rotation.z) * 0.04;
  });

  return (
    <group ref={group}>
      {/* Edges first so the brighter nodes draw over them. */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[edges, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color="#6366f1"
          transparent
          opacity={0.28}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        </bufferGeometry>
        {/*
          depthWrite={false} with additive blending: overlapping points add
          their light together instead of the nearest one hiding the rest,
          which is what makes a particle cloud glow where it is dense.
        */}
        <shaderMaterial
          uniforms={uniforms.current}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
