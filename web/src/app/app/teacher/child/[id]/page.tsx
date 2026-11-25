import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { teacherCanSeeChild } from "@/lib/data";
import { ageLabel, centerTz, fmtShort, fmtTime, isNew, todayStr } from "@/lib/time";
import { Avatar, EntryRow } from "@/components/ui";
import { deleteEntry, sendReports } from "../../actions";
import EntryForm, { type EditableEntry } from "./EntryForm";
import ReviewPrompt, { reviewsFor } from "../../ReviewPrompt";
import { AboutTab, HistoryTab, ReportsTab } from "./ProfileTabs";
import SentConfirm from "../../SentConfirm";

const TABS = [["today", "Today"], ["history", "History"], ["reports", "Reports"], ["about", "About"]] as const;

export default async function ChildDay({ params, searchParams }: PageProps<"/app/teacher/child/[id]">) {
  const teacher = await requireUser("teacher");
  const { id } = await params;
  const sp = await searchParams;
  const child = await teacherCanSeeChild(teacher.id, Number(id));
  if (!child) notFound();
  const db = await getDb();
  const today = todayStr();
  const entries = await db.select().from(s.logEntries)
    .where(and(eq(s.logEntries.childId, child.id), eq(s.logEntries.date, today))).orderBy(asc(s.logEntries.time));
  const [report] = await db.select().from(s.dailyReports)
    .where(and(eq(s.dailyReports.childId, child.id), eq(s.dailyReports.date, today)));
  const editing = entries.find((e) => String(e.id) === sp.edit);
  const sent = report?.status === "sent";
  const pending = sent ? [] : await reviewsFor(child.id, child.roomId);
  const ready = entries.length >= 3 && pending.length === 0;
  const tab = TABS.find(([k]) => k === sp.tab)?.[0] ?? "today";
  const page = Math.max(1, Number(sp.page) || 1);
  const [room] = await db.select().from(s.rooms).where(eq(s.rooms.id, child.roomId));
  const teachers = (await db.select({ name: s.users.name }).from(s.teacherRooms)
    .innerJoin(s.users, eq(s.users.id, s.teacherRooms.teacherId)).where(eq(s.teacherRooms.roomId, child.roomId))).map((t) => t.name);

  return (
    <div className="px-[18px]">
      <Link href="/app/teacher" className="mt-1 inline-block text-sm font-bold text-primary">← Today</Link>
      <div className="mt-3 flex items-center gap-3">
        <Avatar first={child.firstName} last={child.lastName} bg={child.avatarBg} fg={child.avatarFg} size={56} />
        <div>
          <h1 className="font-display text-[26px] font-semibold leading-[30px]">{child.firstName} {child.lastName}</h1>
          <div className="text-sm text-ink-2">{ageLabel(child.dateOfBirth, today)} · {room?.name} Room</div>
        </div>
      </div>
      {child.medicalNotes && tab !== "about" && (
        <div className="mt-3 rounded-xl border-l-4 border-danger bg-danger-soft px-3 py-2 text-[13px] leading-5">
          <b className="text-danger">Allergies · </b>{child.medicalNotes}
        </div>
      )}
      <nav className="mt-4 grid grid-cols-4 rounded-2xl bg-surface-2 p-1" aria-label={`${child.firstName}'s profile`}>
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/app/teacher/child/${child.id}${k === "today" ? "" : `?tab=${k}`}`} scroll={false} aria-current={tab === k ? "page" : undefined}
            className={`flex h-9 items-center justify-center rounded-xl text-[13px] font-bold transition ${tab === k ? "bg-surface text-primary shadow-[var(--shadow-1)]" : "text-ink-3"}`}>
            {label}
          </Link>
        ))}
      </nav>
      {tab === "history" && <HistoryTab child={child} page={page} />}
      {tab === "reports" && <ReportsTab child={child} page={page} open={typeof sp.report === "string" ? sp.report : undefined} />}
      {tab === "about" && <AboutTab child={child} roomName={room?.name ?? ""} teachers={teachers} />}
      {tab === "today" && <>
      {pending.length > 0 && <div className="mt-4"><ReviewPrompt childId={child.id} firstName={child.firstName} roomId={child.roomId} /></div>}
      {sp.saved === "1" && <p className="mt-3 rounded-xl bg-success-soft px-3 py-2 text-[13px] font-semibold text-[#2C6B42]">✓ Entry updated</p>}

      {/* today's entries */}
      <div className="card mt-4 px-3.5 py-1">
        {entries.length === 0 && <p className="py-4 text-sm text-ink-3">Nothing logged yet today.</p>}
        {entries.map((e) => (
          <div key={e.id} className={editing?.id === e.id ? "-mx-3.5 rounded-xl bg-primary-soft/60 px-3.5" : ""}>
            <EntryRow isNew={isNew(e.createdAt)} type={e.type} label={e.label} details={e.type === "nap" ? (e.endTime ? `${fmtShort(e.time)} – ${fmtShort(e.endTime)}` : "Still sleeping") : e.details}
              right={
                <span className="flex items-center gap-0.5">
                  <span className="tabular mr-1 text-[13px] font-semibold text-ink-3">{fmtShort(e.time)}</span>
                  {!sent && (
                    <>
                      <Link href={`/app/teacher/child/${child.id}?edit=${e.id}`} scroll={false} aria-label="Edit entry"
                        className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-primary-soft hover:text-primary">✎</Link>
                      <form action={deleteEntry}>
                        <input type="hidden" name="entryId" value={e.id} />
                        <button aria-label="Delete entry" className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-danger-soft hover:text-danger">✕</button>
                      </form>
                    </>
                  )}
                </span>
              } />
          </div>
        ))}
      </div>

      {!sent && !editing && (
        <Link href={`/app/teacher/record?child=${child.id}`}
          className="mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(232,149,90,.35)]">
          🎙 Speak or type a note for {child.firstName}
        </Link>
      )}

      {/* add / edit */}
      {!sent && (
        <div className="mt-4">
          <EntryForm key={editing?.id ?? "new"} childId={child.id} firstName={child.firstName} tz={centerTz()}
            entry={editing ? { id: editing.id, type: editing.type, label: editing.label, details: editing.details, time: editing.time, endTime: editing.endTime } as EditableEntry : undefined} />
        </div>
      )}

      {/* today's report */}
      <div className={`mt-4 rounded-[20px] border p-4 ${sent ? "border-line bg-primary-soft/50" : ready ? "border-success/40 bg-success-soft/50" : "border-line bg-surface"}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{sent ? "✅" : ready ? "🟢" : "⚪"}</span>
          <b className="text-[15px]">
            {sent ? `Report sent at ${fmtTime(report.sentAt?.slice(11))}` : pending.length ? "Needs review" : ready ? `${child.firstName}'s report is ready` : `Few notes so far (${entries.length} of 3)`}
          </b>
        </div>
        <p className="mt-1 text-[13px] leading-5 text-ink-2">
          {sent ? "Parents got WhatsApp, email and app notifications. Entries are locked now."
            : pending.length ? `Answer “Is this ${child.firstName}?” at the top first, so the report has the right entries.`
            : ready ? "Check it, then send it to the parents."
            : "A useful report needs about 3 entries, like a meal, a nap and a diaper. You can still send it if the child goes home early."}
        </p>
        {!sent && entries.length > 0 && pending.length === 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={`/app/teacher/reports/${child.id}`} className="btn btn-sm btn-secondary">Preview report</Link>
            <form action={sendReports}>
              <input type="hidden" name="childIds" value={child.id} />
              <input type="hidden" name="back" value={`/app/teacher/child/${child.id}`} />
              <button className={`btn btn-sm w-full ${ready ? "btn-primary" : "btn-secondary"}`}>{ready ? "Approve & send" : "Send anyway"}</button>
            </form>
          </div>
        )}
        {sent && <Link href={`/app/teacher/reports/${child.id}`} className="btn btn-sm btn-secondary mt-3 w-full">View the sent report</Link>}
      </div>
      </>}
      <SentConfirm ids={sp.sent} teacherId={teacher.id} closeHref={`/app/teacher/child/${child.id}`} />
    </div>
  );
}
