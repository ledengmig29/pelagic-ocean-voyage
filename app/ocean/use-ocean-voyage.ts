"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { OCEAN_SECONDS, oceanProgressAt } from "../../remotion/ocean-journey";

type PlaybackStatus = "idle" | "playing" | "paused" | "complete";
type Controls = { toggle: () => void; replay: () => void; pause: () => void; go: (progress: number) => void };

// Resume from the displayed camera position using the same pacing as the film.
function timeAtProgress(progress: number) {
  let low = 0, high = OCEAN_SECONDS;
  for (let i = 0; i < 24; i++) {
    const middle = (low + high) / 2;
    if (oceanProgressAt(middle) < progress) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

export function useOceanVoyage(page: RefObject<HTMLDivElement | null>) {
  const [progress, setProgress] = useState(0);
  const [playback, setPlayback] = useState<PlaybackStatus>("idle");
  const displayed = useRef(0);
  const controls = useRef<Controls | null>(null);

  useEffect(() => {
    let raf = 0, last = 0, target = 0, elapsed = 0, expectedScroll = window.scrollY;
    let status: PlaybackStatus = "idle";
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const distance = () => Math.max(1, (page.current?.offsetHeight ?? innerHeight) - innerHeight);
    const setStatus = (next: PlaybackStatus) => { status = next; setPlayback(next); };
    const show = (next: number) => { displayed.current = next; setProgress(next); };
    const scrollTo = (next: number) => {
      window.scrollTo({ top: distance() * next, behavior: "instant" });
      expectedScroll = window.scrollY;
    };
    const schedule = () => { if (!document.hidden && !raf) raf = requestAnimationFrame(frame); };
    const frame = (now: number) => {
      raf = 0;
      if (document.hidden) return;
      // A scrollbar drag can arrive between scroll-event delivery and RAF.
      // Observe it before writing the next automatic position.
      if (status === "playing" && Math.abs(window.scrollY - expectedScroll) > 2) {
        pause();
        target = Math.min(1, Math.max(0, window.scrollY / distance()));
      }
      const dt = last ? (now - last) / 1000 : 0;
      last = now;
      let next: number;
      if (status === "playing") {
        elapsed = Math.min(OCEAN_SECONDS, elapsed + dt);
        next = oceanProgressAt(elapsed);
        target = next;
        scrollTo(next);
        if (elapsed === OCEAN_SECONDS) setStatus("complete");
      } else {
        next = motion.matches ? target : displayed.current + (target - displayed.current) * (1 - Math.exp(-Math.min(dt, .05) * 3.2));
        if (Math.abs(target - next) < .0001) next = target;
      }
      show(next);
      if (status === "playing" || next !== target) schedule();
      else last = 0;
    };
    const pause = () => {
      if (status !== "playing") return;
      target = displayed.current;
      last = 0;
      setStatus("paused");
    };
    const update = () => {
      if (status === "playing") {
        // Wheel/touch/key input pauses before scrolling. This also handles a
        // native scrollbar drag, without treating our own scroll events as input.
        if (Math.abs(window.scrollY - expectedScroll) <= 2) return;
        pause();
      }
      target = Math.min(1, Math.max(0, window.scrollY / distance()));
      schedule();
    };
    const play = (resume: boolean) => {
      elapsed = resume ? timeAtProgress(displayed.current) : 0;
      target = resume ? displayed.current : 0;
      show(target);
      scrollTo(target);
      last = 0;
      setStatus("playing");
      schedule();
    };
    controls.current = {
      pause,
      replay: () => play(false),
      toggle: () => {
        if (status === "playing") pause();
        else play(status === "paused" && displayed.current < 1);
      },
      go: (next) => {
        pause();
        window.scrollTo({ top: distance() * next, behavior: motion.matches ? "instant" : "smooth" });
      }
    };
    const visibility = () => {
      last = 0;
      if (document.hidden) { pause(); cancelAnimationFrame(raf); raf = 0; }
      else update();
    };
    const keyboard = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest?.("button,a,input,textarea,select,[contenteditable]")) return;
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) pause();
    };
    const resize = () => { if (status === "playing") scrollTo(displayed.current); else update(); };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", resize);
    window.addEventListener("wheel", pause, { passive: true });
    window.addEventListener("touchmove", pause, { passive: true });
    window.addEventListener("keydown", keyboard);
    document.addEventListener("visibilitychange", visibility);
    motion.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(raf);
      controls.current = null;
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", resize);
      window.removeEventListener("wheel", pause);
      window.removeEventListener("touchmove", pause);
      window.removeEventListener("keydown", keyboard);
      document.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", update);
    };
  }, [page]);

  const togglePlayback = useCallback(() => controls.current?.toggle(), []);
  const pausePlayback = useCallback(() => controls.current?.pause(), []);
  const replayPlayback = useCallback(() => controls.current?.replay(), []);
  const go = useCallback((next: number) => controls.current?.go(next), []);
  return { progress, playback, togglePlayback, pausePlayback, replayPlayback, go };
}
