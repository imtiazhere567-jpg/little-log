"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import DirectorBell from "./DirectorBell";
import { signOut } from "../login/actions";

// --- icons (24px grid, 2px stroke, round joins) ------------------------------------------
const P = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ICONS: Record<string, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="2" {...P} /><rect x="14" y="3" width="7" height="5" rx="2" {...P} /><rect x="14" y="12" width="7" height="9" rx="2" {...P} /><rect x="3" y="16" width="7" height="5" rx="2" {...P} /></>,
  incidents: <><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" {...P} /><path d="M12 10v4M12 17v.01" {...P} /></>,
  reports: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" {...P} /><path d="M14 3v5h5M9 13h6M9 17h4" {...P} /></>,
  children: <><circle cx="12" cy="8" r="4" {...P} /><path d="M10.5 7.5h.01M13.5 7.5h.01" {...P} /><path d="M10.6 9.4a2 2 0 0 0 2.8 0" {...P} /><path d="M5 21a7 7 0 0 1 14 0" {...P} /></>,
  parents: <><circle cx="9" cy="8" r="3.5" {...P} /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" {...P} /><circle cx="17" cy="9" r="2.5" {...P} /><path d="M16 14.2a5 5 0 0 1 5.5 4.8" {...P} /></>,
  teachers: <><path d="M3 10.5 12 4l9 6.5" {...P} /><path d="M5 9.5V20h14V9.5" {...P} /><path d="M10 20v-5h4v5" {...P} /></>,
  records: <><rect x="3" y="4" width="18" height="5" rx="1.5" {...P} /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" {...P} /></>,
  audit: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" {...P} /><path d="M3 3v5h5M12 7v5l3 2" {...P} /></>,
  settings: <><circle cx="12" cy="12" r="3" {...P} /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" {...P} /></>,
  attendance: <><circle cx="12" cy="12" r="9" {...P} /><path d="M12 7v5l3 2" {...P} /></>,
  messages: <path d="M4 5h16v11H9l-5 4z" {...P} />,
  phone: <><rect x="6" y="2.5" width="12" height="19" rx="3" {...P} /><path d="M11 18h2" {...P} /></>,
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>{ICONS[name]}</svg>;
}

