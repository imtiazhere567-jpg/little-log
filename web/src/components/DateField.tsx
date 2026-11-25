"use client";
import { useEffect, useRef, useState } from "react";
import BrandCalendar, { shortDate } from "./BrandCalendar";

/**
 * Brand-styled date input for forms: a button that opens the brand calendar and keeps
 * the value in a hidden input (`name`). With `autoSubmit`, picking a day submits the form.
 * `onChange` lets client forms (like the enrollment wizard) follow the value.
 */
export default function DateField({ name, value, max, autoSubmit, className = "", ariaLabel, onChange, placeholder = "Pick a date", initialView, required }: {
  name?: string; value: string; max: string; autoSubmit?: boolean; className?: string; ariaLabel?: string;
  onChange?: (v: string) => void; placeholder?: string; initialView?: string; required?: boolean;
}) {
  const [v, setV] = useState(value);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function pick(d: string) {
    setV(d);
    setOpen(false);
    onChange?.(d);
    if (autoSubmit && input.current) {
      input.current.value = d;
      input.current.form?.requestSubmit();
    }
  }
  let label = placeholder;
  if (v) {
    const [y, m, d] = v.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    label = `${wd}, ${shortDate(v, Number(max.slice(0, 4)))}`;
  }

  return (
    <div ref={box} className={`relative ${className}`}>
      {name && <input ref={input} type="hidden" name={name} value={v} required={required} />}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel ?? "Pick a date"}
        className={`flex h-11 w-full items-center gap-2.5 rounded-xl border bg-surface px-3 text-left text-sm font-semibold transition hover:border-[#D8CDBD] ${open ? "border-primary" : "border-line"}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="flex-none text-ink-3"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
        <span className={`flex-1 whitespace-nowrap ${v ? "" : "font-medium text-ink-3"}`}>{label}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className={`text-ink-3 transition ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div role="dialog" aria-label="Calendar" className="drop-in absolute left-0 top-[calc(100%+6px)] z-40 rounded-[20px] border border-line bg-surface p-4 shadow-[var(--shadow-3)]">
          <BrandCalendar mode="single" start={v || null} max={max} initialView={initialView} onPick={(f) => pick(f)} />
        </div>
      )}
    </div>
  );
}
