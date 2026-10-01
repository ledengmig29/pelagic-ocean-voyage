# PELAGIC — Ocean Voyage

A 36-second, 1920 × 1080 composition using the website's actual Three.js scene. The paused GSAP timeline drives `ocean.render(time, progress)` directly, so playback, scrubbing and captured frames use identical state. Audio clips use HyperFrames gain and fade attributes.

The scene features a white three-masted sailing ship based on the supplied reference: a slender white hull, layered ivory square sails, forward jibs and dense rigging. Wave-height samples at the bow, stern and sides drive heave, pitch and roll; a hull mask reduces water crossing into the ship's interior. The bottle's water volume follows its inner profile and fills at least half the bottle. These are geometric and wave-based approximations, without a fluid dynamics solver.

From the `living-gallery` root, run `npm run ocean:bundle` after any ocean engine edit. This bundles WebGL and GSAP locally and uses FFmpeg to extend the generated ambience stems. Then run `npm run check` in this directory to verify runtime, layout, motion and contrast.

Preview: `npx --yes hyperframes@0.8.104 preview --background --port 3102`.
Studio: <http://localhost:3102/#project/ocean-voyage>.
Verify the server with `npx --yes hyperframes@0.8.104 preview --status`; stop it with `preview --stop`.

The equivalent Remotion composition is `OceanVoyage` in `remotion/root.tsx`, with the same `remotion/ocean-journey.ts` mapping. The scene and both film adapters share `app/ocean/ocean-transition.ts`: the third-act caption appears only as the bottle becomes established, followed by attribution at 33 seconds. Existing gallery films remain registered.

`DESIGN.md` defines the palette, type and motion. This project loads no remote media at capture time.