type Counts = { drafts: number; serious: number; children: number; sent: number; reviews: number; messages: number; here: number };
type Item = { href: string; label: string; icon: string; exact?: boolean; badge?: (c: Counts) => ReactNode };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Overview",
    items: [
      { href: "/director", label: "Dashboard", icon: "dashboard", exact: true },
      {
        href: "/director/incidents", label: "Incidents", icon: "incidents",
        badge: (c) => c.drafts > 0 && (
          <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-extrabold text-white ${c.serious ? "bg-danger shadow-[0_0_0_3px_rgba(200,65,46,.18)]" : "bg-warning"}`}>{c.drafts}</span>
        ),
      },
      {
        href: "/director/reports", label: "Daily reports", icon: "reports",
        badge: (c) => <span className="tabular text-[11px] font-bold text-ink-3">{c.sent}/{c.children}</span>,
      },
      {
        href: "/director/attendance", label: "Attendance", icon: "attendance",
        badge: (c) => <span className="tabular text-[11px] font-bold text-ink-3" title="Here now">{c.here}/{c.children}</span>,
      },
      {
        href: "/director/messages", label: "Messages", icon: "messages",
        badge: (c) => c.messages > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-extrabold text-white">{c.messages}</span>,
      },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/director/children", label: "Children", icon: "children" },
      { href: "/director/teachers", label: "Teachers & rooms", icon: "teachers" },
    ],
  },
  {
    title: "Records",
    items: [
      { href: "/director/records", label: "Records & export", icon: "records" },
      { href: "/director/audit", label: "Audit log", icon: "audit" },
      { href: "/director/settings", label: "Settings", icon: "settings" },
    ],
  },
];

export default function Sidebar({ name, centerName, sendTime, counts }: {
  name: string; centerName: string; sendTime: string; counts: Counts;
}) {
  const path = usePathname();
  const pct = counts.children ? Math.round((counts.sent / counts.children) * 100) : 0;
  const [h, m] = sendTime.split(":").map(Number);
  const send = `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;

  return (
    <aside className="sticky top-0 z-40 hidden h-screen w-[264px] flex-none flex-col border-r border-line bg-gradient-to-b from-surface via-surface to-[#FBF6EE] md:flex">
      {/* brand */}
      <div className="flex items-center justify-between gap-2 px-5 pb-4 pt-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-[13px] bg-gradient-to-br from-[#F2B07A] to-accent shadow-[0_6px_16px_rgba(232,149,90,.4)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="13" r="4.2" fill="#fff" stroke="none" />
              <path d="M12 3.5v2M4.5 13h-2M21.5 13h-2M6.3 7.3 5 6M17.7 7.3 19 6M3 19h18" />
            </svg>
          </span>
          <span className="leading-tight">
            <span className="font-display block text-[21px] font-semibold">Little<span className="italic text-accent">log</span></span>
            <span className="block truncate text-[11.5px] font-semibold text-ink-3">{centerName}</span>
          </span>
        </Link>
        <DirectorBell />
      </div>

      {/* primary action: register a child + parents together */}
      <div className="px-4 pb-2">
        <Link href="/director/enroll"
          className={`flex h-11 items-center justify-center gap-2 rounded-[14px] text-[14px] font-bold text-white shadow-[0_6px_16px_rgba(47,111,98,.3)] transition hover:brightness-110
            ${path.startsWith("/director/enroll") ? "bg-[#285f54]" : "bg-primary"}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          New enrollment
        </Link>
      </div>

      {/* nav */}
      <nav className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-3" aria-label="Director">
        {GROUPS.map((g) => (
          <div key={g.title} className="mt-3 first:mt-1">
            <div className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[.1em] text-ink-3/80">{g.title}</div>
            <div className="grid gap-0.5">
              {g.items.map((it) => {
                const on = it.exact ? path === it.href : path.startsWith(it.href);
                return (
                  <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined}
                    className={`group relative flex h-11 items-center gap-3 rounded-[14px] pl-2 pr-3 text-[14px] font-semibold transition
                      ${on ? "bg-surface text-ink shadow-[0_1px_2px_rgba(60,40,20,.06),0_6px_16px_rgba(60,40,20,.08)] ring-1 ring-line" : "text-ink-2 hover:bg-surface-2/80 hover:text-ink"}`}>
                    {on && <span className="absolute -left-3 top-2 h-7 w-1 rounded-r-full bg-primary" />}
                    <span className={`grid h-8 w-8 flex-none place-items-center rounded-[10px] transition
                      ${on ? "bg-primary text-white shadow-[0_4px_10px_rgba(47,111,98,.35)]" : "bg-surface-2 text-ink-2 group-hover:bg-primary-soft group-hover:text-primary"}`}>
                      <Icon name={it.icon} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    {it.badge?.(counts)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {/* today card */}
        <Link href="/director/reports" className="mx-1 mt-5 block rounded-[18px] border border-line bg-gradient-to-br from-primary-soft to-surface p-4 transition hover:shadow-[var(--shadow-2)]">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[.1em] text-primary">Today</span>
            <span className="text-[11px] font-semibold text-ink-3">send at {send}</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-[26px] font-semibold leading-8">{counts.sent}</span>
            <span className="text-sm text-ink-2">of {counts.children} reports sent</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#CFE3DC]">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          {(counts.drafts > 0 || counts.reviews > 0) && (
            <div className="mt-3 grid gap-1 text-[12px] font-semibold">
              {counts.drafts > 0 && <span className="flex items-center gap-1.5 text-danger"><span className="h-1.5 w-1.5 rounded-full bg-danger" />{counts.drafts} incident{counts.drafts === 1 ? "" : "s"} to approve</span>}
              {counts.reviews > 0 && <span className="flex items-center gap-1.5 text-[#8A5E0F]"><span className="h-1.5 w-1.5 rounded-full bg-warning" />{counts.reviews} unclear name{counts.reviews === 1 ? "" : "s"}</span>}
            </div>
          )}
        </Link>

        {/* jump to the phone apps */}
        <div className="mx-1 mt-3 grid grid-cols-2 gap-2">
          {[{ href: "/teacher", label: "Teacher" }, { href: "/parent", label: "Parent" }].map((a) => (
            <Link key={a.href} href={a.href} target="_blank"
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-line bg-surface px-2.5 py-2 text-[12px] font-bold text-ink-2 hover:border-primary hover:text-primary" title={`Open the ${a.label.toLowerCase()} phone app`}>
              <Icon name="phone" size={14} />{a.label}<span className="ml-auto text-ink-3">↗</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* account */}
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-2xl p-2">
          <span className="relative grid h-10 w-10 place-items-center rounded-full bg-primary text-[13px] font-bold text-white">
            {name.split(" ").map((p) => p[0]).join("")}
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface bg-success" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <b className="block truncate text-[14px]">{name}</b>
            <span className="text-[12px] text-ink-3">Director · demo account</span>
          </span>
          <form action={signOut}>
            <button title="Sign out" aria-label="Sign out"
              className="grid h-9 w-9 place-items-center rounded-xl text-ink-3 transition hover:bg-danger-soft hover:text-danger">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5M5 12h11" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
