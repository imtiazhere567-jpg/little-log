import type { ReportContent } from "@/lib/report";
import { fmtDate } from "@/lib/time";
import { TypeIcon, TYPE_STYLE } from "./ui";

/** The parent-facing daily report, exactly as the parent sees it. */
export default function ReportCard({ content, date, compact }: { content: ReportContent; date: string; compact?: boolean }) {
  return (
    <div className="relative rounded-3xl border border-line bg-surface p-[22px] shadow-[var(--shadow-2)]">
      <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-3xl bg-gradient-to-r from-accent to-[#F2C27B]" />
      <div className="eyebrow">{fmtDate(date)}</div>
      <h2 className={`font-display mb-1 mt-1.5 font-semibold ${compact ? "text-[22px] leading-[27px]" : "text-[26px] leading-[31px]"}`}>
        {content.greeting}
      </h2>
      <div>
        {content.lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[32px_1fr] items-center gap-3 border-b border-dashed border-line py-2.5 last:border-0">
            <TypeIcon type={l.type} />
            <div>
              <div className={`text-xs font-bold ${TYPE_STYLE[l.type]?.fg ?? ""}`}>{l.label}</div>
              <div className="text-[15px] leading-5">{l.text}</div>
            </div>
          </div>
        ))}
        {content.lines.length === 0 && <p className="py-3 text-sm text-ink-3">Nothing logged yet.</p>}
      </div>
      <div className="mt-3.5 border-t border-dashed border-line pt-3.5 text-sm text-ink-2">{content.signoff}</div>
    </div>
  );
}
