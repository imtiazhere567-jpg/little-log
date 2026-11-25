import Link from "next/link";
import { resetDemo } from "@/app/actions";

const TABS = [
  { key: "teacher", href: "/teacher", label: "Teacher" },
  { key: "parent", href: "/parent", label: "Parent" },
  { key: "both", href: "/demo", label: "Teacher + Parent" },
];

/** Top bar shared by the phone simulator pages. */
export default function SimHeader({ active }: { active: "teacher" | "parent" | "both" }) {
  return (
    <header className="mx-auto mb-8 flex max-w-[1240px] flex-wrap items-center justify-between gap-4">
      <Link href="/" className="font-display text-2xl font-semibold">
        Little<span className="italic text-accent">log</span>
        <span className="eyebrow ml-3 align-middle">Phone simulator</span>
      </Link>
      <nav className="flex flex-wrap items-center gap-2 text-sm">
        {TABS.map((t) => (
          <Link key={t.key} href={t.href}
            className={`rounded-full border px-4 py-2 font-semibold ${active === t.key ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"}`}>
            {t.label}
          </Link>
        ))}
        <Link href="/director" target="_blank" className="rounded-full border border-primary bg-primary-soft px-4 py-2 font-semibold text-primary">
          Director app ↗
        </Link>
        <form action={resetDemo}>
          <button className="rounded-full border border-line bg-surface px-4 py-2 font-semibold text-ink-2 hover:bg-surface-2">↺ Reset</button>
        </form>
      </nav>
    </header>
  );
}

export function Steps({ title, steps }: { title: string; steps: { who?: string; text: string }[] }) {
  return (
    <div>
      <div className="eyebrow">{title}</div>
      <ol className="mt-4 space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-[14px] leading-[21px] text-ink-2">
            <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-ink text-[12px] font-bold text-bg">{i + 1}</span>
            <span>{s.who && <b className="text-ink">{s.who}. </b>}{s.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
