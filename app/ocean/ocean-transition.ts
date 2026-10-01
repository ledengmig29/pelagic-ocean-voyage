/** A seekable choreography shared by the page, WebGL scene and film adapters. */
export function transitionEase(start: number, end: number, progress: number) {
  const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function getOceanTransition(progress: number) {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  return {
    cameraPullback: transitionEase(.60, .925, p),
    seaLevelMix: transitionEase(.61, .72, p),
    waveDamping: transitionEase(.59, .70, p),
    stormRelease: transitionEase(.59, .72, p),
    backdropReveal: transitionEase(.64, .795, p),
    outerOceanOpacity: 1 - transitionEase(.705, .795, p),
    volumeReveal: transitionEase(.71, .795, p),
    // A very faint overlap bridges the empty interval between sea and glass.
    // Glass × exterior opacity stays below .005; readable glass has no outer sea.
    bottleReveal: transitionEase(.76, .84, p),
    framing: transitionEase(.79, .925, p),
    titleReveal: transitionEase(.835, .925, p),
    enclosureReady: p >= .795,
  };
}
