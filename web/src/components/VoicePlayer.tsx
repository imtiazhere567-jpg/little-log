"use client";
import { useEffect, useRef, useState } from "react";

const secs = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

/**
 * Plays a voice note and shows its transcript, highlighting words as they are spoken.
 * Demo: the original audio isn't stored, so it's read aloud with the browser's voice.
 */
export default function VoicePlayer({ text, highlight }: { text: string; highlight?: string }) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0); // characters spoken
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const walker = useRef<ReturnType<typeof setInterval> | null>(null);
  // word start positions, for highlighting
  const tokens = text.split(" ").reduce<{ w: string; start: number }[]>((acc, w) => {
    const prev = acc.at(-1);
    acc.push({ w, start: prev ? prev.start + prev.w.length + 1 : 0 });
    return acc;
  }, []);
  const words = text.split(" ").length;
  const total = Math.max(3, Math.round(words / 2.6)); // ~ speaking pace

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    if (timer.current) clearInterval(timer.current);
    if (walker.current) clearInterval(walker.current);
  }, []);

  function stop() {
    window.speechSynthesis?.cancel();
    if (timer.current) clearInterval(timer.current);
    if (walker.current) clearInterval(walker.current);
    timer.current = null; walker.current = null;
    setPlaying(false); setPos(0); setElapsed(0);
  }

  function play() {
    if (playing) return stop();
    setPlaying(true); setPos(0); setElapsed(0);
    const started = Date.now();
    timer.current = setInterval(() => setElapsed((Date.now() - started) / 1000), 200);
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (synth && typeof SpeechSynthesisUtterance !== "undefined" && synth.getVoices().length > 0) {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US"; u.rate = 1;
      const voice = synth.getVoices().find((v) => /en-US/i.test(v.lang) && /female|samantha|zira|jenny|aria/i.test(v.name))
        ?? synth.getVoices().find((v) => /en/i.test(v.lang));
      if (voice) u.voice = voice;
      u.onboundary = (e) => setPos(e.charIndex);
      u.onend = () => stop();
      u.onerror = () => stop();
      synth.speak(u);
    } else {
      // no speech engine: walk through the words at a natural pace
      let i = 0;
      walker.current = setInterval(() => {
        i += 1;
        setPos(tokens[Math.min(i, tokens.length - 1)].start + (i >= tokens.length ? text.length : 0));
        if (i >= words) { if (walker.current) clearInterval(walker.current); setTimeout(stop, 400); }
      }, 380);
    }
  }

  const progress = playing ? Math.min(1, pos ? pos / text.length : elapsed / total) : 0;
  return (
    <div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={play} aria-label={playing ? "Stop" : "Play voice note"}
          className={`grid h-10 w-10 flex-none place-items-center rounded-full text-white shadow-[0_4px_10px_rgba(232,149,90,.4)] transition active:scale-95 ${playing ? "bg-[#D0663A]" : "bg-accent"}`}>
          {playing
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M7 4.5v15l12-7.5z" /></svg>}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex h-7 items-center gap-[3px]" aria-hidden>
            {Array.from({ length: 28 }).map((_, i) => {
              const h = 6 + ((i * 37) % 19);
              const on = i / 28 < progress;
              return <i key={i} className={`block w-[3px] rounded-full transition-colors ${on ? "bg-accent" : "bg-line"} ${playing && on ? "wave-bar" : ""}`} style={{ height: h, animationDelay: `${(i % 5) * 0.1}s` }} />;
            })}
          </div>
        </div>
        <span className="tabular w-10 text-right text-[12px] font-semibold text-ink-3">{secs(playing ? Math.min(elapsed, total) : total)}</span>
      </div>
      <p className="mt-2.5 text-[14.5px] leading-[22px]">
        {tokens.map(({ w, start }, i) => (
          <span key={i}><span className={`${playing ? (start < pos ? "text-ink" : "text-ink-3") : "text-ink"} ${highlight && w.replace(/[^A-Za-z]/g, "") === highlight ? "rounded bg-accent-soft px-0.5 font-bold text-accent-ink" : ""}`}>{w}</span> </span>
        ))}
      </p>
    </div>
  );
}
