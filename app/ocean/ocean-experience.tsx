"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, RotateCcw, Volume2, VolumeX, X, Compass } from "lucide-react";
import OceanCanvas from "./ocean-canvas";
import { getOceanTransition, transitionEase } from "./ocean-transition";
import "./ocean.css";

const chapters=[
  {number:"01",label:"宁静之海",english:"THE STILLNESS",progress:0},
  {number:"02",label:"驶入风暴",english:"THE TEMPEST",progress:.46},
  {number:"03",label:"瓶中世界",english:"THE REVELATION",progress:.94}
];

function useSeaSound(){
  const [enabled,setEnabled]=useState(false);
  const [available,setAvailable]=useState(true);
  const audio=useRef<HTMLAudioElement|null>(null);
  const tempest=useRef<HTMLAudioElement|null>(null);
  const currentWeather=useRef(0);
  const context=useRef<AudioContext|null>(null);
  const noise=useRef<GainNode|null>(null);
  const toggle=async()=>{
    if(enabled){audio.current?.pause();tempest.current?.pause();await context.current?.suspend();setEnabled(false);return;}
    try{
      if(!audio.current){audio.current=new Audio("/audio/ocean-ambience.mp3");audio.current.loop=true;audio.current.volume=.45;}
      if(!tempest.current){tempest.current=new Audio("/audio/storm-ambience.mp3");tempest.current.loop=true;tempest.current.volume=currentWeather.current*.58;}
      audio.current.volume=.45-currentWeather.current*.3;
      await Promise.all([audio.current.play(),tempest.current.play()]);
    }catch{
      // A local synthesized sea bed keeps the experience usable if the generated asset is unavailable.
      try{
        if(!context.current){
          const ctx=new AudioContext();context.current=ctx;
          const buffer=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate);
          const channel=buffer.getChannelData(0);let previous=0;
          for(let i=0;i<channel.length;i++){previous=(previous+(Math.random()*2-1)*.018)/1.02;channel[i]=previous*4;}
          const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
          const filter=ctx.createBiquadFilter();filter.type="lowpass";filter.frequency.value=580;
          const gain=ctx.createGain();gain.gain.value=.27;noise.current=gain;
          source.connect(filter).connect(gain).connect(ctx.destination);source.start();
        }
        await context.current.resume();
      }catch{setAvailable(false);return;}
    }
    setEnabled(true);
  };
  const weather=(storm:number)=>{currentWeather.current=storm;if(audio.current)audio.current.volume=.45-storm*.3;if(tempest.current)tempest.current.volume=storm*.58;if(noise.current)noise.current.gain.setTargetAtTime(.21+storm*.28,context.current!.currentTime,.6);};
  useEffect(()=>()=>{audio.current?.pause();tempest.current?.pause();context.current?.close();},[]);
  return {enabled,available,toggle,weather};
}

