"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { ArrowDown, ArrowUpRight, ChevronLeft, ChevronRight, Maximize2, Pause, Play, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ArtFilm } from "./art-film";
import { artworks, CHAPTER_FRAMES, FILM_FRAMES, FPS } from "./artworks";
const formatTime = (f: number) => `${Math.floor(f / FPS / 60).toString().padStart(2, "0")}:${Math.floor(f / FPS % 60).toString().padStart(2, "0")}`;
const englishNames = ["Starry night", "Gathering storm", "Golden hour"];

const FilmPlayer = memo(function FilmPlayer({ playerRef, reduced }: { playerRef: React.RefObject<PlayerRef | null>; reduced: boolean }) {
  const props = useMemo(() => ({ still: reduced }), [reduced]);
  return <Player ref={playerRef} component={ArtFilm} inputProps={props} durationInFrames={FILM_FRAMES} fps={FPS} compositionWidth={1920} compositionHeight={1080} controls={false} loop initiallyMuted autoPlay={!reduced} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false} style={{ width: "100%", height: "100%" }} errorFallback={() => <div className="film-error">影像暂时无法播放，仍可欣赏原作。</div>} />;
});

function Transport({ playerRef, ready, error, cinema, setCinema, chapter, jump }: { playerRef: React.RefObject<PlayerRef | null>; ready: boolean; error: boolean; cinema: boolean; setCinema: (v: boolean) => void; chapter: number; jump: (n: number) => void }) {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !ready) return;
    const update = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const play = () => setPlaying(true);
    const pause = () => setPlaying(false);
    p.addEventListener("frameupdate", update); p.addEventListener("play", play); p.addEventListener("pause", pause);
    setPlaying(p.isPlaying());
    return () => { p.removeEventListener("frameupdate", update); p.removeEventListener("play", play); p.removeEventListener("pause", pause); };
  }, [playerRef, ready]);
  return <div className="player-controls">
    <button className="play-button" aria-label={playing ? "暂停影像" : "播放影像"} onClick={e => playerRef.current?.toggle(e)} disabled={!ready || error}>{playing ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}</button>
    <span className="timecode">{formatTime(frame)} <span>/ 01:12</span></span>
    <Slider className="film-slider" aria-label="影像播放进度" value={[frame]} min={0} max={FILM_FRAMES - 1} step={1} onValueChange={([value]) => { playerRef.current?.seekTo(value); setFrame(value); }}/>
    <div className="chapter-stepper"><button className="icon-button" onClick={() => jump((chapter + 2) % 3)} aria-label="上一幅画"><ChevronLeft size={18}/></button><span>0{chapter + 1} / 03</span><button className="icon-button" onClick={() => jump((chapter + 1) % 3)} aria-label="下一幅画"><ChevronRight size={18}/></button></div>
    <button className="immersive-button" onClick={() => setCinema(!cinema)} aria-label={cinema ? "退出沉浸模式" : "进入沉浸模式"} aria-pressed={cinema}><Maximize2 size={16}/><span>{cinema ? "退出沉浸" : "沉浸观看"}</span></button>
  </div>;
}

