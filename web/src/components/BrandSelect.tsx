"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type BrandOption = { key: string; label: string; hint?: string; color?: string; href: string };

/**
 * Brand-styled filter dropdown. Options are links (the server pre-builds each URL),
 * so filters live in the address bar: shareable, back-button friendly, no client state.
 */
export default function BrandSelect({ label, icon, value, options, width = 240, full = false }: {
  label: string;
  icon: ReactNode;
  value: string;
  options: BrandOption[];
  width?: number;
  /** stretch the button to its container (e.g. two selects side by side in a panel) */
  full?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const cur = options.find((o) => o.key === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={box} className={`relative ${full ? "min-w-0" : ""}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}
        className={`flex h-11 ${full ? "w-full gap-2 pl-2.5 pr-2.5" : "gap-2.5 pl-3 pr-3.5"} items-center rounded-2xl border bg-surface text-left shadow-[var(--shadow-1)] transition hover:border-[#D8CDBD] ${open ? "border-primary" : "border-line"}`}>
        <span className={`grid flex-none place-items-center rounded-lg bg-surface-2 text-ink-2 ${full ? "h-6 w-6" : "h-7 w-7"}`}>{icon}</span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[10px] font-bold uppercase tracking-[.08em] text-ink-3">{label}</span>
          <span className="flex items-center gap-1.5 truncate text-[14px] font-bold">
            {cur.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: cur.color }} />}
            {cur.label}
          </span>
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"
          className={`ml-1 flex-none text-ink-3 transition ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div role="listbox" aria-label={label} style={{ width }}
          className="drop-in absolute left-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-3)]">
          {options.map((o) => {
            const on = o.key === cur.key;
            return (
              <Link key={o.key} href={o.href} scroll={false} role="option" aria-selected={on} onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm ${on ? "bg-primary-soft" : "hover:bg-surface-2/70"}`}>
                {o.color && <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: o.color }} />}
                <span className="min-w-0 flex-1">
                  <span className={`block ${on ? "font-bold text-primary" : "font-semibold"}`}>{o.label}</span>
                  {o.hint && <span className="block text-xs text-ink-3">{o.hint}</span>}
                </span>
                {on && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2F6F62" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