export default function OceanExperience(){
  const [progress,setProgress]=useState(0);
  const [ready,setReady]=useState(false);
  const [about,setAbout]=useState(false);
  const sound=useSeaSound();
  const page=useRef<HTMLDivElement>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const displayedProgress=useRef(0);
  const transition=getOceanTransition(progress);
  const creditReveal=transitionEase(.925,1,progress);
  const active=progress<.3?0:transition.titleReveal>0?2:1;
  useEffect(()=>{
    let raf=0,last=0,target=0,active=!document.hidden;
    const motion=window.matchMedia("(prefers-reduced-motion: reduce)");
    const frame=(now:number)=>{
      raf=0;
      if(!active)return;
      const dt=last?Math.min((now-last)/1000,.05):1/60;last=now;
      const current=displayedProgress.current;
      let next=motion.matches?target:current+(target-current)*(1-Math.exp(-dt*5.5));
      if(Math.abs(target-next)<.0001)next=target;
      displayedProgress.current=next;setProgress(next);
      if(next!==target)raf=requestAnimationFrame(frame);
      else last=0;
    };
    const update=()=>{
      const distance=Math.max(1,(page.current?.offsetHeight??innerHeight)-innerHeight);
      target=Math.min(1,Math.max(0,window.scrollY/distance));
      if(active&&!raf)raf=requestAnimationFrame(frame);
    };
    const visibility=()=>{
      active=!document.hidden;last=0;
      if(active)update();else{cancelAnimationFrame(raf);raf=0;}
    };
    update();window.addEventListener("scroll",update,{passive:true});window.addEventListener("resize",update);
    document.addEventListener("visibilitychange",visibility);motion.addEventListener("change",update);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener("scroll",update);window.removeEventListener("resize",update);
      document.removeEventListener("visibilitychange",visibility);motion.removeEventListener("change",update);};
  },[]);
  useEffect(()=>{const storm=Math.min(1,Math.max(0,(progress-.25)/.16))*(1-transition.stormRelease);sound.weather(storm);},[progress,sound,transition.stormRelease]);
  useEffect(()=>{if(about)dialog.current?.showModal();else dialog.current?.close();},[about]);
  const go=(p:number)=>{
    const distance=(page.current?.offsetHeight??innerHeight)-innerHeight;
    window.scrollTo({top:distance*p,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
  };
  return <div ref={page} className="ocean-page" data-chapter={active+1} style={{"--voyage-progress":progress} as React.CSSProperties}>
    <div className="ocean-stage">
      <OceanCanvas className="ocean-webgl" progress={progress} smoothProgress={false} onReady={()=>setReady(true)} quality="high"/>
      <div className="ocean-vignette"/>
      <div className={`ocean-loading ${ready?"is-ready":""}`} aria-hidden={ready}>
        <Compass size={28} strokeWidth={.9}/><span>正在唤醒这片海</span><i/>
      </div>
      <header className="ocean-header">
        <a className="ocean-brand" href="#stillness" onClick={e=>{e.preventDefault();go(0);}} aria-label="PELAGIC，回到海面">
          <span className="ocean-emblem"><Compass size={32} strokeWidth={.8}/></span>
          <span>PELAGIC<small>AN OCEAN IN THREE ACTS</small></span>
        </a>
        <nav aria-label="航行章节">
          {chapters.map((c,i)=><button key={c.number} onClick={()=>go(c.progress)} className={active===i?"is-active":""} aria-current={active===i?"step":undefined}><span>{c.number}</span>{c.label}</button>)}
        </nav>
        <button className="ocean-about" onClick={()=>setAbout(true)}>关于作品 <ArrowUpRight size={14}/></button>
      </header>

      <div className="ocean-hero" style={{opacity:Math.max(0,1-progress/.25),transform:`translateY(${-progress*140}px)`}} aria-hidden={active!==0} inert={active!==0}>
        <div className="ocean-eyebrow"><span/> A JOURNEY BEYOND THE HORIZON</div>
        <h1>A sea<br/><em>within.</em></h1>
        <p className="ocean-hero-cn">把一场风暴，收藏进一只玻璃瓶。</p>
        <p className="ocean-hero-copy">从一片无垠的海，驶向一个不可能的世界。<br/>向下滚动，让故事随海浪展开。</p>
        <button className="ocean-enter" onClick={()=>go(.36)}>开启航行 <span><ArrowUpRight size={19} strokeWidth={1}/></span></button>
      </div>

      <div className="ocean-act-title ocean-storm-title" style={{opacity:Math.max(0,Math.min(1,(progress-.29)/.06,(.66-progress)/.075))}} aria-hidden={active!==1}>
        <div className="ocean-eyebrow"><span/> ACT II · THE TEMPEST</div>
        <h2>Into the<br/><em>unknown.</em></h2>
        <p>风暴从不询问，谁已准备好。</p>
      </div>

      <div className="ocean-act-title ocean-bottle-title" style={{opacity:transition.titleReveal}} aria-hidden={active!==2} inert={active!==2}>
        <div className="ocean-eyebrow"><span/> ACT III · THE REVELATION</div>
        <h2>The world.<br/><em>Within reach.</em></h2>
        <p>原来，无垠也可以被珍藏。</p>
        <div className="ocean-credit" style={{opacity:creditReveal,transform:`translateY(${(1-creditReveal)*14}px)`}}>
          <span>IMAGINED & CREATED BY</span><strong>GPT 6.1 <i>Sol</i><span className="ocean-credit-star">✳</span></strong>
          <button onClick={()=>go(0)}><RotateCcw size={13}/> 再航行一次</button>
        </div>
      </div>

      <aside className="ocean-chapter-rail" aria-label="当前航程">
        <span>{String(active+1).padStart(2,"0")}</span><div className="ocean-rail-track"><i style={{height:`${progress*100}%`,transition:"none"}}/></div><span>03</span>
      </aside>

      <footer className="ocean-footer">
        <div className="ocean-location"><span className="ocean-live-dot"/><span>{active===0?"58° 21′ N · 05° 14′ E":active===1?"NORTH SEA · STORM APPROACHING":"A WHOLE WORLD · ONE GLASS BOTTLE"}<small>{chapters[active].english}</small></span></div>
        <button className={`ocean-scroll ${progress>.95?"at-end":""}`} onClick={()=>go(progress>.95?0:active===2?1:chapters[active+1].progress)} aria-label={progress>.95?"返回海面":"向下探索下一幕"}>
          <span>{progress>.95?"BACK TO THE SEA":"SCROLL TO EXPLORE"}</span><ArrowDown size={19} strokeWidth={1}/>
        </button>
        <button className={`ocean-sound ${sound.enabled?"is-on":""}`} onClick={sound.toggle} disabled={!sound.available} aria-pressed={sound.enabled} aria-label={sound.enabled?"关闭海浪声音":"开启海浪声音"}>
          {sound.enabled?<Volume2 size={16} strokeWidth={1.2}/>:<VolumeX size={16} strokeWidth={1.2}/>}<span>SOUND {sound.enabled?"ON":"OFF"}</span>
        </button>
      </footer>
      <div className="ocean-bottom-rule"><i style={{width:`${progress*100}%`}}/></div>
    </div>
    <div className="ocean-scroll-space" aria-label="滚动探索三幕故事"><section id="stillness" aria-label="第一幕：宁静之海"/><section id="tempest" aria-label="第二幕：驶入风暴"/><section id="revelation" aria-label="第三幕：瓶中世界"/></div>
    <dialog ref={dialog} className="ocean-dialog" onCancel={()=>setAbout(false)} onClick={e=>{if(e.target===e.currentTarget)setAbout(false);}}>
      <button className="ocean-dialog-close" onClick={()=>setAbout(false)} aria-label="关闭介绍"><X size={20}/></button>
      <div className="ocean-eyebrow"><span/> ABOUT THE EXPERIMENT</div>
      <h2>一片海。<br/><em>一个世界。</em></h2>
      <p>PELAGIC 是一段以滚动驱动的三维海洋叙事。宁静的北海，一艘驶入风暴的白色三桅帆船，以及镜头之外的一只玻璃瓶。</p>
      <dl><div><dt>创作</dt><dd>GPT 6.1 Sol</dd></div><div><dt>场景</dt><dd>Three.js · WebGL</dd></div><div><dt>海面</dt><dd>12 Gerstner waves · 5 normal layers</dd></div><div><dt>影像时间线</dt><dd>Remotion · HyperFrames</dd></div></dl>
      <p className="ocean-dialog-note">鼠标滚轮或触屏滑动控制镜头；右上方章节可直达各幕。海浪声需手动开启。</p>
    </dialog>
  </div>;
}
