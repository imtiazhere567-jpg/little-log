import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { pickupOptions, statusOf } from "@/lib/attendance";
import { BrandField } from "@/components/BrandPicker";
import { requireUser } from "@/lib/session";
import { parseReport } from "@/lib/data";
import { addDays, ageLabel, dateOf, fmtDate, fmtShort, fmtStamp, fmtTime, todayStr } from "@/lib/time";
import { Avatar, Badge, EntryRow } from "@/components/ui";
import ReportCard from "@/components/ReportCard";
import ChildForm from "../../ChildForm";
import { Field, Saved, SidePanel, Toggle, inputCls } from "../../ui";
import { Pagination } from "../../Modal";
import { saveParent } from "../../manage-actions";

const TABS = ["overview", "family", "today", "reports", "incidents"] as const;
type Tab = (typeof TABS)[number];
const CHANNEL = { whatsapp: { label: "WhatsApp", color: "#2FA765" }, email: { label: "Email", color: "#4A7FD4" }, push: { label: "App", color: "#E8955A" } };

/** "3 weeks", "8 months", "1 year 2 months" between two YYYY-MM-DD dates */
function since(from: string | null | undefined, to: string) {
  if (!from) return "";
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5);
  if (days < 1) return "today";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  const months = Math.floor(days / 30.4);
  if (months < 12) return `${months} months`;
  const y = Math.floor(months / 12), m = months % 12;
  return `${y} year${y > 1 ? "s" : ""}${m ? ` ${m} month${m > 1 ? "s" : ""}` : ""}`;
}
const stamp = (d: Date | string | null) => fmtStamp(d);

