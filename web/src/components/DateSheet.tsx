"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * Brand-styled date picker for the phone: a bottom sheet with a month calendar.
 * Weekends are faded (no school), future days are disabled. Picking a day navigates
 * to `path` with `?date=` (other params in `keep` are preserved).
 */
export default function DateSheet({ value, max, path, keep = {}, label = "Pick a day" }: {
  value: string; max: string; path: string; keep?: Record<string, string>; label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vy, vm] = value.split("-").map(Number);
  const [view, setView] = useState({ y: vy, m: vm - 1 });
  const [my, mm] = max.split("-").map(Number);

  const go = (date: string) => {
    const q = new URLSearchParams(keep);
    if (date !== max) q.set("date", date); else q.delete("date");
    setOpen(false);
    router.push(`${path}${q.toString() ? `?${q}` : ""}`, { scroll: false });
  };
  const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay(); // 0 = Sunday
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const atMax = view.y > my || (view.y === my && view.m >= mm - 1);
  const shift = (n: number) => setView((v) => { const d = new Date(Date.UTC(v.y, v.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });

  return (
    <>
      <button type="button" onClick={() => { setView({ y: vy, m: vm - 1 }); setOpen(true); }} aria-label={label}
        className="flex h-14 min-w-[62px] flex-none flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-3 text-ink-2 transition hover:border-primary hover:text-primary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
        <span className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wider">More</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end" role="dialog" aria-modal="true" aria-label={label}>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/30" />
          <div className="drop-in relative w-full rounded-t-[28px] bg-surface px-5 pb-8 pt-3 shadow-[var(--shadow-3)]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => shift(-1)} aria-label="Previous month"
                className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-lg font-bold text-ink-2 hover:bg-primary-soft">‹</button>
              <b className="font-display text-[20px]">{MONTHS[view.m]} {view.y}</b>
              <button type="button" onClick={() => shift(1)} disabled={atMax} aria-label="Next month"
                className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-lg font-bold text-ink-2 hover:bg-primary-soft disabled:opacity-30">›</button>
            </div>

            <div className="mt-4 grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wider text-ink-3">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <span key={d} className="py-1">{d}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <span key={`b${i}`} />;
                const date = iso(view.y, view.m, d);
                const wd = (first + d - 1) % 7;
                const weekend = wd === 0 || wd === 6;
                const future = date > max;
                const sel = date === value, isToday = date === max;
                return (
                  <button key={date} type="button" disabled={future} onClick={() => go(date)}
                    className={`tabular grid h-11 place-items-center rounded-xl text-[15px] font-semibold transition
                      ${sel ? "bg-primary text-white shadow-[0_4px_10px_rgba(47,111,98,.3)]"
                        : future ? "text-ink-3/30"
                        : weekend ? "text-ink-3/60 hover:bg-surface-2"
                        : "text-ink hover:bg-primary-soft"}
                      ${isToday && !sel ? "ring-2 ring-accent" : ""}`}>
                    {d}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="flex items-center gap-3 text-[12px] text-ink-3">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full ring-2 ring-accent" />Today</span>
                <span>Weekends faded · no school</span>
              </span>
              <button type="button" onClick={() => go(max)} className="rounded-full bg-accent-soft px-3.5 py-1.5 text-[13px] font-bold text-accent-ink">Today</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
