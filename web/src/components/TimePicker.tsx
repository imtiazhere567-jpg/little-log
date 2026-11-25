"use client";
import { useState } from "react";

const to12 = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return { h: h % 12 || 12, m, pm: h >= 12 };
};
const to24 = (h: number, m: number, pm: boolean) => `${String((h % 12) + (pm ? 12 : 0)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
export const fmt12 = (v: string) => { const t = to12(v); return `${t.h}:${String(t.m).padStart(2, "0")} ${t.pm ? "PM" : "AM"}`; };

/**
 * Brand-styled time picker for the teacher's phone: a bottom sheet with hour buttons,
 * 5-minute steps and AM/PM, so it's quick with one thumb. Submits "HH:MM" via a hidden input.
 */
export default function TimePicker({ name, value, onChange, now, placeholder = "Set time", optional }: {
  name: string; value: string; onChange: (v: string) => void; now: () => string; placeholder?: string; optional?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cur = to12(value || now());
  const [h, setH] = useState(cur.h), [m, setM] = useState(Math.round(cur.m / 5) * 5 % 60), [pm, setPm] = useState(cur.pm);

  const openSheet = () => {
    const t = to12(value || now());
    setH(t.h); setM(Math.round(t.m / 5) * 5 % 60); setPm(t.pm);
    setOpen(true);
  };
  const done = () => { onChange(to24(h, m, pm)); setOpen(false); };

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <button type="button" onClick={openSheet}
        className={`flex h-12 w-full items-center justify-between gap-2 rounded-xl border bg-surface-2 px-3 text-[15px] font-semibold transition hover:border-primary ${value ? "border-line text-ink" : "border-dashed border-line text-ink-3"}`}>
        <span className="tabular">{value ? fmt12(value) : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-ink-3">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end" role="dialog" aria-modal="true" aria-label="Choose a time">
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/30" />
          <div className="drop-in relative w-full rounded-t-[28px] bg-surface px-5 pb-8 pt-3 shadow-[var(--shadow-3)]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
            <div className="flex items-center justify-between">
              <span className="font-display tabular text-[34px] font-semibold">{h}:{String(m).padStart(2, "0")} <span className="text-[20px] text-ink-2">{pm ? "PM" : "AM"}</span></span>
              <button type="button" onClick={() => { const t = to12(now()); setH(t.h); setM(t.m); setPm(t.pm); }}
                className="rounded-full bg-accent-soft px-3.5 py-1.5 text-[13px] font-bold text-accent-ink">Now</button>
            </div>

            <div className="eyebrow mb-1.5 mt-4">Hour</div>
            <div className="grid grid-cols-6 gap-1.5">
              {[7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6].map((x) => (
                <button key={x} type="button" onClick={() => { setH(x); if (x >= 7 && x <= 11) setPm(false); else setPm(true); }}
                  className={`h-11 rounded-xl text-[15px] font-bold transition ${h === x ? "bg-primary text-white shadow-[0_4px_10px_rgba(47,111,98,.3)]" : "bg-surface-2 text-ink hover:bg-primary-soft"}`}>{x}</button>
              ))}
            </div>

            <div className="eyebrow mb-1.5 mt-4">Minutes</div>
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i * 5).map((x) => (
                <button key={x} type="button" onClick={() => setM(x)}
                  className={`tabular h-10 rounded-xl text-[14px] font-bold transition ${m === x ? "bg-primary text-white" : "bg-surface-2 text-ink hover:bg-primary-soft"}`}>:{String(x).padStart(2, "0")}</button>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="flex rounded-xl bg-surface-2 p-1">
                {[false, true].map((v) => (
                  <button key={String(v)} type="button" onClick={() => setPm(v)}
                    className={`h-9 w-14 rounded-lg text-sm font-bold ${pm === v ? "bg-surface text-primary shadow-[var(--shadow-1)]" : "text-ink-3"}`}>{v ? "PM" : "AM"}</button>
                ))}
              </div>
              {optional && value && (
                <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="ml-1 text-sm font-semibold text-ink-3">Clear</button>
              )}
              <button type="button" onClick={done} className="btn btn-primary ml-auto">Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
