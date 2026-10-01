## Style Prompt

A cinematic journey across a northern sea: quiet light on a physically modeled ocean, a white three-masted sailing ship breaking into a thunderstorm, then a slow pullback revealing the entire world inside a glass bottle filled at least halfway with water. Match the reference's slender white hull, layered ivory square sails, forward jibs and dense rigging. The water follows the bottle's inner profile, and the ship rests on the moving surface. The continuous WebGL scene is the image. Editorial typography accompanies each act with restraint and gives the final attribution room to breathe.

## Colors

- Midnight navy `#071b28`: canvas, shaded vignette and text backplates.
- Sea teal `#2c727a`: water and restrained atmospheric accents.
- Warm ivory `#eee7d9`: all primary typography.
- Antique brass `#b9a578`: chapter labels, compass and hairline details.

## Typography

- Georgia: narrative display type, 92–108 px at 1920 × 1080, regular weight, tight tracking. Its literary voice fits a miniature seafaring world.
- Arial with Microsoft YaHei fallback: labels at 18 px, captions at 24 px, lighter weight. SimSun is the Chinese serif fallback.
- Use short copy, clear size contrast and no external font loading during capture.

## Motion

- 36 seconds / 30 fps. Open sea 0–10 s; storm 10–23 s; continuous pullback 22–33 s; attribution 33–36 s.
- Preserve the shared `remotion/ocean-journey.ts` progress mapping. During the pullback, the sea retreats into mist while glass reveals from progress .76–.84. The faint glass overlaps the disappearing sea to avoid a floating water-sheet gap; the outer sea is completely gone at .795. The contained water's sidewalls and brightness appear with the glass.
- The third-act caption uses `getOceanTransition(progress).titleReveal` from .835–.925 (about 30–33 s). It waits for the bottle, and crossfades to attribution at 33 s.
- Keep the WebGL camera continuous. Caption transitions are restrained crossfades; each new text element enters with its own direction, timing and ease.
- Drive every wave, weather event and camera pose from explicit timeline time. No requestAnimationFrame, wall clock or random animation.

## What NOT to Do

- Do not substitute a CSS ocean, filmed webpage, screenshot or iframe for the actual WebGL scene.
- Do not add neon colors, gradient text, ornamental card grids or dense technical copy.
- Do not insert jump cuts between camera states or animate captions out before their transition.
- Do not add unsupported attribution, narration or stock video.
