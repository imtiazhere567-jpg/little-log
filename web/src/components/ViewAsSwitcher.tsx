"use client";
import { useEffect, useRef, useState } from "react";

type Option = { id: number; name: string; sub: string; why: string; initials: string; bg: string; fg: string };

function Face({ o, size = 40 }: { o: Option; size?: number }) {
  return (
    <span className="grid flex-none place-items-center rounded-full font-bold"
      style={{ width: size, height: size, background: o.bg, color: o.fg, fontSize: size * 0.34 }}>
      {o.initials}
    </span>
  );
}

/**
 * Demo-only "view as" picker: signs the phone in as another parent or teacher.
 * In a real deployment each person signs in with their own invite link.
 */
export default function ViewAsSwitcher({ role, current, options, back }: {
  role: "parent" | "teacher";
  current: number | null;
  options: Option[];
  back: string;
}) {
  const [open, setOpen] = useState(false);
  const [going, setGoing] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const now = options.find((o) => o.id === current) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function pick(o: Option) {
    if (o.id === now?.id) return setOpen(false);
    setGoing(o.id);
    // Full page load on purpose: the route handler sets a cookie, then the phone must reload.
    // The target is a route handler (not a page), so router.push() can't be used here.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/api/demo-login?role=${role}&user=${o.id}&next=${encodeURIComponent(back)}`);
  }

  if (!now) return null;
  return (
    <div ref={box} className="relative w-[390px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-[22px] border bg-surface px-3.5 py-3 text-left shadow-[var(--shadow-1)] transition hover:shadow-[var(--shadow-2)] ${open ? "border-primary" : "border-line"}`}
      >
        <Face o={now} size={42} />
        <span className="min-w-0 flex-1">
          <span className="eyebrow block">Viewing as {role}</span>
          <span className="block truncate text-[16px] font-bold leading-5">{now.name}</span>
          <span className="block truncate text-[12.5px] text-ink-2">{now.sub}</span>
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[12px] font-bold text-ink-2">
          Switch
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"
            className={`transition ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </button>

      {open && (
        <div role="listbox" aria-label={`Choose a ${role}`}
          className="drop-in absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[22px] border border-line bg-surface shadow-[var(--shadow-3)]">
          <div className="border-b border-line px-4 pb-2.5 pt-3.5">
            <div className="font-display text-[17px] font-semibold">Switch {role}</div>
            <div className="text-[12.5px] text-ink-3">The phone reloads as the person you pick.</div>
          </div>
          <div className="grid gap-1 p-2">
            {options.map((o) => {
              const on = o.id === now.id;
              return (
                <button key={o.id} type="button" role="option" aria-selected={on} onClick={() => pick(o)}
                  className={`flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition ${on ? "bg-primary-soft" : "hover:bg-surface-2"}`}>
                  <Face o={o} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <b className="truncate text-[15px]">{o.name}</b>
                      <span className="truncate rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-ink-2">{o.sub}</span>
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-3">{o.why}</span>
                  </span>
                  {going === o.id ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : on ? (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[12px] font-black text-white">✓</span>
                  ) : (
                    <span className="h-6 w-6 rounded-full border-2 border-line" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="bg-surface-2/70 px-4 py-2.5 text-[11.5px] leading-4 text-ink-3">
            Demo only. Real {role}s sign in with their own invite link.
          </div>
        </div>
      )}
    </div>
  );
}
