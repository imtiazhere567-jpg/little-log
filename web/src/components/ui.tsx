import type { ReactNode } from "react";

export const TYPE_STYLE: Record<string, { icon: string; label: string; fg: string; bg: string }> = {
  meal: { icon: "🍎", label: "Meal", fg: "text-meal", bg: "bg-meal-soft" },
  nap: { icon: "🌙", label: "Nap", fg: "text-nap", bg: "bg-nap-soft" },
  diaper: { icon: "💧", label: "Diaper", fg: "text-diaper", bg: "bg-diaper-soft" },
  activity: { icon: "🎨", label: "Activity", fg: "text-activity", bg: "bg-activity-soft" },
  mood: { icon: "🙂", label: "Mood", fg: "text-mood", bg: "bg-mood-soft" },
  note: { icon: "📝", label: "Note", fg: "text-note", bg: "bg-note-soft" },
  incident: { icon: "⚠️", label: "Incident", fg: "text-danger", bg: "bg-danger-soft" },
};

export function TypeIcon({ type, size = 32 }: { type: string; size?: number }) {
  const t = TYPE_STYLE[type] ?? TYPE_STYLE.note;
  return (
    <span className={`grid flex-none place-items-center rounded-[10px] ${t.bg}`}
      style={{ width: size, height: size, fontSize: size * 0.46 }} aria-hidden>
      {t.icon}
    </span>
  );
}

export function Avatar({ first, last, bg, fg, size = 44, dot }: {
  first: string; last: string; bg: string; fg: string; size?: number;
  dot?: { color: string; symbol: string };
}) {
  return (
    <span className="relative grid flex-none place-items-center rounded-full font-bold"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.33 }}>
      {first[0]}{last[0]}
      {dot && (
        <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full border-[2.5px] border-surface text-[8px] font-black text-white"
          style={{ background: dot.color }}>{dot.symbol}</span>
      )}
    </span>
  );
}

export const STATUS: Record<string, { label: string; cls: string; dot: { color: string; symbol: string } | undefined }> = {
  sent: { label: "Sent", cls: "bg-primary-soft text-primary", dot: { color: "#2F6F62", symbol: "✓" } },
  ready: { label: "Ready", cls: "bg-success-soft text-[#2C6B42]", dot: { color: "#3E8E5A", symbol: "✓" } },
  review: { label: "Review", cls: "bg-warning-soft text-[#8A5E0F]", dot: { color: "#C98A1B", symbol: "?" } },
  few: { label: "Few notes", cls: "bg-surface-2 text-ink-3", dot: undefined },
  draft: { label: "Draft", cls: "bg-surface-2 text-ink-2", dot: undefined },
  approved: { label: "Approved", cls: "bg-success-soft text-[#2C6B42]", dot: undefined },
  rejected: { label: "Rejected", cls: "bg-danger-soft text-danger", dot: undefined },
  awaiting: { label: "● Awaiting approval", cls: "bg-warning-soft text-[#8A5E0F]", dot: undefined },
};

export function Badge({ status, children }: { status: keyof typeof STATUS; children?: ReactNode }) {
  const s = STATUS[status];
  return <span className={`badge ${s.cls}`}>{children ?? s.label}</span>;
}

export function NewTag() {
  return <span className="badge bg-accent px-1.5 py-[3px] text-[9.5px] text-white">New</span>;
}

export function EntryRow({ type, label, details, time, end, right, isNew }: {
  type: string; label?: string | null; details: string; time?: string; end?: string; right?: ReactNode; isNew?: boolean;
}) {
  const t = TYPE_STYLE[type] ?? TYPE_STYLE.note;
  return (
    <div className="grid grid-cols-[32px_1fr_auto] items-center gap-3 border-b border-dashed border-line py-2.5 last:border-0">
      <TypeIcon type={type} />
      <div className="min-w-0">
        <div className={`flex items-center gap-1.5 text-[12px] font-bold ${t.fg}`}>{label ?? t.label}{isNew && <NewTag />}</div>
        <div className="text-[14px] leading-[19px]">{details}{end ? ` · ${end}` : ""}</div>
      </div>
      {right ?? (time && <span className="tabular text-[13px] font-semibold text-ink-3">{time}</span>)}
    </div>
  );
}

export function WarnIcon({ size = 18, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5v.5" />
    </svg>
  );
}
