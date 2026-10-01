/**
 * Independent phase, continuity and seeking regression checks. Run npm run ocean:transition-check.
 * Very faint sea/glass overlap bridges the reveal; readable glass and final titles require containment.
 */
import { getOceanTransition } from "../app/ocean/ocean-transition";

type Transition = ReturnType<typeof getOceanTransition>;
type NumericField = Exclude<keyof Transition, "enclosureReady">;
const fields: NumericField[] = [
  "cameraPullback", "seaLevelMix", "waveDamping", "stormRelease", "backdropReveal",
  "outerOceanOpacity", "volumeReveal", "bottleReveal", "framing", "titleReveal",
];
const failures: string[] = [];
let failureCount = 0;
let checks = 0;
const check = (condition: boolean, description: string) => {
  checks++;
  if (!condition) { failureCount++; if (failures.length < 30) failures.push(description); }
};
const tolerance = 1e-10;
const encoded = (snapshot: Transition) => JSON.stringify(snapshot);

function completeEnclosure(snapshot: Transition, progress: number, cause: string) {
  check(snapshot.outerOceanOpacity === 0, `${cause} at ${progress}: ocean still visible outside the bottle (${snapshot.outerOceanOpacity})`);
  check(snapshot.volumeReveal === 1, `${cause} at ${progress}: incomplete liquid volume (${snapshot.volumeReveal})`);
  check(snapshot.seaLevelMix === 1, `${cause} at ${progress}: water level still rising (${snapshot.seaLevelMix})`);
  check(snapshot.waveDamping === 1, `${cause} at ${progress}: oversized exterior waves remain (${snapshot.waveDamping})`);
  check(snapshot.enclosureReady, `${cause} at ${progress}: enclosure is not ready`);
}

function validate(snapshot: Transition, progress: number) {
  check(typeof snapshot.enclosureReady === "boolean", `Enclosure readiness is not boolean at ${progress}`);
  for (const field of fields) {
    const value = snapshot[field];
    check(Number.isFinite(value), `${field} is not finite at ${progress}`);
    check(value >= -tolerance && value <= 1 + tolerance, `${field} leaves [0,1] at ${progress}: ${value}`);
  }
  // A faint crossfade prevents a naked water patch between the sea and glass.
  // Its bounded combined opacity does not permit a readable bottle around a large outer sea.
  if (snapshot.bottleReveal > 0) {
    check(snapshot.seaLevelMix === 1, `Visible glass at ${progress}: water level still rising (${snapshot.seaLevelMix})`);
    check(snapshot.waveDamping === 1, `Visible glass at ${progress}: oversized waves remain (${snapshot.waveDamping})`);
  }
  if (snapshot.bottleReveal > 0.4) {
    check(snapshot.outerOceanOpacity === 0, `Readable glass at ${progress}: outer ocean remains (${snapshot.outerOceanOpacity})`);
    check(snapshot.volumeReveal === 1, `Readable glass at ${progress}: liquid volume incomplete (${snapshot.volumeReveal})`);
  }
  check(snapshot.bottleReveal * snapshot.outerOceanOpacity < 0.005,
    `Sea/glass overlap is too strong at ${progress}: ${snapshot.bottleReveal * snapshot.outerOceanOpacity}`);
  if (snapshot.bottleReveal > 0.1) {
    check(snapshot.outerOceanOpacity < 0.04, `Visible glass at ${progress}: exterior sea opacity ${snapshot.outerOceanOpacity} exceeds 0.04`);
  }
  if (snapshot.titleReveal > 0) completeEnclosure(snapshot, progress, "Visible final title");
  if (snapshot.enclosureReady) completeEnclosure(snapshot, progress, "Ready enclosure");
  if (snapshot.titleReveal > 0) check(snapshot.bottleReveal > 0, `Final title precedes the bottle at ${progress}`);
}

const start = getOceanTransition(0);
const end = getOceanTransition(1);
for (const field of fields) {
  check(start[field] === (field === "outerOceanOpacity" ? 1 : 0), `Incorrect starting value for ${field}`);
  check(end[field] === (field === "outerOceanOpacity" ? 0 : 1), `Incomplete final value for ${field}`);
}
check(!start.enclosureReady && end.enclosureReady, "Incorrect endpoint enclosure readiness");

