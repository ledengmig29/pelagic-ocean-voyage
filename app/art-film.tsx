"use client";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { artworks, CHAPTER_FRAMES, FILM_FRAMES } from "./artworks";
export type ArtFilmProps = { still?: boolean; captions?: boolean };
export function ArtFilm({ still = false, captions = false }: ArtFilmProps) {
  const frame = useCurrentFrame();
  const index = Math.min(2, Math.floor(frame / CHAPTER_FRAMES));
  const local = frame % CHAPTER_FRAMES;
  const progress = still ? 0.34 : local / CHAPTER_FRAMES;
  const art = artworks[index];
  const nextIndex = (index + 1) % 3;
  const dissolve = still ? 0 : interpolate(local, [CHAPTER_FRAMES - 50, CHAPTER_FRAMES - 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = index === 0 ? 1.07 + progress * 0.11 : index === 1 ? 1.14 - progress * 0.075 : 1.035 + progress * 0.12;
  const drift = index === 0 ? (progress - 0.5) * -25 : index === 1 ? (progress - 0.5) * 48 : (progress - 0.5) * -22;
  const glow = still ? 0.09 : 0.07 + Math.sin(frame / 95) * 0.035;
  return <AbsoluteFill style={{ background: "#101310", overflow: "hidden" }}>
    <Img src={staticFile(art.image)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: art.position, transform: `translateX(${drift}px) scale(${zoom})`, filter: index === 1 ? "brightness(1.22) saturate(.9)" : "saturate(.92)", willChange: "transform" }} />
    <AbsoluteFill style={{ opacity: glow, mixBlendMode: "screen", background: index === 0 ? "radial-gradient(ellipse at 75% 26%, #eee2a0 0%, transparent 45%)" : index === 1 ? "linear-gradient(115deg, transparent 20%, #aaa88b 52%, transparent 75%)" : "linear-gradient(125deg, transparent 25%, #ffe3a5 65%, transparent 100%)", transform: `translateX(${still ? 0 : Math.sin(frame / 210) * 30}px)` }} />
    {dissolve > 0 && <AbsoluteFill style={{ opacity: dissolve }}><Img src={staticFile(artworks[nextIndex].image)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: artworks[nextIndex].position, transform: `scale(${nextIndex === 1 ? 1.14 : nextIndex === 0 ? 1.07 : 1.035})`, filter: nextIndex === 1 ? "brightness(1.22) saturate(.9)" : "saturate(.92)" }} /></AbsoluteFill>}
    <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(11,16,15,.57), transparent 56%), linear-gradient(0deg, rgba(8,13,12,.7), transparent 48%, rgba(8,13,12,.05))" }} />
    {captions && <AbsoluteFill style={{ justifyContent: "flex-end", padding: 95, color: "#f0ece0", fontFamily: "Georgia, serif" }}><div style={{ fontSize: 21, letterSpacing: 5, marginBottom: 24 }}>LUEUR / A STUDY IN LIGHT</div><div style={{ fontSize: 82, marginBottom: 20 }}>{art.title}</div><div style={{ fontSize: 28 }}>{art.artist} · {art.year}</div><div style={{ position: "absolute", bottom: 38, left: 95, right: 95, height: 1, background: "#ffffff33" }}><div style={{ width: `${frame / FILM_FRAMES * 100}%`, height: 1, background: "#eee6c8" }}/></div></AbsoluteFill>}
  </AbsoluteFill>;
}
