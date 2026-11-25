"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; icon: React.ReactNode; badge?: number; exact?: boolean };

const I = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />,
  list: <path d="M4 6h16M4 12h16M4 18h10" />,
  doc: <path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3" />,
  me: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  warn: <><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5v.5" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
};
export type IconName = keyof typeof I;

export function Icon({ name, className = "h-[22px] w-[22px]" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className={className}>
      {I[name]}
    </svg>
  );
}

export default function TabBar({ tabs, center, hideOn = [] }: {
  tabs: { href: string; label: string; icon: IconName; badge?: number; exact?: boolean }[];
  center?: { href: string; label: string };
  /** path prefixes with their own bottom bar (e.g. a chat's message box) */
  hideOn?: string[];
}) {
  const path = usePathname();
  if (hideOn.some((p) => path.startsWith(p))) return null;
  const isOn = (t: Tab | (typeof tabs)[number]) => (t.exact ? path === t.href : path === t.href || path.startsWith(t.href + "/"));
  const left = center ? tabs.slice(0, 2) : tabs;
  const right = center ? tabs.slice(2) : [];

  const render = (t: (typeof tabs)[number]) => (
    <Link key={t.href} href={t.href}
      className={`relative grid justify-items-center gap-[3px] text-[11px] font-bold ${isOn(t) ? "text-primary" : "text-ink-3"}`}>
      {!!t.badge && (
        <span className="absolute -top-1 left-[calc(50%+4px)] min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-extrabold text-white">{t.badge}</span>
      )}
      <Icon name={t.icon} />
      {t.label}
    </Link>
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 h-[118px]">
      <div className="absolute inset-0 top-[-24px] bg-gradient-to-b from-bg/0 via-bg/90 to-bg" />
      <nav className={`pointer-events-auto absolute inset-x-3 bottom-4 grid h-[68px] items-center rounded-[26px] border border-line bg-surface shadow-[var(--shadow-2)] ${center ? "grid-cols-[1fr_1fr_104px_1fr_1fr]" : tabs.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {left.map(render)}
        {center && <span />}
        {right.map(render)}
      </nav>
      {center && (
        <Link href={center.href} aria-label={center.label}
          className="pointer-events-auto absolute bottom-[34px] left-1/2 grid h-[80px] w-[80px] -translate-x-1/2 place-items-center rounded-full bg-accent shadow-[0_0_0_6px_var(--color-bg),0_12px_28px_rgba(232,149,90,.55)] transition active:scale-95">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" className="h-8 w-8">
            <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" />
          </svg>
        </Link>
      )}
      {center && <span className="absolute bottom-[14px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[10.5px] font-extrabold text-accent-ink">{center.label}</span>}
    </div>
  );
}
