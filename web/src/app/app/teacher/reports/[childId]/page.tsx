import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { parseReport, teacherCanSeeChild, teacherRooms } from "@/lib/data";
import { buildReport } from "@/lib/report";
import { fmtTime, todayStr } from "@/lib/time";
import ReportCard from "@/components/ReportCard";
import { sendReports } from "../../actions";
import ReviewPrompt, { reviewsFor } from "../../ReviewPrompt";
import SentConfirm from "../../SentConfirm";

export default async function ReportPreview({ params, searchParams }: PageProps<"/app/teacher/reports/[childId]">) {
  const teacher = await requireUser("teacher");
  const { childId } = await params;
  const sp = await searchParams;
  const child = await teacherCanSeeChild(teacher.id, Number(childId));
  if (!child) notFound();
  const room = (await teacherRooms(teacher.id)).find((r) => r.id === child.roomId)!;
  const db = await getDb();
  const today = todayStr();
  const [report] = await db.select().from(s.dailyReports)
    .where(and(eq(s.dailyReports.childId, child.id), eq(s.dailyReports.date, today)));
  const entries = await db.select().from(s.logEntries)
    .where(and(eq(s.logEntries.childId, child.id), eq(s.logEntries.date, today))).orderBy(asc(s.logEntries.time));
  const sent = report?.status === "sent";
  const content = sent
    ? parseReport(report.content)
    : buildReport({ firstName: child.firstName, date: today, entries, teacherName: teacher.name, roomName: room.name,
        emojis: (await db.select({ e: s.centers.reportEmojis }).from(s.centers).where(eq(s.centers.id, teacher.centerId)))[0]?.e });

  const pending = sent ? [] : await reviewsFor(child.id, child.roomId);
  const blocked = pending.length > 0;

  return (
    <div className="px-[18px]">
      <Link href="/app/teacher/reports" className="mt-1 inline-block text-sm font-bold text-primary">← Reports</Link>
      <div className="eyebrow mt-3">{sent ? `Sent at ${fmtTime(report.sentAt?.slice(11))}` : "Draft · what the parent will see"}</div>
      <h1 className="font-display mb-4 mt-0.5 text-[28px] font-semibold leading-[33px]">{child.firstName}&apos;s report</h1>
      {blocked && (
        <div className="mb-4">
          <ReviewPrompt childId={child.id} firstName={child.firstName} roomId={child.roomId} />
        </div>
      )}
      {!sent && !blocked && entries.length < 3 && (
        <p className="mb-4 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[13px] leading-5 text-ink-2">
          <b className="text-ink">Few notes:</b> only {entries.length} {entries.length === 1 ? "entry" : "entries"} today, so this report is short.
          Add a meal, nap or diaper first, or send it anyway if {child.firstName} is going home early.
        </p>
      )}
      <ReportCard content={content} date={today} />
      {!sent && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href={`/app/teacher/child/${child.id}`} className="btn btn-secondary">Edit entries</Link>
          <form action={sendReports}>
            <input type="hidden" name="childIds" value={child.id} />
            <input type="hidden" name="back" value={`/app/teacher/reports/${child.id}`} />
            <button disabled={!entries.length || blocked} className="btn btn-primary w-full">Approve &amp; send</button>
          </form>
        </div>
      )}
      {blocked && <p className="mt-2 text-center text-[12.5px] font-semibold text-[#8A5E0F]">Answer “Is this {child.firstName}?” above to send this report.</p>}
      <p className="mt-4 text-center text-xs leading-[18px] text-ink-3">
        Written only from today&apos;s entries. Other children are never named.
      </p>
      <SentConfirm ids={sp.sent} teacherId={teacher.id} closeHref={`/app/teacher/reports/${child.id}`} />
    </div>
  );
}
