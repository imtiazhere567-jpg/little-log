import Link from "next/link";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { parentChildren, parseReport } from "@/lib/data";
import { fmtDate, fmtTime, greetingFor, nowTime, todayStr } from "@/lib/time";
import ReportCard from "@/components/ReportCard";
import ChildSwitcher from "./ChildSwitcher";
import { ABSENT_REASONS, childAttendance, statusOf } from "@/lib/attendance";
import { parentAbsentAction } from "./attendance-actions";

export default async function ParentToday({ searchParams }: PageProps<"/app/parent">) {
  const parent = await requireUser("parent");
  const { child: childParam, absent: absentSheet } = await searchParams;
  const kids = await parentChildren(parent.id);
  // Privacy: only the parent's own children can be selected.
  const sel = kids.find((k) => String(k.child.id) === childParam) ?? kids[0];
  if (!sel) return <p className="p-6">No children linked to this account.</p>;
  const { child, room } = sel;
  const db = await getDb();
  const today = todayStr();
  const [center] = await db.select().from(s.centers).where(eq(s.centers.id, room.centerId));
  const [report] = await db.select().from(s.dailyReports)
    .where(and(eq(s.dailyReports.childId, child.id), eq(s.dailyReports.date, today), eq(s.dailyReports.status, "sent")));
  const [last] = await db.select().from(s.dailyReports)
    .where(and(eq(s.dailyReports.childId, child.id), eq(s.dailyReports.status, "sent")))
    .orderBy(desc(s.dailyReports.date)).limit(1);
  const att = await childAttendance(child.id, today);
  const st = statusOf(att);
  // Only a count, never the entries themselves: the teacher checks everything before parents see it.
  const logged = (await db.select({ id: s.logEntries.id }).from(s.logEntries)
    .where(and(eq(s.logEntries.childId, child.id), eq(s.logEntries.date, today), isNotNull(s.logEntries.childId)))).length;

  return (
    <div className="px-[18px]">
      <div className="eyebrow mt-1.5">{fmtDate(today)}</div>
      <h1 className="font-display mt-0.5 text-[30px] font-semibold leading-[35px]">
        {greetingFor(nowTime())}, {parent.name.split(" ")[0]}
      </h1>
      <ChildSwitcher kids={kids} current={child.id} base="/app/parent" />

      {/* check-in status */}
      <div className={`mt-4 flex items-center gap-3 rounded-[20px] border px-4 py-3 ${st === "here" ? "border-success/30 bg-success-soft/60" : st === "absent" ? "border-warning/30 bg-warning-soft/60" : "border-line bg-surface"}`}>
        <span className={`grid h-10 w-10 flex-none place-items-center rounded-full text-[17px] ${st === "here" ? "bg-success text-white" : st === "gone" ? "bg-primary text-white" : st === "absent" ? "bg-warning text-white" : "bg-surface-2"}`}>
          {st === "here" ? "✓" : st === "gone" ? "🏠" : st === "absent" ? "–" : "⏳"}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[14.5px]">
            {st === "here" ? `${child.firstName} is at daycare` : st === "gone" ? `${child.firstName} went home` : st === "absent" ? `${child.firstName} is absent today` : `${child.firstName} isn't checked in yet`}
          </b>
          <span className="block text-[12.5px] text-ink-2">
            {st === "here" ? `Checked in at ${fmtTime(att?.checkInAt)}` : st === "gone" ? `Picked up at ${fmtTime(att?.checkOutAt)} by ${att?.pickedUpBy}`
              : st === "absent" ? `${att?.absentReason ?? ""} · changed plans? Call ${center.phone ?? "the center"}` : `Usually arrives around ${fmtTime(child.expectedIn)}`}
          </span>
        </span>
        {st === "not_arrived" && (
          <Link href={`/app/parent?child=${child.id}&absent=1`} scroll={false} className="flex-none rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-bold text-ink-2">Not coming?</Link>
        )}
      </div>

      <div className="mt-5">
        {report ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow">Today&apos;s report · {room.name} Room</span>
              <span className="text-xs font-semibold text-ink-3">Sent {fmtTime(report.sentAt?.slice(11))}</span>
            </div>
            <ReportCard content={parseReport(report.content)} date={today} />
          </>
        ) : (
          <div className="card rounded-3xl p-6 text-center">
            <div className="text-4xl">🌤️</div>
            <h2 className="font-display mt-3 text-[22px] font-semibold leading-7">
              {st === "gone" ? `${child.firstName}'s report is on its way` : st === "absent" ? `No report today` : `${child.firstName}'s day is still going`}
            </h2>
            <p className="mt-2 text-sm leading-[21px] text-ink-2">
              Today&apos;s report from {room.name} Room usually arrives around {fmtTime(center.reportSendTime)}.
              You&apos;ll get a WhatsApp message, an email and an app notification.
            </p>
            {logged > 0 && (
              <p className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-primary-soft px-3.5 py-1.5 text-[12.5px] font-semibold text-primary">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                {logged} update{logged === 1 ? "" : "s"} logged so far today
              </p>
            )}
            {last && (
              <Link href={`/app/parent/report/${last.id}`} className="btn btn-sm btn-secondary mt-4">
                Read {fmtDate(last.date, { weekday: true })}&apos;s report
              </Link>
            )}
          </div>
        )}
      </div>

      <Link href={`/app/parent/chat/${child.id}`} className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3.5 text-sm font-bold">
        <span>💬 Message {child.firstName}&apos;s teachers</span><span className="text-ink-3">›</span>
      </Link>
      <Link href={`/app/parent/history?child=${child.id}`} className="mt-2 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3.5 text-sm font-bold">
        <span>📅 Past reports</span><span className="text-ink-3">›</span>
      </Link>
      {absentSheet === "1" && st === "not_arrived" && (
        <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label={`${child.firstName} is not coming today`}>
          <Link href={`/app/parent?child=${child.id}`} scroll={false} aria-label="Close" className="absolute inset-0 bg-ink/35" />
          <form action={parentAbsentAction} className="drop-in relative w-full rounded-t-[28px] bg-surface px-5 pb-8 pt-3 shadow-[var(--shadow-3)]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
            <input type="hidden" name="childId" value={child.id} />
            <h2 className="font-display text-[22px] font-semibold leading-7">{child.firstName} isn&apos;t coming today</h2>
            <p className="mt-1 text-[13px] text-ink-2">The teachers will see it right away, so nobody waits or worries.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ABSENT_REASONS.map((r, i) => (
                <label key={r} className="cursor-pointer rounded-full border border-line px-4 py-2 text-[14px] font-semibold has-[:checked]:border-[#C98A1B] has-[:checked]:bg-warning-soft has-[:checked]:text-[#8A5E0F]">
                  <input type="radio" name="reason" value={r} defaultChecked={i === 0} className="sr-only" />{r}
                </label>
              ))}
            </div>
            <button className="btn btn-primary mt-5 w-full">Let the teachers know</button>
          </form>
        </div>
      )}
    </div>
  );
}
