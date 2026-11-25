"use client";
import { useEffect, useRef, useState } from "react";

/**
 * A phone simulator: shows an app route inside an iPhone-sized frame on desktop.
 * On a real phone (narrow screen) it opens the app full-screen instead.
 */
export default function PhoneFrame({ src, label, time, tz, home }: { src: string; label: string; time?: string; tz?: string; home?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [clock, setClock] = useState(time ?? "");

  useEffect(() => {
    if (window.innerWidth < 520) window.location.replace(src);
    // the daycare's local time, not the viewer's
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/, ""));
    tick();
    const t = setInterval(tick, 20_000);
    return () => clearInterval(t);
  }, [src, tz]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative overflow-hidden"
        style={{
          width: 390, height: 844, borderRadius: 52, background: "#1d1a18", padding: 11,
          boxShadow: "0 0 0 1px #3a3430, 0 30px 80px rgba(40,25,10,.35)",
        }}
      >
        <div className="relative h-full w-full overflow-hidden bg-bg" style={{ borderRadius: 42 }}>
          {/* status bar */}
          <div className="absolute inset-x-0 top-0 z-20 flex h-[46px] items-start justify-between px-7 pt-[14px] text-[14px] font-bold text-ink pointer-events-none">
            <span className="tabular">{clock}</span>
            <span className="flex items-center gap-1.5 text-[11px] tracking-wider">
              <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.5" y="5" width="3" height="6" rx="1"/><rect x="9" y="2.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>
              <svg width="25" height="12" viewBox="0 0 25 12" fill="none"><rect x=".5" y=".5" width="21" height="11" rx="3.5" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor"/><rect x="23" y="4" width="1.5" height="4" rx=".75" fill="currentColor" opacity=".4"/></svg>
            </span>
          </div>
          <div className="absolute left-1/2 top-[10px] z-30 h-[32px] w-[118px] -translate-x-1/2 rounded-full bg-black" />
          <iframe ref={ref} src={src} title={label} allow="microphone" className="absolute inset-0 h-full w-full border-0" />
          {home ? (
            // the home bar works like a real phone: tap it to go back to the home screen
            <button type="button" aria-label="Go to the home screen" title="Home screen"
              onClick={() => { if (ref.current?.contentWindow) ref.current.contentWindow.location.href = home; }}
              className="group absolute bottom-0 left-1/2 z-30 grid h-[18px] w-[170px] -translate-x-1/2 place-items-center">
              <span className="h-[5px] w-[134px] rounded-full bg-ink/80 transition group-hover:w-[150px] group-hover:bg-ink" />
            </button>
          ) : (
            <div className="pointer-events-none absolute bottom-[7px] left-1/2 z-30 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-ink/80" />
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm text-ink-2">
        <span className="eyebrow">{label}</span>
        {home && (
          <button className="font-semibold text-primary hover:underline" onClick={() => { if (ref.current?.contentWindow) ref.current.contentWindow.location.href = home; }}>
            ⌂ Home
          </button>
        )}
        <button className="font-semibold text-primary hover:underline" onClick={() => ref.current?.contentWindow?.location.reload()}>
          Reload
        </button>
        <a className="font-semibold text-primary hover:underline" href={src} target="_blank" rel="noreferrer">Open full screen ↗</a>
      </div>
    </div>
  );
}
