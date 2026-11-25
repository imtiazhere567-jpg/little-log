import Link from "next/link";
import type { ReactNode } from "react";

/** Right-hand side panel for add/edit forms. Closing it is just a link back. */
export function SidePanel({ title, eyebrow, closeHref, children }: {
  title: string; eyebrow?: string; closeHref: string; children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <Link href={closeHref} scroll={false} aria-label="Close" className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" />
      <aside className="relative flex h-full w-full max-w-[480px] flex-col overflow-y-auto bg-bg shadow-[var(--shadow-3)]">
        <div className="flex items-start justify-between border-b border-line bg-surface px-7 py-5">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2 className="font-display text-[26px] font-semibold leading-8">{title}</h2>
          </div>
          <Link href={closeHref} scroll={false} className="grid h-9 w-9 place-items-center rounded-full text-ink-3 hover:bg-surface-2">✕</Link>
        </div>
        <div className="px-7 py-6">{children}</div>
      </aside>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

/** A group of checkboxes (each with its own label), so it must not sit inside a <label>. */
export function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-3">{label}</legend>
      {children}
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </fieldset>
  );
}

export const inputCls = "h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] outline-none focus:border-primary";

export function CheckRow({ name, value, checked, children }: { name: string; value: number | string; checked?: boolean; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="h-4 w-4 accent-[#2F6F62]" />
      <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">{children}</span>
    </label>
  );
}

export function Toggle({ name, checked, label, hint }: { name: string; checked?: boolean; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <span className="min-w-0 flex-1">
        <b className="block text-[15px]">{label}</b>
        {hint && <span className="text-[13px] text-ink-2">{hint}</span>}
      </span>
      <input type="checkbox" name={name} defaultChecked={checked} className="peer sr-only" />
      <span className="flex h-7 w-12 flex-none items-center rounded-full bg-line p-0.5 transition peer-checked:bg-primary peer-checked:[&>span]:translate-x-5">
        <span className="h-6 w-6 rounded-full bg-white shadow transition" />
      </span>
    </label>
  );
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[34px] font-semibold">{title}</h1>
        {sub && <p className="mt-1 text-ink-2">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Saved({ show, text }: { show: boolean; text: string }) {
  if (!show) return null;
  return <div className="mt-4 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">✓ {text}</div>;
}