export default async function ChildProfile({ params, searchParams }: PageProps<"/director/children/[id]">) {
  const director = await requireUser("director");
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = TABS.find((t) => t === sp.tab) ?? "overview";
  const db = await getDb();
  const [row] = await db.select({ child: s.children, room: s.rooms }).from(s.children)
    .innerJoin(s.rooms, eq(s.rooms.id, s.children.roomId))
    .where(and(eq(s.children.id, Number(id)), eq(s.rooms.centerId, director.centerId)));
  if (!row) notFound();
  const { child: c, room } = row;
  const today = todayStr();
  const base = `/director/children/${c.id}`;

  const [rooms, parentsLinked, allParents, entries, reports, incidents, teachers, allLinks, recentDays] = await Promise.all([
    db.select().from(s.rooms).where(eq(s.rooms.centerId, director.centerId)).orderBy(asc(s.rooms.id)),
    db.select({ u: s.users, relationship: s.childParents.relationship }).from(s.childParents)
      .innerJoin(s.users, eq(s.users.id, s.childParents.parentId)).where(eq(s.childParents.childId, c.id)).orderBy(asc(s.users.id)),
    db.select({ id: s.users.id, name: s.users.name, email: s.users.email }).from(s.users).where(eq(s.users.role, "parent")),
    db.select().from(s.logEntries).where(and(eq(s.logEntries.childId, c.id), eq(s.logEntries.date, today))).orderBy(asc(s.logEntries.time)),
    db.select().from(s.dailyReports).where(eq(s.dailyReports.childId, c.id)).orderBy(desc(s.dailyReports.date)),
    db.select().from(s.incidents).where(eq(s.incidents.childId, c.id)).orderBy(desc(s.incidents.date)),
    db.select({ name: s.users.name }).from(s.teacherRooms).innerJoin(s.users, eq(s.users.id, s.teacherRooms.teacherId)).where(eq(s.teacherRooms.roomId, room.id)),
    db.select({ parentId: s.childParents.parentId, childId: s.childParents.childId, first: s.children.firstName, roomId: s.children.roomId })
      .from(s.childParents).innerJoin(s.children, eq(s.children.id, s.childParents.childId)),
    db.selectDistinct({ date: s.logEntries.date }).from(s.logEntries)
      .where(and(eq(s.logEntries.childId, c.id), gte(s.logEntries.date, addDays(today, -29)))),
  ]);
  const sentReports = reports.filter((r) => r.status === "sent");
  const [pickupList, attRows] = await Promise.all([
    pickupOptions(c.id),
    db.select().from(s.attendance).where(and(eq(s.attendance.childId, c.id), gte(s.attendance.date, addDays(today, -29)))).orderBy(desc(s.attendance.date)),
  ]);
  const todayAtt = attRows.find((a) => a.date === today);
  const roomName = (rid: number) => rooms.find((r) => r.id === rid)?.name ?? "";

  // ---- family engagement: messages about THIS child, plus each parent's app activity
  const parentIds = parentsLinked.map((p) => p.u.id);
  const reportIds = new Set(reports.map((r) => r.id)), incidentIds = new Set(incidents.map((i) => i.id));
  const [notes, views] = parentIds.length ? await Promise.all([
    db.select().from(s.notifications).where(inArray(s.notifications.parentId, parentIds)).orderBy(desc(s.notifications.id)),
    db.select().from(s.auditLog).where(and(inArray(s.auditLog.userId, parentIds), eq(s.auditLog.action, "viewed"))).orderBy(desc(s.auditLog.id)),
  ]) : [[], []];
  const aboutChild = notes.filter((n) => (n.kind === "daily_report" || n.kind === "incident") && (n.kind === "daily_report" ? reportIds : incidentIds).has(n.recordId));
  const approved = incidents.filter((i) => i.status === "approved");

  // ---- daily reports paging
  const page = Math.max(1, Number(sp.page) || 1);
  const PAGE = 10;
  const viewReport = reports.find((r) => String(r.id) === sp.report);
  const editParent = parentsLinked.find((p) => String(p.u.id) === sp.editParent);
  const tabHref = (t: Tab) => `${base}?tab=${t}`;
  const counts: Record<Tab, number | null> = { overview: null, family: parentsLinked.length, today: entries.length, reports: sentReports.length, incidents: incidents.length };
  const LABEL: Record<Tab, string> = { overview: "Overview", family: "Family", today: "Today's log", reports: "Daily reports", incidents: "Incidents" };

  return (
    <div className="w-full max-w-[1760px]">
      <Link href="/director/children" className="text-sm font-bold text-primary">← Children</Link>
      <Saved show={sp.saved === "1"} text="Saved." />
      <Saved show={sp.saved === "parent"} text="Parent details saved." />
      {sp.saved === "enrolled" && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-primary-soft px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-white">✓</span>
          <span className="min-w-0 flex-1 text-sm text-ink-2">
            <b className="block text-[15px] text-ink">{c.firstName} is enrolled in the {room.name} Room.</b>
            Teachers can log notes for {c.firstName} today. Parents get an invite to their own account.
          </span>
          {parentsLinked[0] && (
            <a href={`/api/demo-login?role=parent&user=${parentsLinked[0].u.id}&next=${encodeURIComponent("/parent")}`} target="_blank" rel="noreferrer"
              className="btn btn-sm btn-primary">View the app as {parentsLinked[0].u.name.split(" ")[0]} ↗</a>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ------------------------------------------------ identity column */}
        <aside className="grid content-start gap-4">
          <div className="card overflow-hidden">
            <div className="h-2" style={{ background: room.color }} />
            <div className="p-6 text-center">
              <div className="flex justify-center"><Avatar first={c.firstName} last={c.lastName} bg={c.avatarBg} fg={c.avatarFg} size={84} /></div>
              <h1 className="font-display mt-3 text-[28px] font-semibold leading-8">{c.firstName} {c.lastName}</h1>
              <p className="mt-1 flex items-center justify-center gap-2 text-sm text-ink-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: room.color }} />{room.name} Room · {ageLabel(c.dateOfBirth, today)}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {c.enrolledOn && <span className="badge bg-primary-soft text-primary">With us {since(c.enrolledOn, today)}</span>}
                <span className={`badge ${c.photoConsent ? "bg-success-soft text-[#2C6B42]" : "bg-surface-2 text-ink-3"}`}>Photos {c.photoConsent ? "allowed" : "not allowed"}</span>
              </div>
              {c.medicalNotes && (
                <div className="mt-4 rounded-xl border-l-4 border-danger bg-danger-soft px-3 py-2.5 text-left text-[13px] leading-5">
                  <b className="block text-[11px] uppercase tracking-wider text-danger">Allergies & medical</b>{c.medicalNotes}
                </div>
              )}
              <Link href={`${base}?edit=1&tab=${tab}`} scroll={false} className="btn btn-sm btn-secondary mt-5 w-full">Edit child</Link>
            </div>
          </div>

          <Link href={tabHref("family")} className="card block p-5 transition hover:shadow-[var(--shadow-2)]">
            <div className="mb-2 flex items-center justify-between"><span className="eyebrow">Parents & guardians</span><span className="text-xs font-bold text-primary">Family tab →</span></div>
            {parentsLinked.map(({ u, relationship }) => (
              <div key={u.id} className="flex items-center gap-2.5 py-1.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-[11px] font-bold text-white">{u.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</span>
                <span className="min-w-0 text-sm"><b className="block truncate">{u.name}</b><span className="text-xs text-ink-3">{relationship ?? "Parent"}</span></span>
              </div>
            ))}
            {parentsLinked.length === 0 && <p className="text-sm text-danger">No parent linked yet.</p>}
          </Link>
          <Link href={`/director/records?child=${c.id}`} className="btn btn-sm btn-secondary">Export records →</Link>
        </aside>

        {/* ------------------------------------------------ tabs */}
        <section className="min-w-0">
          <nav className="flex flex-wrap gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-1)]" aria-label="Child profile">
            {TABS.map((t) => (
              <Link key={t} href={tabHref(t)} scroll={false} aria-current={tab === t ? "page" : undefined}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === t ? "bg-ink text-bg shadow-[var(--shadow-1)]" : "text-ink-2 hover:bg-surface-2"}`}>
                {LABEL[t]}
                {counts[t] !== null && <span className={`rounded-full px-1.5 text-[11px] leading-5 ${tab === t ? "bg-bg/20" : "bg-surface-2"}`}>{counts[t]}</span>}
              </Link>
            ))}
          </nav>

          {/* ================================ OVERVIEW */}
          {tab === "overview" && (
            <div className="mt-4 grid gap-4">
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <Stat label="Days attended" value={attRows.filter((a) => a.checkInAt).length || recentDays.length} sub={`in the last 30 days · ${attRows.filter((a) => a.absent).length} absent`} />
                <Stat label="Reports sent" value={sentReports.length} sub={sentReports[0] ? `last on ${fmtDate(sentReports[0].date, { weekday: false })}` : "none yet"} />
                <Stat label="Incidents" value={incidents.length} sub={`${incidents.filter((i) => i.status === "draft").length} awaiting approval`} />
                <Stat label="Entries today" value={entries.length} sub={entries.at(-1) ? `last at ${fmtTime(entries.at(-1)!.time)}` : "nothing yet"} />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <Panel title="About">
                  <Rows rows={[
                    ["Full name", `${c.firstName} ${c.lastName}`],
                    ["Date of birth", `${fmtDate(c.dateOfBirth, { weekday: false, year: true })} · ${ageLabel(c.dateOfBirth, today)}`],
                    ["Enrolled on", c.enrolledOn ? `${fmtDate(c.enrolledOn, { weekday: false, year: true })} · ${since(c.enrolledOn, today)} ago` : "–"],
                    ["Room", <span key="r" className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: room.color }} />{room.name} · {room.ageGroup}</span>],
                    ["Teachers", teachers.map((t) => t.name).join(", ") || "–"],
                    ["Photo consent", c.photoConsent ? "Yes, signed" : "No"],
                    ["Allergies & medical", c.medicalNotes ?? "None recorded"],
                  ]} />
                </Panel>
                <Panel title="Family at a glance" action={<Link href={tabHref("family")} className="text-sm font-bold text-primary">Full details →</Link>}>
                  <div className="grid gap-3">
                    {parentsLinked.map(({ u, relationship }) => (
                      <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-surface-2/60 px-4 py-3">
                        <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-xs font-bold text-white">{u.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</span>
                        <span className="min-w-0 flex-1 text-sm">
                          <b className="block">{u.name} <span className="font-semibold text-ink-3">· {relationship ?? "Parent"}</span></b>
                          <span className="block truncate text-ink-3">{u.phone ?? u.email} · parent since {fmtDate(dateOf(new Date(u.createdAt)), { weekday: false, year: true })}</span>
                        </span>
                      </div>
                    ))}
                    {parentsLinked.length === 0 && <p className="text-sm text-danger">No parent linked yet.</p>}
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {tab === "overview" && (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <Panel title="Check-in & pickup">
                <Rows rows={[
                  ["Today", (() => {
                    const st = statusOf(todayAtt);
                    return st === "here" ? `Here since ${fmtTime(todayAtt?.checkInAt)}` : st === "gone" ? `${fmtTime(todayAtt?.checkInAt)} – ${fmtTime(todayAtt?.checkOutAt)} · picked up by ${todayAtt?.pickedUpBy}`
                      : st === "absent" ? `Absent · ${todayAtt?.absentReason ?? ""}` : "Not checked in yet";
                  })()],
                  ["Usual hours", `${fmtTime(c.expectedIn)} – ${fmtTime(c.expectedOut)}`],
                  ["May pick up", <span key="p" className="grid gap-1">{pickupList.map((p) => (
                    <span key={p.key}><b>{p.name}</b> <span className="text-ink-3">· {p.relationship}{p.phone ? ` · ${p.phone}` : ""}</span></span>
                  ))}</span>],
                ]} />
              </Panel>
              <Panel title="Last check-ins" action={<Link href="/director/attendance" className="text-sm font-bold text-primary">Attendance →</Link>}>
                <div className="grid text-sm">
                  {attRows.slice(0, 7).map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 border-b border-dashed border-line py-2 last:border-0">
                      <span className="font-semibold">{fmtDate(a.date)}</span>
                      <span className="text-right text-ink-2">{a.absent ? <span className="text-[#8A5E0F]">Absent · {a.absentReason}</span>
                        : `${fmtTime(a.checkInAt)} – ${a.checkOutAt ? fmtTime(a.checkOutAt) : "still here"}${a.pickedUpBy ? ` · ${a.pickedUpBy.replace(/ \(.*\)$/, "")}` : ""}`}</span>
                    </div>
                  ))}
                  {attRows.length === 0 && <p className="py-4 text-ink-3">No check-ins recorded yet.</p>}
                </div>
              </Panel>
            </div>
          )}

          {/* ================================ FAMILY */}
          {tab === "family" && (
            <div className="mt-4 grid gap-4">
              {parentsLinked.map(({ u, relationship }, idx) => {
                const siblings = allLinks.filter((l) => l.parentId === u.id && l.childId !== c.id);
                const mine = aboutChild.filter((n) => n.parentId === u.id);
                const opened = mine.filter((n) => n.readAt);
                const myViews = views.filter((v) => v.userId === u.id);
                const lastSeen = [...myViews.map((v) => new Date(v.createdAt)), ...notes.filter((n) => n.parentId === u.id && n.readAt).map((n) => new Date(n.readAt!))]
                  .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
                const joined = dateOf(new Date(u.createdAt));
                return (
                  <article key={u.id} className="card overflow-hidden">
                    <header className="flex flex-wrap items-center gap-4 border-b border-line bg-gradient-to-r from-primary-soft/70 to-surface px-6 py-5">
                      <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-lg font-bold text-white shadow-[0_6px_16px_rgba(47,111,98,.3)]">
                        {u.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-display text-[24px] font-semibold leading-7">{u.name}</h2>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="badge bg-surface text-ink-2">{relationship ?? "Parent"} of {c.firstName}</span>
                          {idx === 0 && <span className="badge bg-accent-soft text-accent-ink">Primary contact</span>}
                          <span className={`badge ${u.whatsappOptIn ? "bg-success-soft text-[#2C6B42]" : "bg-surface-2 text-ink-3"}`}>WhatsApp {u.whatsappOptIn ? "on" : "off"}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {u.phone && <a href={`tel:${u.phone}`} className="btn btn-sm btn-secondary">📞 Call</a>}
                        <a href={`mailto:${u.email}`} className="btn btn-sm btn-secondary">✉ Email</a>
                        <Link href={`${base}?tab=family&editParent=${u.id}`} scroll={false} className="btn btn-sm btn-secondary">Edit</Link>
                        <a href={`/api/demo-login?role=parent&user=${u.id}&next=${encodeURIComponent("/parent")}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-primary">View app ↗</a>
                      </div>
                    </header>

                    <div className="grid gap-6 p-6 xl:grid-cols-2">
                      <div>
                        <h3 className="eyebrow mb-2">Contact & account</h3>
                        <Rows rows={[
                          ["Email", u.email],
                          ["Phone", u.phone ?? "–"],
                          ["Parent since", `${fmtDate(joined, { weekday: false, year: true })} · ${since(joined, today)}`],
                          ["Last active", lastSeen ? stamp(lastSeen) : "Not yet"],
                          ["Notifications", [u.whatsappOptIn && "WhatsApp", "Email", "App"].filter(Boolean).join(", ")],
                        ]} />
                      </div>

                      <div>
                        <h3 className="eyebrow mb-2">Children at Sunny Days</h3>
                        <div className="grid gap-2">
                          {[{ childId: c.id, first: c.firstName, roomId: c.roomId }, ...siblings].map((k) => (
                            <Link key={k.childId} href={`/director/children/${k.childId}`}
                              className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm ${k.childId === c.id ? "border-primary bg-primary-soft/50" : "border-line hover:bg-surface-2/60"}`}>
                              <b>{k.first}</b>
                              <span className="flex items-center gap-1.5 text-xs text-ink-3">
                                <span className="h-2 w-2 rounded-full" style={{ background: rooms.find((r) => r.id === k.roomId)?.color }} />{roomName(k.roomId)} Room
                                {k.childId === c.id && <span className="ml-1 font-bold text-primary">· this child</span>}
                              </span>
                            </Link>
                          ))}
                        </div>
                        <h3 className="eyebrow mb-2 mt-5">Engagement · about {c.firstName}</h3>
                        <div className="grid grid-cols-3 gap-2">
                          <Mini label="Messages" value={mine.length} />
                          <Mini label="Opened" value={mine.length ? `${Math.round((opened.length / mine.length) * 100)}%` : "–"} />
                          <Mini label="Reports read" value={myViews.filter((v) => v.tableName === "daily_reports" && reportIds.has(v.recordId)).length} />
                        </div>
                        <p className="mt-2 text-xs text-ink-3">
                          Incident reports confirmed: <b className="text-ink">{approved.filter((i) => i.parentAckAt).length} of {approved.length}</b>
                        </p>
                      </div>

                      <div className="min-w-0 xl:col-span-2">
                        <h3 className="eyebrow mb-2">Recent messages about {c.firstName}</h3>
                        <div className="grid overflow-hidden rounded-2xl border border-line md:grid-cols-2">
                          {mine.slice(0, 6).map((n) => (
                            <div key={n.id} className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 text-sm md:odd:border-r">
                              <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: CHANNEL[n.channel].color }} title={CHANNEL[n.channel].label} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold">{n.kind === "incident" ? "Incident report ready" : "Daily report ready"}</span>
                                <span className="text-xs text-ink-3">{CHANNEL[n.channel].label} · {stamp(n.createdAt)}</span>
                              </span>
                              <span className={`badge ${n.readAt ? "bg-success-soft text-[#2C6B42]" : "bg-surface-2 text-ink-3"}`}>{n.readAt ? "Opened" : "Unread"}</span>
                            </div>
                          ))}
                          {mine.length === 0 && <p className="p-5 text-center text-sm text-ink-3 md:col-span-2">No messages about {c.firstName} yet.</p>}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
              {parentsLinked.length === 0 && (
                <div className="card p-8 text-center">
                  <p className="text-ink-2">No parent is linked to {c.firstName} yet.</p>
                  <Link href={`${base}?edit=1&tab=family`} scroll={false} className="btn btn-sm btn-primary mt-3">Link a parent</Link>
                </div>
              )}
              {parentsLinked.length > 0 && parentsLinked.length < 2 && (
                <Link href={`${base}?edit=1&tab=family`} scroll={false}
                  className="flex h-12 items-center justify-center rounded-2xl border-2 border-dashed border-line text-sm font-bold text-ink-2 hover:border-primary hover:text-primary">
                  ＋ Link a second parent or guardian
                </Link>
              )}
            </div>
          )}

          {/* ================================ TODAY */}
          {tab === "today" && (
            <div className="card mt-4 px-5 py-2">
              {entries.map((e) => (
                <EntryRow key={e.id} type={e.type} label={e.label} details={e.details}
                  end={e.endTime ? `${fmtShort(e.time)} – ${fmtShort(e.endTime)}` : undefined} time={fmtTime(e.time)} />
              ))}
              {entries.length === 0 && <p className="py-6 text-center text-sm text-ink-3">Nothing logged yet today.</p>}
            </div>
          )}

          {/* ================================ REPORTS (paged) */}
          {tab === "reports" && (
            <div className="card mt-4 overflow-hidden">
              <div className="divide-y divide-line">
                {reports.slice((page - 1) * PAGE, page * PAGE).map((r) => (
                  <Link key={r.id} href={`${base}?tab=reports&page=${page}&report=${r.id}`} scroll={false} className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-2/40">
                    <span>
                      <b className="block text-[15px]">{fmtDate(r.date)}</b>
                      <span className="text-[13px] text-ink-2">{parseReport(r.content).greeting}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {r.sentAt && <span className="tabular text-xs text-ink-3">sent {fmtTime(r.sentAt.slice(11))}</span>}
                      <span className={`badge ${r.status === "sent" ? "bg-primary-soft text-primary" : "bg-surface-2 text-ink-2"}`}>{r.status}</span>
                      <span className="text-ink-3">›</span>
                    </span>
                  </Link>
                ))}
                {reports.length === 0 && <p className="p-6 text-center text-sm text-ink-3">No reports yet.</p>}
              </div>
              {reports.length > PAGE && (
                <div className="border-t border-line px-5 py-3">
                  <Pagination page={page} pageSize={PAGE} total={reports.length} hrefFor={(n) => `${base}?tab=reports&page=${n}`} />
                </div>
              )}
            </div>
          )}

          {/* ================================ INCIDENTS */}
          {tab === "incidents" && (
            <div className="card mt-4 divide-y divide-line">
              {incidents.map((i) => (
                <Link key={i.id} href={`/director/incidents/${i.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-2/40">
                  <span>
                    <b className="block text-[15px]">{i.injury} · {i.location}</b>
                    <span className="text-[13px] text-ink-2">{fmtDate(i.date)} · {fmtTime(i.time)}{i.status === "approved" && (i.parentAckAt ? " · parent confirmed" : " · parent hasn't confirmed")}</span>
                  </span>
                  <Badge status={i.status === "draft" ? "awaiting" : i.status} />
                </Link>
              ))}
              {incidents.length === 0 && <p className="p-6 text-center text-sm text-ink-3">No incidents. 🌿</p>}
            </div>
          )}
        </section>
      </div>

      {sp.edit && (
        <SidePanel title={`Edit ${c.firstName}`} eyebrow="Children" closeHref={tabHref(tab)}>
          <ChildForm child={c} rooms={rooms} parents={allParents} linked={parentIds} />
        </SidePanel>
      )}
      {editParent && (
        <SidePanel title={`Edit ${editParent.u.name}`} eyebrow={`Parent of ${c.firstName}`} closeHref={tabHref(tab)}>
          <form action={saveParent} className="grid gap-4">
            <input type="hidden" name="id" value={editParent.u.id} />
            <input type="hidden" name="childId" value={c.id} />
            <Field label="Full name"><input name="name" required defaultValue={editParent.u.name} className={inputCls} /></Field>
            <Field label={`Relationship to ${c.firstName}`}>
              <BrandField name="relationship" defaultValue={editParent.relationship ?? ""} ariaLabel="Relationship"
                options={[{ value: "", label: "Not set" }, ...["Mother", "Father", "Guardian", "Grandparent", "Other"].map((r) => ({ value: r, label: r }))]} />
            </Field>
            <Field label="Email" hint="Login + report emails"><input name="email" type="email" required defaultValue={editParent.u.email} className={inputCls} /></Field>
            <Field label="Phone (WhatsApp / SMS)"><input name="phone" defaultValue={editParent.u.phone ?? ""} placeholder="+1 555 0123" className={inputCls} /></Field>
            <Toggle name="whatsapp" checked={editParent.u.whatsappOptIn} label="Send WhatsApp notifications" hint="“Report is ready” messages on WhatsApp" />
            <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-xs leading-5 text-ink-2">
              Changes apply to this parent everywhere, including any brothers or sisters at the center.
            </p>
            <button className="btn btn-primary mt-1">Save parent</button>
          </form>
        </SidePanel>
      )}
      {viewReport && (
        <SidePanel title={fmtDate(viewReport.date)} eyebrow={`${c.firstName}'s daily report`} closeHref={`${base}?tab=reports&page=${page}`}>
          <ReportCard content={parseReport(viewReport.content)} date={viewReport.date} compact />
        </SidePanel>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ small pieces
function Stat({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="card p-5">
      <div className="text-[13px] font-semibold text-ink-2">{label}</div>
      <div className="mt-1 text-[32px] font-semibold leading-10">{value}</div>
      <div className="text-[12.5px] text-ink-3">{sub}</div>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-6">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-[20px] font-semibold">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-dashed divide-line text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[130px_1fr] gap-3 py-2.5">
          <dt className="text-ink-3">{k}</dt><dd className="min-w-0 font-semibold [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-surface-2/70 px-3 py-2.5 text-center">
      <div className="text-[20px] font-semibold leading-6">{value}</div>
      <div className="text-[11px] font-semibold text-ink-3">{label}</div>
    </div>
  );
}
