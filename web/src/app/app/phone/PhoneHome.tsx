"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AppGlyph } from "@/components/NotificationBanners";

type Counts = { whatsapp: number; email: number; push: number };

/** Decorative phone apps: they make the home screen feel real but aren't part of the demo. */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const DECOR: Record<string, { bg: string; fg: string; glyph: ReactNode }> = {
  Calendar: { bg: "#fff", fg: "#E2453C", glyph: null },
  Photos: { bg: "#fff", fg: "#000", glyph: <>{["#F6B23C", "#EF6A4E", "#C764C7", "#5A8DEB", "#4CC38A", "#A9D25B"].map((c, i) => <ellipse key={c} cx="12" cy="7.5" rx="2.6" ry="4.4" fill={c} opacity=".85" transform={`rotate(${i * 60} 12 12)`} />)}</> },
  Weather: { bg: "linear-gradient(160deg,#4E9BEA,#2D6FD0)", fg: "#fff", glyph: <><circle cx="9" cy="9" r="3.5" fill="#FFD45A" /><path d="M8 18h9a3.5 3.5 0 0 0-.5-7 5 5 0 0 0-9.3 1.6A2.8 2.8 0 0 0 8 18Z" fill="#fff" /></> },
  Clock: { bg: "#111", fg: "#fff", glyph: <><circle cx="12" cy="12" r="8" {...P} stroke="#fff" /><path d="M12 7.5V12l3 2" {...P} stroke="#F79A2E" /></> },
  Settings: { bg: "linear-gradient(160deg,#9BA3AC,#6C747D)", fg: "#fff", glyph: <><circle cx="12" cy="12" r="3" {...P} /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" {...P} /></> },
  Camera: { bg: "linear-gradient(160deg,#C9CED4,#9097A0)", fg: "#222", glyph: <><rect x="3.5" y="7" width="17" height="12" rx="2.5" {...P} /><circle cx="12" cy="13" r="3.3" {...P} /><path d="M8.5 7 10 5h4l1.5 2" {...P} /></> },
  Phone: { bg: "linear-gradient(160deg,#5CD26B,#2FAE4A)", fg: "#fff", glyph: <path d="M6.6 4.5h2.6l1.3 3.4-1.7 1.2a9.5 9.5 0 0 0 5.1 5.1l1.2-1.7 3.4 1.3v2.6a1.6 1.6 0 0 1-1.7 1.6A13.5 13.5 0 0 1 5 6.2a1.6 1.6 0 0 1 1.6-1.7Z" fill="#fff" /> },
  Browser: { bg: "linear-gradient(160deg,#5AB3F5,#2F7FE0)", fg: "#fff", glyph: <><circle cx="12" cy="12" r="8" {...P} /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8Z" fill="#fff" /></> },
  Music: { bg: "linear-gradient(160deg,#FF6A88,#F2325C)", fg: "#fff", glyph: <path d="M9.5 17.5V7l9-2v10.5M9.5 17.5a2.3 2.3 0 1 1-2.3-2.3 2.3 2.3 0 0 1 2.3 2.3Zm9-2a2.3 2.3 0 1 1-2.3-2.3 2.3 2.3 0 0 1 2.3 2.3Z" {...P} /> },
};

function Badge({ n }: { n: number }) {
  if (!n) return null;
  return <span className="absolute -right-1.5 -top-1.5 grid h-[22px] min-w-[22px] place-items-center rounded-full border-2 border-white/80 bg-[#F0403A] px-1 text-[12px] font-bold text-white shadow">{n > 99 ? "99+" : n}</span>;
}

function AppTile({ label, children, href, badge, onClick }: { label: string; children: ReactNode; href?: string; badge?: number; onClick?: () => void }) {
  const inner = (
    <>
      <span className="relative">{children}<Badge n={badge ?? 0} /></span>
      <span className="mt-1.5 max-w-[70px] truncate text-[11.5px] font-semibold text-ink drop-shadow-[0_1px_0_rgba(255,255,255,.6)]">{label}</span>
    </>
  );
  return href
    ? <Link href={href} className="grid justify-items-center transition active:scale-90" aria-label={`${label}${badge ? `, ${badge} unread` : ""}`}>{inner}</Link>
    : <button type="button" onClick={onClick} className="grid justify-items-center transition active:scale-90" aria-label={label}>{inner}</button>;
}

function DecorTile({ name, onTap, calendar }: { name: keyof typeof DECOR; onTap: (n: string) => void; calendar: { wd: string; day: string } }) {
  const d = DECOR[name];
  return (
    <AppTile label={name} onClick={() => onTap(name)}>
      <span className="grid h-[60px] w-[60px] place-items-center rounded-[16px] shadow-[0_4px_10px_rgba(60,40,20,.15)]" style={{ background: d.bg, color: d.fg }}>
        {name === "Calendar"
          ? <span className="grid leading-none"><span className="text-[9px] font-bold text-[#E2453C]">{calendar.wd}</span><span className="text-[26px] font-light text-ink">{calendar.day}</span></span>
          : <svg width="34" height="34" viewBox="0 0 24 24">{d.glyph}</svg>}
      </span>
    </AppTile>
  );
}

function RealTile({ channel, label, href, badge }: { channel: "whatsapp" | "email" | "push"; label: string; href: string; badge: number }) {
  return (
    <AppTile label={label} href={href} badge={badge}>
      <span className="block rounded-[16px] shadow-[0_4px_12px_rgba(60,40,20,.22)]"><AppGlyph channel={channel} size={60} /></span>
    </AppTile>
  );
}

export default function PhoneHome({ initialCounts, calendar, widget }: {
  initialCounts: Counts; calendar: { wd: string; day: string }; widget: { title: string; text: string; href: string };
}) {
  const [counts, setCounts] = useState(initialCounts);
  const [toast, setToast] = useState("");

  // live badges: new messages arrive while the home screen is open
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const r = await fetch("/api/parent/notifications", { cache: "no-store" });
        if (r.ok) setCounts(((await r.json()) as { counts: Counts }).counts);
      } catch { /* keep last */ }
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const tap = (name: string) => { setToast(`${name} isn't part of this demo. Try Littlelog, WhatsApp or Mail.`); setTimeout(() => setToast(""), 2600); };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-5 pb-6 pt-[62px]"
      style={{ background: "radial-gradient(120% 70% at 80% 8%, #FFE6BF 0%, #F6CFA3 28%, #EEDCC6 55%, #E7D7C6 100%)" }}>
      <div className="pointer-events-none absolute -right-10 top-10 h-48 w-48 rounded-full bg-[radial-gradient(circle,#FFF4DC_0%,rgba(255,244,220,0)_70%)]" />

      {/* Littlelog widget */}
      <Link href={widget.href} className="relative block rounded-[22px] bg-white/70 p-4 shadow-[0_6px_18px_rgba(60,40,20,.12)] backdrop-blur-md">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-accent-ink">
          <AppGlyph channel="push" size={18} /> Littlelog
        </span>
        <b className="font-display mt-2 block text-[17px] leading-5">{widget.title}</b>
        <span className="mt-1 line-clamp-2 block text-[13px] leading-[18px] text-ink-2">{widget.text}</span>
      </Link>

      {/* app grid */}
      <div className="mt-6 grid grid-cols-4 gap-x-3 gap-y-5">
        <RealTile channel="push" label="Littlelog" href="/app/parent" badge={counts.push} />
        <RealTile channel="whatsapp" label="WhatsApp" href="/app/phone/whatsapp" badge={counts.whatsapp} />
        <RealTile channel="email" label="Mail" href="/app/phone/mail" badge={counts.email} />
        {(["Calendar", "Photos", "Weather", "Clock", "Settings"] as const).map((n) => <DecorTile key={n} name={n} onTap={tap} calendar={calendar} />)}
      </div>

      <p className="mt-auto pb-3 text-center text-[11.5px] font-semibold text-ink-2/80">Tap WhatsApp, Mail or Littlelog</p>

      {/* dock */}
      <div className="mx-auto grid w-full grid-cols-4 gap-3 rounded-[28px] bg-white/45 px-3 py-3 backdrop-blur-xl">
        {(["Phone", "Browser", "Music", "Camera"] as const).map((n) => {
          const d = DECOR[n];
          return (
            <button key={n} type="button" onClick={() => tap(n)} aria-label={n} className="grid justify-items-center transition active:scale-90">
              <span className="grid h-[58px] w-[58px] place-items-center rounded-[16px]" style={{ background: d.bg, color: d.fg }}>
                <svg width="32" height="32" viewBox="0 0 24 24">{d.glyph}</svg>
              </span>
            </button>
          );
        })}
      </div>

      {toast && (
        <div className="drop-in absolute inset-x-6 bottom-28 rounded-2xl bg-ink/90 px-4 py-3 text-center text-[13px] font-semibold text-white shadow-lg">{toast}</div>
      )}
    </div>
  );
}
