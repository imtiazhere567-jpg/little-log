"use client";
import { useState } from "react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
export const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
/** "2026-11-03" → "Nov 3" (or "Nov 3, 2025" when the year differs from `thisYear`). */
export function shortDate(iso: string, thisYear?: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${SHORT[m - 1]} ${d}${thisYear && y !== thisYear ? `, ${y}` : ""}`;
}

/**
 * Brand-styled month calendar (desktop popovers).
 *  - mode "single": one click picks a day
 *  - mode "range": first click = start, second click = end (hovering previews the range)
 * Click the month title to jump to any month or year (handy for birthdays).
 * Weekends are faded (no school), days after `max` are disabled.
 */
export default function BrandCalendar({ mode, start, end, max, onPick, initialView }: {
  mode: "single" | "range"; start: string | null; end?: string | null; max: string;
  onPick: (from: string, to: string) => void;
  /** where to open when nothing is picked yet, e.g. a year ago for a birthday */
  initialView?: string;
}) {
  const base = (end ?? start ?? initialView ?? max).split("-").map(Number);
  const [view, setView] = useState({ y: base[0], m: base[1] - 1 });
  const [jump, setJump] = useState(false);
  const [a, setA] = useState<string | null>(mode === "range" ? null : start);
  const [hover, setHover] = useState<string | null>(null);
  const [my, mm] = max.split("-").map(Number);

  const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const atMax = view.y > my || (view.y === my && view.m >= mm - 1);
  const shift = (n: number) => setView((v) => { const d = new Date(Date.UTC(v.y, v.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });

  const lo = mode === "range" && a ? (hover && hover < a ? hover : a) : start;
  const hi = mode === "range" && a ? (hover && hover > a ? hover : a) : (end ?? start);

  function click(iso: string) {
    if (mode === "single") return onPick(iso, iso);
    if (!a) { setA(iso); return; }
    const [f, t] = iso < a ? [iso, a] : [a, iso];
    setA(null); setHover(null);
    onPick(f, t);
  }

  const navBtn = "grid h-8 w-8 place-items-center rounded-full text-lg text-ink-2 hover:bg-surface-2 disabled:opacity-30";

  // ---- month / year jump view
  if (jump) {
    return (
      <div className="w-[300px] select-none">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setView((v) => ({ ...v, y: v.y - 1 }))} aria-label="Previous year" className={navBtn}>‹</button>
          <button type="button" onClick={() => setJump(false)} className="rounded-full px-3 py-1 text-[15px] font-bold hover:bg-surface-2">{view.y}</button>
          <button type="button" onClick={() => setView((v) => ({ ...v, y: v.y + 1 }))} disabled={view.y >= my} aria-label="Next year" className={navBtn}>›</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SHORT.map((label, m) => {
            const disabled = view.y > my || (view.y === my && m > mm - 1);
            const on = m === view.m;
            return (
              <button key={label} type="button" disabled={disabled} onClick={() => { setView((v) => ({ ...v, m })); setJump(false); }}
                className={`h-11 rounded-xl text-[14px] font-semibold transition ${on ? "bg-primary text-white" : "bg-surface-2/60 text-ink hover:bg-primary-soft hover:text-primary"} disabled:cursor-not-allowed disabled:opacity-30`}>
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((back) => (
            <button key={back} type="button" onClick={() => setView((v) => ({ ...v, y: my - back }))}
              className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${view.y === my - back ? "bg-primary-soft text-primary" : "text-ink-3 hover:bg-surface-2"}`}>
              {my - back}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[300px] select-none">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className={navBtn}>‹</button>
        <button type="button" onClick={() => setJump(true)} title="Pick a month or year"
          className="flex items-center gap-1 rounded-full px-3 py-1 text-[15px] font-bold hover:bg-surface-2">
          {MONTHS[view.m]} {view.y}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-ink-3"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <button type="button" onClick={() => shift(1)} disabled={atMax} aria-label="Next month" className={navBtn}>›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} className="py-1">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => setHover(null)}>
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const iso = isoOf(view.y, view.m, d);
          const disabled = iso > max;
          const weekend = i % 7 === 0 || i % 7 === 6;
          const isLo = iso === lo, isHi = iso === hi;
          const inside = !!lo && !!hi && iso > lo && iso < hi;
          const edge = isLo || isHi;
          return (
            <span key={i} className={`relative flex h-9 items-center justify-center
              ${inside ? "bg-primary-soft" : ""}
              ${mode === "range" && lo !== hi && isLo ? "rounded-l-full bg-primary-soft" : ""}
              ${mode === "range" && lo !== hi && isHi ? "rounded-r-full bg-primary-soft" : ""}`}>
              <button type="button" disabled={disabled} onClick={() => click(iso)} onMouseEnter={() => setHover(iso)}
                aria-label={iso} aria-pressed={edge}
                className={`grid h-9 w-9 place-items-center rounded-full text-[13.5px] font-semibold transition
                  ${edge ? "bg-primary text-white shadow-[0_4px_10px_rgba(47,111,98,.35)]" : inside ? "text-primary" : weekend ? "text-ink-3/70 hover:bg-surface-2" : "text-ink hover:bg-surface-2"}
                  ${iso === max && !edge ? "ring-1 ring-primary/50" : ""}
                  disabled:cursor-not-allowed disabled:text-line disabled:hover:bg-transparent`}>
                {d}
              </button>
            </span>
          );
        })}
      </div>
      {mode === "range" && (
        <p className="mt-2 text-center text-[12px] font-semibold text-ink-3">
          {a ? "Now pick the last day" : "Pick the first day, then the last day"}
        </p>
      )}
    </div>
  );
}
