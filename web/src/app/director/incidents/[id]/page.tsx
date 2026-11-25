import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { fmtDate, fmtTime } from "@/lib/time";
import { Avatar, Badge, WarnIcon } from "@/components/ui";
import { decideIncident } from "../../actions";

export default async function IncidentReview({ params }: PageProps<"/director/incidents/[id]">) {
  await requireUser("director");
  const { id } = await params;
  const db = await getDb();
  const [row] = await db.select({ inc: s.incidents, child: s.children, room: s.rooms }).from(s.incidents)
    .innerJoin(s.children, eq(s.children.id, s.incidents.childId))
    .innerJoin(s.rooms, eq(s.rooms.id, s.children.roomId))
    .where(eq(s.incidents.id, Number(id)));
  if (!row) notFound();
  const { inc, child, room } = row;
  const [staff] = await db.select().from(s.users).where(eq(s.users.id, inc.staffId));
  const parents = await db.select({ u: s.users }).from(s.childParents)
    .innerJoin(s.users, eq(s.users.id, s.childParents.parentId)).where(eq(s.childParents.childId, child.id));
  const [note] = inc.voiceNoteId ? await db.select().from(s.voiceNotes).where(eq(s.voiceNotes.id, inc.voiceNoteId)) : [];
  const editable = inc.status === "draft";

  const field = (name: keyof typeof inc, label: string, rows = 1) => (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">{label}</span>
      {editable ? (
        rows > 1
          ? <textarea name={name} defaultValue={String(inc[name])} rows={rows} className="rounded-xl border border-line bg-surface px-3 py-2.5 leading-6" />
          : <input name={name} defaultValue={String(inc[name])} className="h-11 rounded-xl border border-line bg-surface px-3" />
      ) : <span className="text-[15px]">{String(inc[name])}</span>}
    </label>
  );

  return (
    <div className="w-full max-w-[1760px]">
      <Link href="/director/incidents" className="text-sm font-bold text-primary">← Incidents</Link>

      {inc.isSerious && editable && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-danger px-5 py-3.5 text-white">
          <WarnIcon size={22} />
          <b>Serious incident: call the parent now, then complete this report.</b>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Avatar first={child.firstName} last={child.lastName} bg={child.avatarBg} fg={child.avatarFg} size={56} />
        <div>
          <div className="eyebrow">Incident report · {room.name} Room</div>
          <h1 className="font-display text-[30px] font-semibold leading-9">{child.firstName} {child.lastName}</h1>
        </div>
        <span className="ml-auto"><Badge status={editable ? "awaiting" : inc.status} /></span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <form action={decideIncident} className="card grid gap-4 rounded-3xl border-l-[5px] border-l-danger p-6">
          <input type="hidden" name="id" value={inc.id} />
          <div className="grid grid-cols-3 gap-4 text-[15px]">
            <div><div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Date</div>{fmtDate(inc.date)}</div>
            <div><div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Time</div>{fmtTime(inc.time)}</div>
            <div><div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Staff present</div>{staff?.name}</div>
          </div>
          {field("location", "Location")}
          {field("description", "What happened", 2)}
          <div className="grid grid-cols-2 gap-4">
            {field("injury", "Injury")}
            {field("bodyPart", "Body part")}
          </div>
          {field("actionTaken", "First aid / action taken", 2)}
          <div className="flex flex-wrap gap-2 text-sm">
            <span className={`badge ${inc.callParentNow ? "bg-danger text-white" : "bg-surface-2 text-ink-2"}`}>
              {inc.callParentNow ? "Call parent now" : "No immediate call needed"}
            </span>
          </div>
          {editable ? (
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <button name="decision" value="approve" className="btn btn-primary">Approve &amp; notify parents</button>
              <button name="decision" value="reject" className="btn btn-secondary text-danger">Reject</button>
              <span className="ml-auto self-center text-xs text-ink-3">Your edits are saved when you approve.</span>
            </div>
          ) : (
            <p className="border-t border-line pt-4 text-sm text-ink-2">
              {inc.status === "approved" ? "Approved" : "Rejected"} {inc.decidedAt ? `on ${fmtDate(inc.decidedAt.slice(0, 10))}` : ""}.
              {inc.status === "approved" && (inc.parentAckAt ? " The parent confirmed they read it." : " The parent has not opened it yet.")}
            </p>
          )}
        </form>

        <aside className="grid content-start gap-4">
          <div className="card p-5">
            <div className="eyebrow mb-2">Parents</div>
            {parents.map(({ u }) => (
              <div key={u.id} className="flex items-center justify-between border-b border-dashed border-line py-2 last:border-0">
                <span><b className="block text-sm">{u.name}</b><span className="text-xs text-ink-3">{u.phone}</span></span>
                {u.phone && <a href={`tel:${u.phone}`} className="btn btn-sm btn-secondary">📞 Call</a>}
              </div>
            ))}
            <p className="mt-3 text-xs leading-[18px] text-ink-3">
              After approval they get WhatsApp, email and app notifications saying a report is ready. No details are in the message.
            </p>
          </div>
          {note && (
            <div className="card p-5">
              <div className="eyebrow mb-2">From {staff?.name}&apos;s voice note · {fmtTime(note.time)}</div>
              <p className="text-sm italic leading-[21px] text-ink-2">“{note.transcript}”</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
