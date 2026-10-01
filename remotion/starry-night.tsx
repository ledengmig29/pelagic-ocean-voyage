import { useEffect, useState } from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useDelayRender } from "remotion";
import { StarryPainting } from "./starry-painting";
import { FallingLight } from "./falling-light";
import { blend, journey } from "./starry-journey";
export { STARRY_DURATION, STARRY_FPS } from "./starry-journey";

const INK = "#071522";
const PAPER = "#f3ead5";
const GOLD = "#d4bd7e";
const serif = '"Starry Serif", "Noto Serif SC", "SimSun", serif';
const latin = '"Georgia", "Times New Roman", serif';

function useFilmFont() {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading the film's Chinese serif font"));
  useEffect(() => {
    const face = new FontFace("Starry Serif", `url("${staticFile("fonts/starry-serif.woff2")}")`, { weight: "200 900" });
    face.load().then((loaded) => {
      document.fonts.add(loaded);
      continueRender(handle);
    }).catch(cancelRender);
    return () => { document.fonts.delete(face); };
  }, [handle, continueRender, cancelRender]);
}

/** Sky → light → open window → complete painting → left-hand introduction. */
export function StarryNightFilm() {
  useFilmFont();
  const frame = useCurrentFrame();
  const shot = journey(frame);
  const lightProps = { points: shot.points, headScale: shot.headScale, energy: shot.energy };
  const roomVisible = shot.roomOpacity > 0;

  return <AbsoluteFill style={{ backgroundColor: INK, color: PAPER, fontFamily: serif, overflow: "hidden" }}>
    <div style={{ position: "absolute", width: 1920, height: 1520, transformOrigin: "0 0",
      transform: `translate(${shot.x}px, ${shot.y}px) scale(${shot.scale})`,
      boxShadow: `0 26px 95px rgba(0,0,0,${shot.reveal * .38})` }}>
      <StarryPainting frame={frame}/>
    </div>

    <AbsoluteFill style={{ opacity: 1 - shot.reveal,
      background: "radial-gradient(ellipse at 61% 31%, transparent 10%, rgba(2,10,26,.14) 57%, rgba(2,10,26,.54) 100%)" }}/>

    {shot.lightOpacity > 0 && <FallingLight {...lightProps} opacity={shot.lightOpacity * (1 - shot.crossing)}/>}

    {roomVisible && <>
      <Img src={staticFile("artworks/starry-window.png")} alt="以梵高笔触演绎的敞开窗户"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "fill",
          transformOrigin: "50% 42%", transform: `scale(${shot.roomScale})`, opacity: shot.roomOpacity }}/>
      <AbsoluteFill style={{ opacity: shot.settledGlow * shot.roomOpacity * .63, mixBlendMode: "screen",
        background: "radial-gradient(ellipse 285px 83px at 74% 86%, rgba(247,183,69,.58), rgba(235,150,50,.12) 53%, transparent 100%)" }}/>
      <AbsoluteFill style={{ opacity: shot.crossing * (1 - blend(frame, 495, 563)) * .22, mixBlendMode: "screen",
        background: `radial-gradient(ellipse 360px 220px at ${shot.head.x}px ${shot.head.y}px, #efc26b, transparent 75%)` }}/>
    </>}

    {shot.lightOpacity > 0 && <FallingLight {...lightProps} opacity={shot.lightOpacity * shot.crossing}/>}

    <div style={{ position: "absolute", left: 86, top: 51, right: 86, display: "flex", justifyContent: "space-between",
      fontFamily: latin, color: PAPER, opacity: shot.information * .65 }}>
      <span style={{ fontSize: 21, letterSpacing: 5 }}>LUEUR <span style={{ marginLeft: 20, fontSize: 12, letterSpacing: 3 }}>THE LIVING GALLERY</span></span>
      <span style={{ fontSize: 14, letterSpacing: 3 }}>VINCENT VAN GOGH <span style={{ color: GOLD, margin: "0 16px" }}>/</span> 1889</span>
    </div>

    <div style={{ position: "absolute", left: 110, top: 161, width: 553, opacity: shot.information,
      transform: `translateY(${(1 - shot.information) * 18}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: latin, fontSize: 15, letterSpacing: 4, color: GOLD }}>
        <span style={{ width: 37, height: 1, background: GOLD }}/>FROM A SPARK, INTO A PAINTING
      </div>
      <div style={{ fontSize: 89, letterSpacing: 9, fontWeight: 500, marginTop: 17, lineHeight: 1.5 }}>星月夜</div>
      <div style={{ fontFamily: latin, fontSize: 34, fontStyle: "italic", opacity: .73, marginTop: 1 }}>The Starry Night</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 30 }}>
        <span style={{ fontSize: 26, letterSpacing: 2 }}>文森特·梵高</span><span style={{ fontFamily: latin, fontSize: 19, opacity: .56 }}>Vincent van Gogh</span>
      </div>
      <div style={{ height: 1, background: "#d4bd7e45", margin: "28px 0 24px" }}/>
      <div style={{ fontSize: 23, lineHeight: 1.94, letterSpacing: 1, opacity: .84 }}>
        《星月夜》创作于 1889 年 6 月。梵高在法国圣雷米疗养期间，将窗外景色与记忆、想象相融。
      </div>
      <div style={{ fontSize: 23, lineHeight: 1.94, letterSpacing: 1, opacity: .84, marginTop: 14 }}>
        起伏的柏树、宁静的村庄与翻涌的天空，共同构成这幅夜景。
      </div>
      <div style={{ height: 1, background: "#d4bd7e45", margin: "27px 0 25px" }}/>
      <div style={{ display: "grid", gridTemplateColumns: "73px 1fr", columnGap: 20, rowGap: 12, fontSize: 20, lineHeight: 1.6 }}>
        <span style={{ color: GOLD }}>材质</span><span>布面油画</span>
        <span style={{ color: GOLD }}>尺寸</span><span style={{ fontFamily: latin, fontSize: 24 }}>73.7 × 92.1 <span style={{ fontSize: 18 }}>cm</span></span>
        <span style={{ color: GOLD }}>馆藏</span><span>美国纽约现代艺术博物馆 <span style={{ fontFamily: latin }}>MoMA</span></span>
      </div>
    </div>

    <div style={{ position: "absolute", left: 793, right: 102, top: 969, display: "flex", justifyContent: "space-between",
      opacity: shot.information * .75, color: GOLD, fontSize: 14, letterSpacing: 3 }}>
      <span>从一束微光，走进梵高的夜。</span><span style={{ fontFamily: latin, fontSize: 13, letterSpacing: 2 }}>MoMA · NEW YORK</span>
    </div>
    <div style={{ position: "absolute", left: 86, right: 86, bottom: 38, display: "flex", justifyContent: "space-between",
      opacity: shot.information * .44, fontSize: 12, letterSpacing: 2 }}>
      <span style={{ fontFamily: latin }}>A JOURNEY THROUGH THE STARRY NIGHT</span><span>窗景与流光为艺术化演绎 · 原作馆藏 MoMA</span>
    </div>
  </AbsoluteFill>;
}