export default function Gallery() {
  const player = useRef<PlayerRef>(null);
  const exhibition = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [cinema, setCinema] = useState(false);
  const [details, setDetails] = useState<number | null>(null);
  const [about, setAbout] = useState(false);
  const [error, setError] = useState(false);
  const art = artworks[chapter];
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches); setReady(true);
    const change = () => { setReduced(query.matches); if (query.matches) player.current?.pause(); };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const p = player.current; if (!p) return;
    const update = ({ detail }: { detail: { frame: number } }) => setChapter(Math.min(2, Math.floor(detail.frame / CHAPTER_FRAMES)));
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => { setError(true); setPlaying(false); };
    p.addEventListener("frameupdate", update); p.addEventListener("play", onPlay); p.addEventListener("pause", onPause); p.addEventListener("error", onError);
    if (!reduced) p.play(); setPlaying(p.isPlaying());
    return () => { p.removeEventListener("frameupdate", update); p.removeEventListener("play", onPlay); p.removeEventListener("pause", onPause); p.removeEventListener("error", onError); };
  }, [ready, reduced]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCinema(false);
      if (details !== null || about || (event.target as HTMLElement)?.closest("button, input, [role=slider], a")) return;
      if (event.code === "Space") { event.preventDefault(); player.current?.toggle(); }
      if (event.key === "ArrowRight") player.current?.seekTo(((chapter + 1) % 3) * CHAPTER_FRAMES);
      if (event.key === "ArrowLeft") player.current?.seekTo(((chapter + 2) % 3) * CHAPTER_FRAMES);
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [chapter, details, about]);
  useEffect(() => {
    if (!cinema) return;
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [cinema]);
  const jump = (index: number, scroll = false) => {
    player.current?.seekTo(index * CHAPTER_FRAMES); setChapter(index);
    if (!reduced) player.current?.play();
    if (scroll) exhibition.current?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "center" });
  };
  return <main>
    <header className="site-header">
      <a className="brand" href="#" aria-label="LUEUR 首页"><span className="brand-mark">l.</span><span>LUEUR<span className="brand-sub">THE LIVING GALLERY</span></span></a>
      <nav aria-label="主导航"><a className="nav-current" href="#exhibition">影像展厅<span>Exhibition</span></a><a href="#collection">作品集<span>Collection</span></a><button onClick={() => setAbout(true)}>关于<span>About</span></button></nav>
      <span className="edition">线上特展 <span>VOL. 001</span></span>
    </header>
    <section className="intro" aria-labelledby="page-title">
      <div className="intro-label"><span className="small-cross">✳</span> AN EXHIBITION IN MOTION <span className="intro-line" /></div>
      <div className="intro-main"><div><h1 id="page-title">光的形状<span className="title-dot">.</span><em>A study in light.</em></h1></div><div className="intro-copy"><p>让目光慢下来。<br/>在静止的画布里，遇见流动的时间。</p><a href="#collection">三幅画作 · 三种光景 <ArrowDown size={15}/></a></div></div>
    </section>
    <section ref={exhibition} id="exhibition" className={`exhibition ${cinema ? "cinema-mode" : ""}`} aria-label="动态油画展厅">
      <div className="film-stage">
        <div className="film-backdrop" style={{ backgroundImage: `url(/${art.image})`, backgroundPosition: art.position }}/>
        {ready && !error && <div className="player-viewport"><FilmPlayer playerRef={player} reduced={reduced}/></div>}
        <div className="film-topline"><span className="film-label">THE LIVING CANVAS</span><span className="film-status"><span className={playing ? "status-line playing" : "status-line"}/>{playing ? "流动中" : "静静欣赏"}</span></div>
        <div key={chapter} className="film-caption"><span className="chapter-eyebrow">CHAPTER {art.number} <span /> {art.subtitle}</span><h2>{art.name}<span> / </span><em>{englishNames[chapter]}</em></h2><p>{art.artist}{art.year && <><span>·</span>{art.year}</>}</p></div>
        <div className="film-side"><span>{art.number}</span><span className="side-rule"/><span>03</span></div>
        {cinema && <button className="cinema-close icon-button" onClick={() => setCinema(false)} aria-label="退出沉浸模式"><X size={21}/></button>}
        <div className="film-bottom"><button className="text-button artwork-link" onClick={() => { player.current?.pause(); setDetails(chapter); }}>走近这幅画 <ArrowUpRight size={16}/></button><span className="film-note">OIL ON CANVAS · REIMAGINED IN MOTION</span></div>
      </div>
      <Transport playerRef={player} ready={ready} error={error} cinema={cinema} setCinema={setCinema} chapter={chapter} jump={jump}/>
    </section>
    <section className="collection" id="collection" aria-labelledby="collection-title">
      <div className="section-heading"><h2 id="collection-title">光的三个章节 <span>THE COLLECTION</span></h2><span className="collection-note">跨越三个世纪的凝望 <span>01 — 03</span></span></div>
      <div className="art-grid">{artworks.map((item, i) => <button key={item.id} onClick={() => jump(i, true)} className={`art-card ${chapter === i ? "active" : ""}`} aria-label={`观看第${i + 1}章：${item.name}，${item.artist}`} aria-pressed={chapter === i}>
        <div className="art-card-image"><img src={`/${item.image}`} alt={`${item.artistZh} · ${item.title}`} loading="lazy"/><div className="card-shade"/><span className="card-number">{item.number}</span><span className="card-play"><Play size={17} fill="currentColor"/></span><span className="card-state">{chapter === i ? "正在展映" : "进入章节"}</span><span className="card-duration">24 SEC</span></div>
        <div className="card-title"><h3>{item.name}<span>{englishNames[i]}</span></h3><ArrowUpRight size={19}/></div><p>{item.artist} <span>{item.year}</span></p>
      </button>)}</div>
    </section>
    <footer><div className="footer-brand">LUEUR<span>光停留的地方。</span></div><span>TAKE YOUR TIME. STAY A LITTLE LONGER.</span><a href="#">回到光里 <ArrowUpRight size={14}/></a></footer>
    <Dialog open={details !== null} onOpenChange={(open) => { if (!open) setDetails(null); }}><DialogContent className="art-dialog">{details !== null && <><div className="detail-image"><img src={`/${artworks[details].image}`} alt={artworks[details].title}/></div><div className="detail-copy"><span className="eyebrow">CHAPTER {artworks[details].number} / {artworks[details].medium}</span><DialogTitle>{artworks[details].name}<em>{artworks[details].title}</em></DialogTitle><p className="detail-artist">{artworks[details].artistZh}{artworks[details].year && ` · ${artworks[details].year}`}</p><DialogDescription>{artworks[details].detail}</DialogDescription><div className="palette">{artworks[details].palette.map(color => <span key={color} style={{ background: color }}/>) }<span className="palette-label">画中的颜色</span></div><button className="detail-watch" onClick={() => { const selected = details; setDetails(null); jump(selected, true); }}><Play size={15}/> 观看这一章</button>{artworks[details].source && <a className="source-link" href={artworks[details].source} target="_blank" rel="noreferrer">馆藏资料 <ArrowUpRight size={14}/></a>}</div></>}</DialogContent></Dialog>
    <Dialog open={about} onOpenChange={setAbout}><DialogContent className="about-dialog"><span className="eyebrow">ABOUT LUEUR</span><DialogTitle>给凝望，一点时间。</DialogTitle><DialogDescription>Lueur，在法语里，是一缕微光。<br/><br/>这场线上展览从三幅油画出发：星空的律动、风暴前的静默、衣褶间的暖光。缓慢的镜头，让那些被匆匆略过的细节重新浮现。<br/><br/>每个章节 24 秒，完整影像 72 秒。你可以暂停、选择章节，或进入沉浸模式。按空格播放与暂停，方向键切换画作，Esc 退出沉浸。<br/><br/>影像为原作的数字演绎。画作始终保有自己的故事。</DialogDescription></DialogContent></Dialog>
  </main>;
}