// Exhaustively visit a fine grid, then return through the same paused states in reverse.
const intervals = 12000;
const reference: string[] = [];
let previous = start;
let maximumStep = 0;
let maximumStepField: NumericField = "cameraPullback";
let maximumStepProgress = 0;
let maximumOverlap = 0;
let maximumOverlapProgress = 0;
let firstReadableGlass = Infinity;
const firstActive: Partial<Record<NumericField | "enclosureReady", number>> = {};
for (let index = 0; index <= intervals; index++) {
  const progress = index / intervals;
  const snapshot = getOceanTransition(progress);
  validate(snapshot, progress);
  reference.push(encoded(snapshot));
  const overlap = snapshot.bottleReveal * snapshot.outerOceanOpacity;
  if (overlap > maximumOverlap) { maximumOverlap = overlap; maximumOverlapProgress = progress; }
  if (snapshot.bottleReveal > 0.4) firstReadableGlass = Math.min(firstReadableGlass, progress);
  if (snapshot.enclosureReady && firstActive.enclosureReady === undefined) firstActive.enclosureReady = progress;
  for (const field of fields) {
    const value = snapshot[field];
    if ((field === "outerOceanOpacity" ? value < 1 : value > 0) && firstActive[field] === undefined) firstActive[field] = progress;
    const change = value - previous[field];
    check(field === "outerOceanOpacity" ? change <= tolerance : change >= -tolerance,
      `${field} reverses direction while progress advances at ${progress}`);
    if (Math.abs(change) > maximumStep) {
      maximumStep = Math.abs(change); maximumStepField = field; maximumStepProgress = progress;
    }
  }
  check(!previous.enclosureReady || snapshot.enclosureReady, `Enclosure readiness reverses at ${progress}`);
  previous = snapshot;
}
check(maximumStep < 0.005, `An opacity or transform jumps by ${maximumStep} over one ${1 / intervals} progress step`);
check((firstActive.enclosureReady ?? Infinity) <= firstReadableGlass, "Readable glass appears before the enclosure is ready");
for (let index = intervals; index >= 0; index--) {
  const progress = index / intervals;
  const snapshot = getOceanTransition(progress);
  validate(snapshot, progress);
  check(encoded(snapshot) === reference[index], `Reverse seeking changes the scene at ${progress}`);
}

// Small perturbations catch hidden steps even when the large grid straddles a phase boundary.
// enclosureReady is a logical flag, so continuity applies only to renderable numeric fields.
let maximumLocalChange = 0;
const phaseBoundaries = [0, 0.59, 0.60, 0.61, 0.64, 0.70, 0.705, 0.71, 0.72, 0.76, 0.79, 0.795, 0.80, 0.835, 0.84, 0.925, 1];
const continuityPoints = [...phaseBoundaries, ...Array.from({ length: intervals + 1 }, (_, i) => i / intervals)];
for (const progress of continuityPoints) {
  const before = getOceanTransition(progress - 1e-7);
  const at = getOceanTransition(progress);
  const after = getOceanTransition(progress + 1e-7);
  for (const field of fields) {
    const difference = Math.max(Math.abs(at[field] - before[field]), Math.abs(after[field] - at[field]));
    maximumLocalChange = Math.max(maximumLocalChange, difference);
    check(difference < 0.0001, `${field} has a discontinuity at ${progress}: ${difference}`);
  }
  validate(at, progress);
}

// Simulate mouse scrubbing, reverse scrolling and chapter jumps in a reproducible order.
let randomState = 0x79b41ac3;
const randomSeeks = 8000;
for (let i = 0; i < randomSeeks; i++) {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  const index = randomState % (intervals + 1);
  const progress = index / intervals;
  const snapshot = getOceanTransition(progress);
  check(encoded(snapshot) === reference[index], `Random seek history changes progress ${progress}`);
  if (i % 8 === 0) getOceanTransition(i % 16 === 0 ? 0 : 1);
}
const pausePoints = [0, 0.46, 0.68, 0.72, 0.76, 0.775, 0.78, 0.79, 0.795, 0.80, 0.805, 0.82, 0.835, 0.84, 0.87, 0.915, 0.925, 1];
for (const progress of pausePoints) {
  const expected = encoded(getOceanTransition(progress));
  for (let frame = 0; frame < 128; frame++) {
    check(encoded(getOceanTransition(progress)) === expected, `Pausing allows transition values to drift at ${progress}`);
  }
}

// Public input handling prevents malformed scroll state from contaminating the renderer.
for (const progress of [-Number.MAX_VALUE, -1, -Number.EPSILON]) {
  check(encoded(getOceanTransition(progress)) === encoded(start), `Negative progress is not clamped: ${progress}`);
}
for (const progress of [1 + Number.EPSILON, 2, Number.MAX_VALUE]) {
  check(encoded(getOceanTransition(progress)) === encoded(end), `Excess progress is not clamped: ${progress}`);
}
for (const progress of [NaN, -Infinity, Infinity]) {
  const snapshot = getOceanTransition(progress);
  validate(snapshot, progress);
  check(encoded(snapshot) === encoded(start), `Non-finite progress has no safe initial-state fallback: ${progress}`);
}
const original = encoded(getOceanTransition(0.84321));
const returnedSnapshot = getOceanTransition(0.84321);
try { Reflect.set(returnedSnapshot, "cameraPullback", -100); } catch { /* Frozen snapshots are also safe. */ }
check(encoded(getOceanTransition(0.84321)) === original, "Mutating a returned snapshot corrupts later scene states");

console.log(JSON.stringify({
  progressSamples: intervals + 1,
  reverseSamples: intervals + 1,
  randomSeeks,
  pausedSnapshots: pausePoints.length * 128,
  continuitySamples: continuityPoints.length,
  checks,
  maximumStep: { amount: maximumStep, field: maximumStepField, progress: maximumStepProgress },
  maximumLocalChange,
  maximumSeaGlassOverlap: { opacityProduct: maximumOverlap, progress: maximumOverlapProgress },
  enclosureFirstReady: firstActive.enclosureReady,
  glassFirstVisible: firstActive.bottleReveal,
  glassFirstReadable: firstReadableGlass,
  titleFirstVisible: firstActive.titleReveal,
  failures: failureCount,
  ...(failures.length ? { failureDetails: failures } : {}),
}, null, 2));
if (failureCount > 0) process.exitCode = 1;
