import Link from "next/link";
import type { ReactNode } from "react";

/** Centered popup. It is server-rendered from the URL, so it can be linked, refreshed and closed with Back. */
export function Modal({ title, eyebrow, sub, closeHref, children, footer, wide }: {
  title: string; eyebrow?: string; sub?: string; closeHref: string; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 md:p-8">
      <Link href={closeHref} scroll={false} aria-label="Close" className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" />
      <section role="dialog" aria-modal="true" aria-label={title}
        className={`drop-in relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-[26px] border border-line bg-bg shadow-[var(--shadow-3)] ${wide ? "max-w-[1100px]" : "max-w-[820px]"}`}>
        <header className="flex items-start justify-between gap-4 border-b border-line bg-surface px-7 py-5">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2 className="font-display text-[26px] font-semibold leading-8">{title}</h2>
            {sub && <p className="mt-0.5 text-sm text-ink-2">{sub}</p>}
          </div>
          <Link href={closeHref} scroll={false} className="grid h-9 w-9 flex-none place-items-center rounded-full text-ink-3 hover:bg-surface-2" aria-label="Close">✕</Link>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="border-t border-line bg-surface px-7 py-3.5">{footer}</footer>}
      </section>
    </div>
  );
}

/** Filter chips inside a modal (e.g. All / Sent / Ready). */
export function Chips({ items }: { items: { label: string; count?: number; href: string; on: boolean; color?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2 px-7 pt-5">
      {items.map((c) => (
        <Link key={c.label} href={c.href} scroll={false}
          className={`flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold ${c.on ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"}`}>
          {c.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />}
          {c.label}{c.count !== undefined && <span className="opacity-60">{c.count}</span>}
        </Link>
      ))}
    </div>
  );
}

/** "Showing 9–16 of 47" + page buttons. */
export function Pagination({ page, pageSize, total, hrefFor }: {
  page: number; pageSize: number; total: number; hrefFor: (p: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  // compact page list: 1 … 4 5 6 … 12
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const btn = "grid h-9 min-w-9 place-items-center rounded-xl px-2.5 text-[13px] font-bold";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="tabular text-[13px] text-ink-2">Showing <b className="text-ink">{from}–{to}</b> of <b className="text-ink">{total}</b></span>
      <nav className="flex items-center gap-1" aria-label="Pages">
        {page > 1 ? <Link href={hrefFor(page - 1)} scroll={false} className={`${btn} border border-line bg-surface hover:bg-surface-2`}>‹ Prev</Link>
          : <span className={`${btn} border border-line text-ink-3/50`}>‹ Prev</span>}
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink-3">…</span>}
            <Link href={hrefFor(n)} scroll={false} aria-current={n === page ? "page" : undefined}
              className={`${btn} ${n === page ? "bg-primary text-white" : "hover:bg-surface-2"}`}>{n}</Link>
          </span>
        ))}
        {page < pages ? <Link href={hrefFor(page + 1)} scroll={false} className={`${btn} border border-line bg-surface hover:bg-surface-2`}>Next ›</Link>
          : <span className={`${btn} border border-line text-ink-3/50`}>Next ›</span>}
      </nav>
    </div>
  );
}

/** Simple table used inside modals. */
export function ModalTable({ head, rows, empty = "Nothing here." }: { head: string[]; rows: ReactNode[][]; empty?: string }) {
  return (
    <div className="px-7 py-5">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wider text-ink-3">
            <tr>{head.map((h, i) => <th key={h + i} className={`py-3 ${i === 0 ? "pl-5" : "pl-3"} ${i === head.length - 1 ? "pr-5" : ""}`}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line align-middle hover:bg-surface-2/40">
                {r.map((c, j) => <td key={j} className={`py-2.5 ${j === 0 ? "pl-5" : "pl-3"} ${j === r.length - 1 ? "pr-5" : ""}`}>{c}</td>)}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={head.length} className="p-8 text-center text-ink-3">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
