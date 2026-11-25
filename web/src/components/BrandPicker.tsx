"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Form version of BrandPicker: keeps its value in a hidden input called `name`,
 * so it works inside plain server-action / GET forms. `autoSubmit` submits the form on change.
 */
export function BrandField({ name, defaultValue, options, ariaLabel, autoSubmit, className = "" }: {
  name: string; defaultValue: string; options: { value: string; label: string }[]; ariaLabel: string; autoSubmit?: boolean; className?: string;
}) {
  const [v, setV] = useState(defaultValue);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={className}>
      <input ref={input} type="hidden" name={name} value={v} />
      <BrandPicker ariaLabel={ariaLabel} value={v} options={options} onChange={(nv) => {
        setV(nv);
        if (autoSubmit && input.current) { input.current.value = nv; input.current.form?.requestSubmit(); }
      }} />
    </div>
  );
}

/** Brand-styled dropdown for form values (controlled). For URL filters use BrandSelect. */
export default function BrandPicker({ value, options, onChange, ariaLabel, maxHeight = 260 }: {
  value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; ariaLabel: string; maxHeight?: number;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const cur = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    // show the chosen option without scrolling by hand
    list.current?.querySelector("[aria-selected=true]")?.scrollIntoView({ block: "center" });
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-surface px-3.5 text-left text-[15px] font-semibold transition hover:border-[#D8CDBD] ${open ? "border-primary" : "border-line"}`}>
        <span className="truncate">{cur?.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className={`flex-none text-ink-3 transition ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div ref={list} role="listbox" aria-label={ariaLabel} style={{ maxHeight }}
          className="drop-in absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-3)]">
          {options.map((o) => {
            const on = o.value === cur?.value;
            return (
              <button key={o.value} type="button" role="option" aria-selected={on} onClick={() => { onChange(o.value); setOpen(false); }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${on ? "bg-primary-soft font-bold text-primary" : "font-semibold hover:bg-surface-2/70"}`}>
                {o.label}
                {on && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F6F62" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
