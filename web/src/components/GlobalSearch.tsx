"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Hit = { group: string; title: string; sub: string; href: string };

/** Search children, parents, teachers and incidents from anywhere on the dashboard. Press "/" to focus. */
export default function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDoc); };
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/director/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal });
        const j = (await r.json()) as { hits: Hit[] };
        setHits(j.hits); setActive(0); setOpen(true);
      } catch { /* aborted */ }
    }, 160);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const groups = [...new Set(hits.map((h) => h.group))];
  const showList = open && q.trim().length >= 2;

  return (
    <div ref={box} className="relative w-full max-w-[420px]">
      <div className={`flex h-11 items-center gap-2.5 rounded-2xl border bg-surface px-3.5 shadow-[var(--shadow-1)] ${showList ? "border-primary" : "border-line"}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A9088" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input
          ref={input}
          value={q}
          onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < 2) setHits([]); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter" && hits[active]) { router.push(hits[active].href); setOpen(false); }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search children, parents, teachers, incidents…"
          aria-label="Search"
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-ink-3"
        />
        <kbd className="rounded-md border border-line bg-surface-2 px-1.5 text-[11px] font-bold text-ink-3">/</kbd>
      </div>

      {showList && (
        <div className="drop-in absolute inset-x-0 top-[calc(100%+6px)] z-40 max-h-[420px] overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-3)]">
          {hits.length === 0 && <p className="px-3 py-4 text-center text-sm text-ink-3">No matches for “{q}”.</p>}
          {groups.map((g) => (
            <div key={g}>
              <div className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-[.08em] text-ink-3">{g}</div>
              {hits.map((h, i) => h.group === g && (
                <Link key={h.href + i} href={h.href} onClick={() => setOpen(false)} onMouseEnter={() => setActive(i)}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${i === active ? "bg-surface-2" : ""}`}>
                  <span className="min-w-0">
                    <b className="block truncate text-[14px]">{h.title}</b>
                    <span className="block truncate text-xs text-ink-3">{h.sub}</span>
                  </span>
                  <span className="text-ink-3">›</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
