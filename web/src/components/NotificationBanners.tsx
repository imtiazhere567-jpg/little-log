"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type N = { id: number; channel: "whatsapp" | "email" | "push"; kind: "daily_report" | "incident" | "message" | "attendance"; recordId: number; title: string; body: string };

export const CHANNEL_STYLE = {
  whatsapp: { app: "WhatsApp", bg: "#25A35A" },
  email: { app: "Mail", bg: "#3D7BE0" },
  push: { app: "Littlelog", bg: "#E8955A" },
} as const;

/** Where tapping a notification takes you: its own app, like a real phone. */
export function hrefFor(n: Pick<N, "id" | "channel" | "kind" | "recordId">) {
  if (n.channel === "whatsapp") return "/app/phone/whatsapp/chat";
  if (n.channel === "email") return `/app/phone/mail/${n.id}`;
  if (n.kind === "message") return `/app/parent/chat/${n.recordId}`;
  if (n.kind === "attendance") return `/app/parent?child=${n.recordId}`;
  return n.kind === "incident" ? `/app/parent/incidents/${n.recordId}` : `/app/parent/report/${n.recordId}`;
}

export function AppGlyph({ channel, size = 36 }: { channel: N["channel"]; size?: number }) {
  const r = Math.round(size * 0.27);
  const icon = channel === "whatsapp"
    ? <path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5Z" fill="#fff" />
    : channel === "email"
      ? <><rect x="3.5" y="6" width="17" height="12" rx="2.2" fill="#fff" /><path d="m4.5 7.5 7.5 5.5 7.5-5.5" stroke={CHANNEL_STYLE.email.bg} strokeWidth="1.8" fill="none" strokeLinecap="round" /></>
      : <><circle cx="12" cy="13" r="4.2" fill="#fff" /><path d="M12 4v2M4.5 13h-2M21.5 13h-2M6.4 7.4 5 6M17.6 7.4 19 6M4 19.5h16" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></>;
  return (
    <span className="grid flex-none place-items-center" style={{ width: size, height: size, borderRadius: r, background: CHANNEL_STYLE[channel].bg }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" aria-hidden>{icon}</svg>
    </span>
  );
}

const SEEN_KEY = "ll_seen_banners";
const readSeen = () => { try { return new Set<number>(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]")); } catch { return new Set<number>(); } };
const writeSeen = (s: Set<number>) => { try { sessionStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-200))); } catch { /* private mode */ } };

/**
 * Simulated phone notifications. In the real product these arrive through WhatsApp (Twilio),
 * email (Resend) and web push. New ones slide in, stay ~7 seconds, then tuck away;
 * the app icons keep the unread badge, like a real phone.
 */
export default function NotificationBanners() {
  const router = useRouter();
  const [items, setItems] = useState<N[]>([]);
  const [shown, setShown] = useState(0);
  const seen = useRef<Set<number>>(new Set());

  useEffect(() => {
    seen.current = readSeen();
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/parent/notifications", { cache: "no-store" });
        if (!r.ok) return;
        const { items: list } = (await r.json()) as { items: N[] };
        if (!alive) return;
        const order = { whatsapp: 0, email: 1, push: 2 };
        const fresh = list.filter((n) => !seen.current.has(n.id))
          .sort((a, b) => b.recordId - a.recordId || order[a.channel] - order[b.channel]).slice(0, 3);
        if (fresh.length) {
          fresh.forEach((n) => seen.current.add(n.id));
          writeSeen(seen.current);
          setItems(fresh);
          setShown(0);
        }
      } catch { /* offline: try again later */ }
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // reveal one after another, then tuck them away after a few seconds
  useEffect(() => {
    if (!items.length) return;
    if (shown < items.length) {
      const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 200 : 650);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setItems([]), 7000);
    return () => clearTimeout(t);
  }, [shown, items.length]);

  async function open(n: N) {
    await fetch("/api/parent/notifications", { method: "POST", body: JSON.stringify({ ids: [n.id] }) });
    setItems((xs) => xs.filter((x) => x.id !== n.id));
    router.push(hrefFor(n));
    router.refresh();
  }

  if (!items.length) return null;
  return (
    <div className="fixed inset-x-2 top-[48px] z-50 grid gap-2">
      {items.slice(0, shown).map((n) => (
        <button key={n.id} onClick={() => open(n)}
          className="drop-in flex gap-2.5 rounded-[18px] border border-white/60 bg-[rgba(250,247,242,.92)] px-3 py-2.5 text-left shadow-[0_10px_30px_rgba(40,25,10,.22)] backdrop-blur-xl">
          <AppGlyph channel={n.channel} />
          <span className="min-w-0 flex-1">
            <span className="flex justify-between text-[12.5px] font-bold">
              <span className="truncate">{n.channel === "email" ? "Mail" : n.channel === "whatsapp" ? `WhatsApp · ${n.title}` : n.title}</span>
              <span className="ml-2 font-medium text-ink-3">now</span>
            </span>
            <span className="line-clamp-2 block text-[12.5px] leading-[17px] text-ink-2">
              {n.channel === "email" ? <><b className="text-ink">{n.title}</b> · Sunny Days Childcare</> : n.body}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
