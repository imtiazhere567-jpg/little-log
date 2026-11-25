import Link from "next/link";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { pickTeacherRoom } from "@/lib/data";
import { fmtDate, fmtTime, prevSchoolDay, todayStr, isNew } from "@/lib/time";
import { Avatar, NewTag, TypeIcon } from "@/components/ui";
import VoicePlayer from "@/components/VoicePlayer";
import DateSheet from "@/components/DateSheet";

const PAGE = 5;

export default async function Notes({ searchParams }: PageProps<"/app/teacher/notes">) {
  const teacher = await requireUser("teacher");
  const sp = await searchParams;
  const { room } = await pickTeacherRoom(teacher.id, typeof sp.room === "string" ? sp.room : undefined);
  if (!room) return <p className="p-6">No room assigned.</p>;
  const today = todayStr();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const page = Math.max(1, Number(sp.page) || 1);
  const db = await getDb();

  const kids = await db.select().from(s.children).where(eq(s.children.roomId, room.id)).orderBy(asc(s.children.firstName));
  const childId = kids.some((k) => String(k.id) === sp.child) ? Number(sp.child) : null;
  const notes = await db.select({ n: s.voiceNotes, t: s.users }).from(s.voiceNotes)
    .innerJoin(s.users, eq(s.users.id, s.voiceNotes.teacherId))
    .where(and(eq(s.voiceNotes.roomId, room.id), eq(s.voiceNotes.date, date)))
    .orderBy(desc(s.voiceNotes.time));
  const entries = notes.length ? await db.select().from(s.logEntries)
    .where(inArray(s.logEntries.voiceNoteId, notes.map(({ n }) => n.id))).orderBy(asc(s.logEntries.time)) : [];
  const incs = notes.length ? await db.select().from(s.incidents)
    .where(inArray(s.incidents.voiceNoteId, notes.map(({ n }) => n.id))) : [];
  const kidOf = new Map(kids.map((k) => [k.id, k]));
  const byNote = (id: number) => entries.filter((e) => e.voiceNoteId === id);
  const shown = notes.filter(({ n }) => !childId || byNote(n.id).some((e) => e.childId === childId)
    || incs.some((i) => i.voiceNoteId === n.id && i.childId === childId));
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));

  // last 6 school days for quick switching
  const days = [today];
  while (days.length < 6) days.push(prevSchoolDay(days.at(-1)!));
  const href = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const all: Record<string, string | null> = { date: date === today ? null : date, child: childId ? String(childId) : null, ...extra };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    return `/app/teacher/notes${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="px-[18px]">
      <div className="eyebrow mt-1.5">{room.name} Room</div>
      <h1 className="font-display mt-0.5 text-[30px] font-semibold leading-[35px]">Voice notes</h1>
      <p className="mt-1 text-sm text-ink-2">Every note as text, which child it was about, and what it saved.</p>

      {/* day */}
      <div className="no-scrollbar relative -mx-[18px] mt-4 flex gap-2 overflow-x-auto px-[18px]">
        {days.map((d, i) => (
          <Link key={d} href={href({ date: d === today ? null : d, page: null })} scroll={false}
            className={`flex h-14 min-w-[62px] flex-col items-center justify-center rounded-2xl border px-2.5 text-center ${d === date ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2"}`}>
            <span className="text-[10.5px] font-bold uppercase tracking-wider opacity-70">{i === 0 ? "Today" : i === 1 ? "Yest." : fmtDate(d).split(",")[0].slice(0, 3)}</span>
            <span className="text-[16px] font-bold leading-5">{Number(d.slice(8))}</span>
          </Link>
        ))}
        <DateSheet value={date} max={today} path="/app/teacher/notes" keep={childId ? { child: String(childId) } : {}} />
      </div>

      {/* child */}
      <div className="no-scrollbar relative -mx-[18px] mt-3 flex gap-2 overflow-x-auto px-[18px] pb-1">
        <Link href={href({ child: null, page: null })} scroll={false}
          className={`flex h-10 flex-none items-center rounded-full border px-3.5 text-[13px] font-semibold ${!childId ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2"}`}>
          All children
        </Link>
        {kids.map((k) => {
          const n = notes.filter(({ n: v }) => byNote(v.id).some((e) => e.childId === k.id)).length;
          const on = childId === k.id;
          return (
            <Link key={k.id} href={href({ child: String(k.id), page: null })} scroll={false}
              className={`flex h-10 flex-none items-center gap-1.5 rounded-full border pl-1 pr-3 text-[13px] font-semibold ${on ? "border-primary bg-primary-soft text-primary" : n ? "border-line bg-surface text-ink-2" : "border-line bg-surface/60 text-ink-3"}`}>
              <Avatar first={k.firstName} last={k.lastName} bg={k.avatarBg} fg={k.avatarFg} size={28} />
              {k.firstName} <span className="opacity-60">{n}</span>
            </Link>
          );
        })}
      </div>

      <div className="mb-2 mt-3 text-[13px] text-ink-3">
        {fmtDate(date)} · {shown.length} {shown.length === 1 ? "note" : "notes"}{childId ? ` about ${kidOf.get(childId)?.firstName}` : ""}
      </div>

      <div className="grid gap-3">
        {shown.slice((page - 1) * PAGE, page * PAGE).map(({ n, t }) => {
          const made = byNote(n.id);
          const who = [...new Set(made.map((e) => e.childId).filter(Boolean))] as number[];
          const focus = childId ? kidOf.get(childId) : undefined;
          const mine = focus ? made.filter((e) => e.childId === focus.id) : [];
          const othersCount = focus ? who.filter((id) => id !== focus.id).length : 0;
          return (
            <article key={n.id} className="card p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="eyebrow flex items-center gap-1.5">🎙️ {fmtTime(n.time)}{t.id !== teacher.id ? ` · ${t.name}` : ""}
                  {made.some((e) => isNew(e.createdAt)) && <NewTag />}</span>
                <span className="text-[12px] font-semibold text-ink-3">
                  {focus ? `${mine.length} ${mine.length === 1 ? "entry" : "entries"} for ${focus.firstName}` : `${made.length} ${made.length === 1 ? "entry" : "entries"}`}
                </span>
              </div>

              {focus ? (
                <>
                  {/* only the selected child's data */}
                  <div className="grid gap-1.5">
                    {mine.map((e) => (
                      <div key={e.id} className="flex items-center gap-2.5 rounded-xl bg-primary-soft/50 px-2.5 py-2">
                        <TypeIcon type={e.type} size={28} />
                        <span className="min-w-0 flex-1 text-[13.5px] leading-[18px]">
                          <b className="block text-[12px]">{e.label ?? e.type.charAt(0).toUpperCase() + e.type.slice(1)}</b>
                          {e.type === "nap" && e.endTime ? `${fmtTime(e.time)} – ${fmtTime(e.endTime)}` : e.details}
                        </span>
                        <span className="tabular text-[12px] font-semibold text-ink-3">{fmtTime(e.time)}</span>
                      </div>
                    ))}
                    {mine.length === 0 && <p className="text-[13px] text-ink-3">An incident about {focus.firstName} came from this note.</p>}
                  </div>
                  <details className="group mt-3 rounded-xl border border-line">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-[13px] font-bold text-ink-2">
                      <span>▶ Play full voice note</span>
                      <span className="text-ink-3 transition group-open:rotate-180">⌄</span>
                    </summary>
                    <div className="border-t border-line px-3 py-3">
                      <VoicePlayer text={n.transcript} highlight={focus.firstName} />
                      <p className="mt-2 text-[11.5px] text-ink-3">The teacher&apos;s original words. {focus.firstName}&apos;s name is highlighted.</p>
                    </div>
                  </details>
                  {othersCount > 0 && <p className="mt-2 text-[12px] text-ink-3">This note also saved entries for +{othersCount} other {othersCount === 1 ? "child" : "children"}.</p>}
                </>
              ) : (
                <>
                  <VoicePlayer text={n.transcript} />
                  {who.length > 0 && (
                    <div className="mt-3 border-t border-dashed border-line pt-3">
                      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-3">Saved for</div>
                      <div className="grid gap-1.5">
                        {who.map((cid) => {
                          const k = kidOf.get(cid);
                          if (!k) return null;
                          const theirs = made.filter((e) => e.childId === cid);
                          return (
                            <Link key={cid} href={href({ child: String(cid), page: null })} scroll={false}
                              className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-surface-2">
                              <Avatar first={k.firstName} last={k.lastName} bg={k.avatarBg} fg={k.avatarFg} size={26} />
                              <b className="text-[13.5px]">{k.firstName}</b>
                              <span className="ml-auto flex gap-1">{theirs.map((e) => <TypeIcon key={e.id} type={e.type} size={22} />)}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
              {incs.filter((i) => i.voiceNoteId === n.id && (!focus || i.childId === focus.id)).map((i) => (
                <Link key={i.id} href={`/app/teacher?incident=${i.id}`}
                  className="mt-2 flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-[12.5px] font-semibold text-danger">
                  ⚠ Incident for {kidOf.get(i.childId)?.firstName}: {i.injury.toLowerCase()} · {i.status === "draft" ? "waiting for the director" : i.status}
                  <span className="ml-auto">›</span>
                </Link>
              ))}
              {!focus && made.some((e) => !e.childId) && (
                <p className="mt-2 rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-[#6B4A0C]">An unclear name in this note is waiting for you on Today.</p>
              )}
            </article>
          );
        })}
        {shown.length === 0 && (
          <div className="card p-6 text-center text-sm text-ink-3">
            {date === today ? "No voice notes yet today. Tap the orange mic to record one." : "No voice notes on this day."}
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          {page > 1 ? <Link href={href({ page: String(page - 1) })} scroll={false} className="btn btn-sm btn-secondary">‹ Newer</Link> : <span />}
          <span className="tabular text-[13px] text-ink-3">Page {page} of {pages}</span>
          {page < pages ? <Link href={href({ page: String(page + 1) })} scroll={false} className="btn btn-sm btn-secondary">Older ›</Link> : <span />}
        </div>
      )}
      <p className="mt-4 text-center text-[11.5px] leading-[17px] text-ink-3">
        Demo: notes are replayed with a computer voice. In a real center the original recording is deleted after it becomes text (Settings → Privacy).
      </p>
    </div>
  );
}
