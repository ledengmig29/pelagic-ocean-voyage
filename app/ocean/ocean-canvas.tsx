"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createOceanScene, type OceanScene } from "./ocean-engine";

export type OceanCanvasProps={progress?:number;time?:number;className?:string;onReady?:()=>void;quality?:"high"|"balanced";smoothProgress?:boolean};

export default function OceanCanvas({progress=0,time,className,onReady,quality="high",smoothProgress=true}:OceanCanvasProps){
  const container=useRef<HTMLDivElement>(null);
  const scene=useRef<OceanScene|null>(null);
  const values=useRef({progress,time,smoothProgress});
  const ready=useRef(onReady);
  const [failed,setFailed]=useState(false);
  useLayoutEffect(()=>{
    values.current={progress,time,smoothProgress};ready.current=onReady;
  },[progress,time,smoothProgress,onReady]);
  useLayoutEffect(()=>{
    // Film frames render on commit; interactive views use a single WebGL render loop.
    if(time!==undefined)scene.current?.render(time,progress);
  },[progress,time]);
  useEffect(()=>{
    if(!container.current)return;
    let raf=0;
    let active=true;
    let last=0,elapsed=0,smoothed=values.current.progress;
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try{
      scene.current=createOceanScene(container.current,{quality,reducedMotion:reduced,interactive:values.current.time===undefined,onReady:()=>ready.current?.()});
    }catch(error){
      console.error("Ocean initialization failed",error);queueMicrotask(()=>setFailed(true));ready.current?.();return;
    }
    const resize=new ResizeObserver(entries=>{
      const box=entries[0].contentRect;scene.current?.resize(box.width,box.height);
      if(values.current.time!==undefined)scene.current?.render(values.current.time,values.current.progress);
    });resize.observe(container.current);
    const visibility=()=>{active=!document.hidden;last=0;};
    document.addEventListener("visibilitychange",visibility);
    const frame=(now:number)=>{
      raf=requestAnimationFrame(frame);
      if(values.current.time!==undefined||!active)return;
      const dt=last?Math.min((now-last)/1000,.05):0;last=now;elapsed+=dt;
      smoothed+= (values.current.progress-smoothed)*(reduced||!values.current.smoothProgress?1:1-Math.exp(-dt*5.5));
      scene.current?.render(reduced?8:elapsed,smoothed);
    };
    if(values.current.time===undefined)raf=requestAnimationFrame(frame);
    else scene.current.render(values.current.time,values.current.progress);
    return()=>{cancelAnimationFrame(raf);resize.disconnect();document.removeEventListener("visibilitychange",visibility);scene.current?.dispose();scene.current=null;};
  },[quality]);
  return <div ref={container} className={className} data-ocean-canvas>{failed&&<div className="ocean-fallback"><span>此设备暂时无法开启 WebGL</span><p>请使用支持硬件加速的现代浏览器，继续探索瓶中的海。</p></div>}</div>;
}
