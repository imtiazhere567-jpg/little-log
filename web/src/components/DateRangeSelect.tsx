"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BrandCalendar, { isoOf } from "./BrandCalendar";

type Preset = { key: string; label: string; href: string };

const CalIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
);

/**
 * Date range filter: quick presets on the left, a brand calendar on the right for any custom range.
 * `customHref` contains FROM and TO placeholders that are swapped for the picked days.
 */
export default function DateRangeSelect({ value, label, presets, custom, customHref, max }: {
  value: string; label: string; presets: Preset[]; custom: { from: string; to: string } | null; customHref: string; max: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const go = (from: string, to: string) => {
    setOpen(false);
    router.push(customHref.replace("FROM", from).replace("TO", to), { scroll: false });
  };
  // extra quick ranges, worked out from the center's "today"
  const [y, m] = max.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 2, 1));
  const quick = [
    { label: "This month", from: isoOf(y, m - 1, 1), to: max },
    { label: "Last month", from: isoOf(prev.getUTCFullYear(), prev.getUTCMonth(), 1), to: new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10) }, // day 0 = last day of the month before
  ];

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={open}
        className={`flex h-11 items-center gap-2.5 rounded-2xl border bg-surface pl-3 pr-3.5 text-left shadow-[var(--shadow-1)] transition hover:border-[#D8CDBD] ${open ? "border-primary" : "border-line"}`}>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface-2 text-ink-2"><CalIcon /></span>
        <span className="leading-tight">
          <span className="block text-[10px] font-bold uppercase tracking-[.08em] text-ink-3">Date range</span>
          <span className="block text-[14px] font-bold">{label}</span>
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"
          className={`ml-1 text-ink-3 transition ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && (
        <div role="dialog" aria-label="Choose a date range"
          className="drop-in absolute left-0 top-[calc(100%+6px)] z-40 flex overflow-hidden rounded-[20px] border border-line bg-surface shadow-[var(--shadow-3)]">
          <div className="w-[190px] border-r border-line bg-bg/60 p-1.5">
            {presets.map((o) => {
              const on = o.key === value;
              return (
                <Link key={o.key} href={o.href} scroll={false} onClick={() => setOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${on ? "bg-primary-soft font-bold text-primary" : "font-semibold hover:bg-surface-2/70"}`}>
                  {o.label}
                  {on && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F6F62" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>}
                </Link>
              );
            })}
            <div className="mx-3 my-1.5 h-px bg-line" />
            {quick.map((q) => (
              <button key={q.label} type="button" onClick={() => go(q.from, q.to)}
                className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-surface-2/70 ${custom?.from === q.from && custom?.to === q.to ? "bg-primary-soft text-primary" : ""}`}>
                {q.label}
              </button>
            ))}
            <div className={`mt-1 rounded-xl px-3 py-2.5 text-sm ${value === "custom" ? "bg-primary-soft font-bold text-primary" : "font-semibold text-ink-2"}`}>
              Custom range →
              {value === "custom" && <span className="block text-[11.5px] font-semibold text-primary/80">{label}</span>}
            </div>
          </div>
          <div className="p-4">
            <BrandCalendar mode="range" start={custom?.from ?? null} end={custom?.to ?? null} max={max} onPick={go} />
          </div>
        </div>
      )}
    </div>
  );
}
