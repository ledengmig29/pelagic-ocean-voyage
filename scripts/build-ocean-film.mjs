import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const composition = join(root, "hyperframes/ocean-voyage");
const require = createRequire(import.meta.url);
await mkdir(composition, { recursive: true });
await build({
  entryPoints: [join(composition, "engine-entry.ts")],
  outfile: join(composition, "ocean-engine.js"),
  bundle: true,
  format: "iife",
  globalName: "OceanVoyage",
  platform: "browser",
  target: ["chrome120"],
  minify: true,
  sourcemap: false,
  legalComments: "none",
});
await copyFile(require.resolve("gsap/dist/gsap.min.js"), join(composition, "gsap.min.js"));
await mkdir(join(composition, "assets"), { recursive: true });
for (const [name, seconds] of [["ocean-ambience", 36], ["storm-ambience", 28]]) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-stream_loop", "-1",
    // MP3 encoder delay can shorten browser-reported duration; clip timing trims this margin.
    "-i", join(root, "public/audio", `${name}.mp3`), "-t", String(seconds + .25),
    "-c:a", "libmp3lame", "-q:a", "4", join(composition, "assets", `${name}-${seconds}s.mp3`)],
  { windowsHide: true, stdio: "inherit" });
}
console.log("Ocean WebGL engine, GSAP and audio stems bundled for deterministic HyperFrames capture.");
