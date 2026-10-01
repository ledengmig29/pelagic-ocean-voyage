import { useCallback, useState } from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useDelayRender } from "remotion";
import OceanCanvas from "../app/ocean/ocean-canvas";
import { getOceanTransition } from "../app/ocean/ocean-transition";
import { OCEAN_FPS, oceanProgressAt } from "./ocean-journey";

export { OCEAN_DURATION, OCEAN_FPS } from "./ocean-journey";

const INK = "#071b28";
const PAPER = "#eee7d9";
const BRASS = "#b9a578";
const serif = 'Georgia, "Times New Roman", "SimSun", serif';
const sans = 'Arial, "Microsoft YaHei", sans-serif';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function chapterOpacity(time: number, start: number, end: number) {
  return interpolate(time, [start, start + .8, end - .8, end], [0, 1, 1, 0], clamp);
}

function Chapter({ time, start, end, reveal, number, eyebrow, title, description }: {
  time: number; start: number; end: number; reveal?: number; number: string; eyebrow: string; title: string; description: string;
}) {
  const opacity = reveal === undefined ? chapterOpacity(time, start, end)
    : reveal * interpolate(time, [end - .8, end], [1, 0], clamp);
  const entrance = reveal === undefined ? interpolate(time, [start, start + 1.2], [35, 0], clamp)
    : (1 - reveal) * 35;
  return <div style={{ position: "absolute", left: 108, bottom: 132, width: 770,
    opacity, transform: `translateY(${entrance}px)` }}>
    <div style={{ display: "flex", gap: 18, alignItems: "center", fontFamily: sans,
      fontSize: 18, letterSpacing: 4, color: BRASS, marginBottom: 24, padding: "7px 12px",
      width: "fit-content", background: "rgba(7,27,40,.84)" }}>
      <span>{number}</span><span style={{ width: 48, height: 1, background: BRASS }}/><span>{eyebrow}</span>
    </div>
    <div style={{ fontSize: 92, lineHeight: 1.07, letterSpacing: -3, fontWeight: 400 }}>{title}</div>
    <div style={{ fontFamily: sans, fontWeight: 300, fontSize: 24, lineHeight: 1.6,
      letterSpacing: 1, marginTop: 24, maxWidth: 650 }}>{description}</div>
  </div>;
}

/** A deterministic 36-second film of the real WebGL scene, rather than a page recording. */
export function OceanVoyageFilm() {
  const frame = useCurrentFrame();
  const seconds = frame / OCEAN_FPS;
  const progress = oceanProgressAt(seconds);
  const transition = getOceanTransition(progress);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Compiling the ocean's WebGL materials", { timeoutInMilliseconds: 90000 }));
  const ready = useCallback(() => {
    if (!document.querySelector("[data-ocean-canvas] canvas")) {
      cancelRender(new Error("The ocean film requires a working WebGL renderer."));
      return;
    }
    continueRender(handle);
  }, [continueRender, cancelRender, handle]);
  const credit = interpolate(seconds, [33.0, 33.8, 35.5, 36], [0, 1, 1, .7], clamp);
  const header = interpolate(seconds, [0, .8, 32.5, 34], [0, .85, .85, .35], clamp);

  return <AbsoluteFill style={{ backgroundColor: INK, color: PAPER, fontFamily: serif, overflow: "hidden" }}>
    <Audio src={staticFile("audio/ocean-ambience.mp3")} loop loopVolumeCurveBehavior="extend"
      volume={(audioFrame) => interpolate(audioFrame / OCEAN_FPS,
        [0, .8, 8, 12, 24, 29, 35, 36], [0, .42, .42, .14, .14, .4, .4, 0], clamp)}/>
    <Sequence from={8 * OCEAN_FPS} durationInFrames={28 * OCEAN_FPS}>
      <Audio src={staticFile("audio/storm-ambience.mp3")} loop loopVolumeCurveBehavior="extend"
        volume={(audioFrame) => interpolate(audioFrame / OCEAN_FPS,
          [0, 3, 18, 28], [0, .64, .64, 0], clamp)}/>
    </Sequence>
    <OceanCanvas quality="high" progress={progress} time={seconds} onReady={ready}
      className="ocean-film-canvas"/>
    <style>{`.ocean-film-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }`}</style>
    <AbsoluteFill style={{ pointerEvents: "none",
      background: "radial-gradient(ellipse 2000px 270px at 50% 0%, rgba(7,27,40,.84) 0%, rgba(7,27,40,.78) 60%, rgba(7,27,40,0) 100%), radial-gradient(ellipse 2200px 200px at 50% 100%, rgba(7,27,40,.88) 0%, rgba(7,27,40,.80) 65%, rgba(7,27,40,0) 100%), radial-gradient(ellipse 1400px 500px at 0% 100%, rgba(7,27,40,.80) 0%, rgba(7,27,40,.60) 55%, rgba(7,27,40,0) 100%)" }}/>
    <div style={{ position: "absolute", inset: "52px 108px auto", display: "flex", justifyContent: "space-between",
      alignItems: "center", opacity: header, fontFamily: sans, fontSize: 17, letterSpacing: 4 }}>
      <span style={{ fontFamily: serif, fontSize: 30, letterSpacing: 6 }}>PELAGIC</span>
      <span style={{ color: BRASS }}>AN OCEAN IN THREE ACTS</span>
    </div>
    <Chapter time={seconds} start={.3} end={10} number="01" eyebrow="THE OPEN SEA"
      title="A sea of possibility." description="风起之前，万物屏息。"/>
    <Chapter time={seconds} start={10} end={23} number="02" eyebrow="INTO THE TEMPEST"
      title="Follow the storm." description="扬起风帆，驶向想象的深处。"/>
    <Chapter time={seconds} start={29.9} end={33.8} reveal={transition.titleReveal} number="03" eyebrow="A WORLD WITHIN"
      title="The world, contained." description="一场远航，原来盛放在一只玻璃瓶里。"/>
    <div style={{ position: "absolute", left: 108, bottom: 132, opacity: credit,
      transform: `translateY(${(1 - credit) * 24}px)` }}>
      <div style={{ color: BRASS, fontFamily: sans, fontSize: 18, letterSpacing: 5, marginBottom: 22 }}>IMAGINED & CREATED WITH</div>
      <div style={{ fontSize: 108, letterSpacing: -3 }}>GPT 6.1 Sol</div>
      <div style={{ fontFamily: sans, fontWeight: 300, fontSize: 24, marginTop: 20, letterSpacing: 2 }}>把想象，变成可见的世界。</div>
    </div>
    <div style={{ position: "absolute", left: 108, right: 108, bottom: 47, display: "flex", justifyContent: "space-between",
      fontFamily: sans, fontSize: 16, letterSpacing: 3, color: BRASS, opacity: .7 }}>
      <span>THREE.JS / WEBGL</span><span>36 SECONDS · ONE CONTINUOUS VOYAGE</span>
    </div>
  </AbsoluteFill>;
}
