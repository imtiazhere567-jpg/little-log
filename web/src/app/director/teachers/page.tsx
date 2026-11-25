import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { saveTeacher } from "../manage-actions";
import { CheckRow, Field, FieldGroup, PageHead, Saved, SidePanel, inputCls } from "../ui";
import { Modal, Pagination } from "../Modal";
import { roomDay } from "@/lib/data";
import { roomAttendance } from "@/lib/attendance";
import { ageLabel, fmtTime, todayStr } from "@/lib/time";
import { Avatar, Badge, STATUS } from "@/components/ui";

export default async function TeachersRooms({ searchParams }: PageProps<"/director/teachers">) {
  const director = await requireUser("director");
  const sp = await searchParams;
  const db = await getDb();
  const rooms = await db.select().from(s.rooms).where(eq(s.rooms.centerId, director.centerId)).orderBy(asc(s.rooms.id));
  const teachers = await db.select().from(s.users)
    .where(eq(s.users.role, "teacher")).orderBy(asc(s.users.id));
  const assign = await db.select().from(s.teacherRooms);
  const kids = await db.select({ roomId: s.children.roomId }).from(s.children);
  const editing = sp.edit ? teachers.find((t) => String(t.id) === sp.edit) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const PAGE = 5;
  const mine = editing ? assign.filter((a) => a.teacherId === editing.id).map((a) => a.roomId) : [];
  // room popup (opened by clicking a room card)
  const openRoom = rooms.find((r) => String(r.id) === sp.room);
  const today = todayStr();
  const [roomToday, roomAtt] = openRoom ? await Promise.all([roomDay(openRoom.id, today), roomAttendance(openRoom.id, today)]) : [null, []];
  const roomStaff = openRoom ? assign.filter((a) => a.roomId === openRoom.id).map((a) => teachers.find((t) => t.id === a.teacherId)!).filter(Boolean) : [];

  return (
    <div className="w-full max-w-[1760px]">
      <PageHead title="Teachers & rooms" sub="Teachers only see the children in the rooms they are assigned to."
        action={<Link href="/director/teachers?new=1" scroll={false} className="btn btn-primary">＋ Add teacher</Link>} />
      <Saved show={!!sp.saved} text="Teacher saved." />

      <h2 className="font-display mb-3 mt-7 text-[22px] font-semibold">Rooms</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {rooms.map((r) => {
          const staff = assign.filter((a) => a.roomId === r.id).map((a) => teachers.find((t) => t.id === a.teacherId)?.name);
          const count = kids.filter((k) => k.roomId === r.id).length;
          return (
            <Link key={r.id} href={`/director/teachers?room=${r.id}`} scroll={false} className="card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-2)]">
              <div className="h-2" style={{ background: r.color }} />
              <div className="p-5">
                <div className="font-display text-[22px] font-semibold">{r.name}</div>
                <div className="text-[13px] text-ink-3">{r.ageGroup}</div>
                <div className="font-display tabular mt-3 text-[34px] font-semibold leading-9">{count}</div>
                <div className="text-[13px] text-ink-3">children</div>
                <div className="mt-3 text-sm text-ink-2">{staff.join(", ") || <span className="text-danger">No teacher</span>}</div>
                <div className="mt-3 text-[12.5px] font-bold text-primary">View room →</div>
              </div>
            </Link>
          );
        })}
      </div>

      <h2 className="font-display mb-3 mt-8 text-[22px] font-semibold">Teachers</h2>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wider text-ink-3">
            <tr><th className="px-5 py-3">Teacher</th><th>Email</th><th>Rooms</th><th className="px-5" /></tr>
          </thead>
          <tbody>
            {teachers.slice((page - 1) * PAGE, page * PAGE).map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="px-5 py-3">
                  <span className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-bold text-white">{t.name.replace("Ms. ", "").slice(0, 2).toUpperCase()}</span>
                    <b>{t.name}</b>
                  </span>
                </td>
                <td className="text-ink-2">{t.email}</td>
                <td>
                  <span className="flex flex-wrap gap-1.5">
                    {assign.filter((a) => a.teacherId === t.id).map((a) => {
                      const r = rooms.find((x) => x.id === a.roomId);
                      return r && (
                        <span key={r.id} className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">
                          <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />{r.name}
                        </span>
                      );
                    })}
                  </span>
                </td>
                <td className="whitespace-nowrap px-5 text-right">
                  <a href={`/api/demo-login?role=teacher&user=${t.id}&next=${encodeURIComponent("/teacher")}`} target="_blank" rel="noreferrer"
                    className="mr-4 font-bold text-accent-ink hover:underline">View as teacher ↗</a>
                  <Link href={`/director/teachers?edit=${t.id}`} scroll={false} className="font-bold text-primary">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-line px-5 py-3">
          <Pagination page={page} pageSize={PAGE} total={teachers.length} hrefFor={(n) => `/director/teachers?page=${n}`} />
        </div>
      </div>

      {(sp.new || editing) && (
        <SidePanel title={editing ? `Edit ${editing.name}` : "Add a teacher"} eyebrow="Teachers" closeHref="/director/teachers">
          <form action={saveTeacher} className="grid gap-4">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <Field label="Name as children say it" hint="e.g. Ms. Sara"><input name="name" required defaultValue={editing?.name} className={inputCls} /></Field>
            <Field label="Email"><input name="email" type="email" required defaultValue={editing?.email} className={inputCls} /></Field>
            <FieldGroup label="Rooms" hint="A teacher can work in more than one room.">
              <div className="grid gap-1.5">
                {rooms.map((r) => (
                  <CheckRow key={r.id} name="roomIds" value={r.id} checked={mine.includes(r.id)}>
                    <span className="h-3 w-3 rounded-full" style={{ background: r.color }} /><b>{r.name}</b><span className="text-ink-3">{r.ageGroup}</span>
                  </CheckRow>
                ))}
              </div>
            </FieldGroup>
            <button className="btn btn-primary mt-2">{editing ? "Save changes" : "Add teacher"}</button>
          </form>
        </SidePanel>
      )}
      {openRoom && roomToday && (() => {
        const here = roomAtt.filter((x) => x.status === "here").length;
        const sent = roomToday.children.filter((c) => c.status === "sent").length;
        return (
          <Modal title={`${openRoom.name} Room`} eyebrow={openRoom.ageGroup} sub={`${roomToday.children.length} children · ${roomStaff.map((t) => t.name).join(", ") || "no teacher assigned"}`}
            closeHref="/director/teachers" wide
            footer={<div className="flex flex-wrap gap-2">
              <Link href={`/director/attendance?room=${openRoom.id}`} className="btn btn-sm btn-secondary">Attendance</Link>
              <Link href={`/director/reports?room=${openRoom.id}`} className="btn btn-sm btn-secondary">Daily reports</Link>
              <Link href={`/director/messages?room=${openRoom.id}&show=all`} className="btn btn-sm btn-secondary">Family chats</Link>
              <Link href={`/director/children?room=${openRoom.id}`} className="btn btn-sm btn-primary">All children →</Link>
            </div>}>
            <div className="px-7 py-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ["Here now", `${here}`, `of ${roomAtt.length} children`],
                  ["Reports sent", `${sent}/${roomToday.children.length}`, `${roomToday.children.filter((c) => c.status === "ready").length} ready to send`],
                  ["Incidents today", `${roomToday.incidents.length}`, `${roomToday.incidents.filter((i) => i.status === "draft").length} waiting for you`],
                  ["Unclear names", `${roomToday.reviews.length}`, "for the teacher to check"],
                ].map(([l, v, sub]) => (
                  <div key={l} className="rounded-2xl border border-line bg-surface px-4 py-3">
                    <div className="text-[12.5px] font-semibold text-ink-2">{l}</div>
                    <div className="text-[26px] font-semibold leading-8">{v}</div>
                    <div className="text-xs text-ink-3">{sub}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_2fr]">
                <div>
                  <div className="eyebrow mb-2">Teachers</div>
                  <div className="grid gap-2">
                    {roomStaff.map((t) => (
                      <Link key={t.id} href={`/director/teachers?edit=${t.id}`} scroll={false} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5 hover:bg-surface-2/60">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-bold text-white">{t.name.replace("Ms. ", "").slice(0, 2).toUpperCase()}</span>
                        <span className="min-w-0 flex-1 text-sm"><b className="block">{t.name}</b><span className="block truncate text-ink-3">{t.email}</span></span>
                        <span className="text-xs font-bold text-primary">Edit</span>
                      </Link>
                    ))}
                    {roomStaff.length === 0 && <p className="text-sm text-danger">No teacher assigned yet.</p>}
                  </div>
                </div>
                <div>
                  <div className="eyebrow mb-2">Children today</div>
                  <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                    <table className="w-full text-sm">
                      <tbody>
                        {roomToday.children.map(({ child: c, status, entries }) => {
                          const a = roomAtt.find((x) => x.child.id === c.id);
                          return (
                            <tr key={c.id} className="border-t border-line first:border-0 hover:bg-surface-2/40">
                              <td className="py-2 pl-4">
                                <Link href={`/director/children/${c.id}`} className="flex items-center gap-2.5 hover:underline">
                                  <Avatar first={c.firstName} last={c.lastName} bg={c.avatarBg} fg={c.avatarFg} size={30} dot={STATUS[status].dot} />
                                  <span><b>{c.firstName} {c.lastName}</b>{c.medicalNotes && <span className="ml-1.5 text-[11px] font-bold text-danger" title={c.medicalNotes}>⚠ allergy</span>}
                                    <span className="block text-xs text-ink-3">{ageLabel(c.dateOfBirth, today)}</span></span>
                                </Link>
                              </td>
                              <td className="text-[12.5px] text-ink-2">
                                {a?.status === "here" ? `Here since ${fmtTime(a.att?.checkInAt)}` : a?.status === "gone" ? `Went home ${fmtTime(a.att?.checkOutAt)}` : a?.status === "absent" ? `Absent · ${a.att?.absentReason ?? ""}` : "Not arrived"}
                              </td>
                              <td className="tabular text-[12.5px] text-ink-3">{entries.length} {entries.length === 1 ? "note" : "notes"}</td>
                              <td className="pr-4 text-right"><Badge status={status} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
