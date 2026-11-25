"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Alert = { id: number; kind: "report_sent" | "incident" | "message" | "attendance"; title: string; body: string; href: string; createdAt: string; read: boolean };
type Due = { notSent: number; title: string; body: string; href: string } | null;

const KIND = {
  report_sent: { bg: "bg-primary-soft", fg: "text-primary", icon: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="m9 14 2 2 4-4" /></> },
  incident: { bg: "bg-danger-soft", fg: "text-danger", icon: <><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" /><path d="M12 10v4M12 17v.01" /></> },
  message: { bg: "bg-activity-soft", fg: "text-activity", icon: <path d="M4 5h16v11H9l-5 4z" /> },
  attendance: { bg: "bg-warning-soft", fg: "text-[#8A5E0F]", icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> },
} as const;

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < -1) return "today"; // demo data placed later in the day than the visitor's clock
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

function KindIcon({ kind, size = 34 }: { kind: Alert["kind"]; size?: number }) {
  const k = KIND[kind];
  return (
    <span className={`grid flex-none place-items-center rounded-[11px] ${k.bg} ${k.fg}`} style={{ width: size, height: size }}>
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{k.icon}</svg>
    </span>
  );
}

/**
 * The director's notification bell: reports sent, incidents to approve, parent messages,
 * and a reminder when reports are still missing near send time. New alerts also pop up
 * as a toast in the corner while the director app is open.
 */
export default function DirectorBell() {
  const router = useRouter();
  const [items, setItems] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);
  const [due, setDue] = useState<Due>(null);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<Alert[]>([]);
  const maxSeen = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/director/alerts", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as { items: Alert[]; unread: number; due: Due };
      setItems(d.items); setUnread(d.unread); setDue(d.due);
      const top = d.items[0]?.id ?? 0;
      if (maxSeen.current === null) maxSeen.current = top; // first load: no toasts for old alerts
      else if (top > maxSeen.current) {
        const fresh = d.items.filter((a) => a.id > maxSeen.current! && !a.read).slice(0, 3);
        maxSeen.current = top;
        if (fresh.length) {
          setToasts((t) => [...fresh, ...t].slice(0, 3));
          router.refresh(); // sidebar counts
        }
      }
    } catch { /* offline: next poll */ }
  }, [router]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 4000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts([]), 7000);
    return () => clearTimeout(t);
  }, [toasts]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function go(a: Alert) {
    setOpen(false);
    setToasts((t) => t.filter((x) => x.id !== a.id));
    if (!a.read) await fetch("/api/director/alerts", { method: "POST", body: JSON.stringify({ id: a.id }) });
    router.push(a.href);
    load();
  }
  async function readAll() {
    await fetch("/api/director/alerts", { method: "POST", body: JSON.stringify({ all: true }) });
    load();
  }

  const badge = unread + (due ? 1 : 0);

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${badge ? `, ${badge} new` : ""}`} aria-expanded={open}
        className={`relative grid h-10 w-10 place-items-center rounded-[13px] border transition ${open ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-ink-2 hover:text-primary"}`}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0" />
        </svg>
        {badge > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-surface bg-danger px-1 text-[10.5px] font-extrabold text-white">{badge > 9 ? "9+" : badge}</span>}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications"
          className="drop-in fixed left-[276px] top-4 z-[60] flex max-h-[calc(100vh-32px)] w-[400px] flex-col overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_24px_60px_rgba(40,25,10,.22)]">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <b className="text-[16px]">Notifications</b>
            {unread > 0 && <button type="button" onClick={readAll} className="text-[13px] font-bold text-primary hover:underline">Mark all read</button>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {due && (
              <button type="button" onClick={() => { setOpen(false); router.push(due.href); }}
                className="mb-1 flex w-full items-center gap-3 rounded-2xl border border-warning/40 bg-warning-soft px-3 py-3 text-left">
                <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[11px] bg-warning text-white">⏰</span>
                <span className="min-w-0 flex-1"><b className="block text-[14px] text-[#8A5E0F]">{due.title}</b><span className="text-[12.5px] text-[#8A5E0F]/80">{due.body} · see who&apos;s left</span></span>
              </button>
            )}
            {items.map((a) => (
              <button key={a.id} type="button" onClick={() => go(a)}
                className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-surface-2 ${a.read ? "" : "bg-primary-soft/35"}`}>
                <KindIcon kind={a.kind} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <b className={`text-[13.5px] leading-[18px] ${a.read ? "font-semibold text-ink-2" : ""}`}>{a.title}</b>
                    {!a.read && <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-primary" />}
                  </span>
                  <span className="block truncate text-[12.5px] text-ink-3">{a.body}</span>
                  <span className="text-[11.5px] text-ink-3">{ago(a.createdAt)}</span>
                </span>
              </button>
            ))}
            {!items.length && !due && <p className="px-4 py-10 text-center text-sm text-ink-3">You&apos;re all caught up 🎉</p>}
          </div>
        </div>
      )}

      {/* toasts for alerts that arrive while the app is open */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-[70] grid w-[360px] gap-2" aria-live="polite">
          {toasts.map((a) => (
            <button key={a.id} type="button" onClick={() => go(a)}
              className="drop-in flex items-start gap-3 rounded-[18px] border border-line bg-surface px-3.5 py-3 text-left shadow-[0_16px_40px_rgba(40,25,10,.2)]">
              <KindIcon kind={a.kind} />
              <span className="min-w-0 flex-1">
                <b className="block text-[13.5px] leading-[18px]">{a.title}</b>
                <span className="block truncate text-[12.5px] text-ink-3">{a.body}</span>
              </span>
              <span className="text-[11px] font-semibold text-ink-3">now</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
