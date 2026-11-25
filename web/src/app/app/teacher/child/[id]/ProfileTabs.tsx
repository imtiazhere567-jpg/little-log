import Link from "next/link";
import type { ReactNode } from "react";
import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { parseReport, type Child } from "@/lib/data";
import { ageLabel, fmtDate, fmtShort, fmtTime, prevSchoolDay, todayStr } from "@/lib/time";
import { Badge, TypeIcon, WarnIcon } from "@/components/ui";
import ReportCard from "@/components/ReportCard";

const base = (id: number) => `/app/teacher/child/${id}`;

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="card mt-4 p-4">
      <div className="mb-2 flex items-center justify-between"><h2 className="eyebrow">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

function Pager({ page, more, href }: { page: number; more: boolean; href: (p: number) => string }) {
  if (page === 1 && !more) return null;
  return (
    <div className="mt-4 flex items-center justify-between">
      {page > 1 ? <Link href={href(page - 1)} scroll={false} className="btn btn-sm btn-secondary">‹ Newer</Link> : <span />}
      <span className="text-[12.5px] text-ink-3">Page {page}</span>
      {more ? <Link href={href(page + 1)} scroll={false} className="btn btn-sm btn-secondary">Older ›</Link> : <span />}
    </div>
  );
}

// ------------------------------------------------------------------ History: day by day
export async function HistoryTab({ child, page }: { child: Child; page: number }) {
  const db = await getDb();
  const DAYS = 7;
  // school days before today, newest first
  const days: string[] = [];
  let d = todayStr();
  for (let i = 0; i < page * DAYS + 1; i++) { d = prevSchoolDay(d); days.push(d); }
  const shown = days.slice((page - 1) * DAYS, page * DAYS);
  const [entries, reports] = await Promise.all([
    db.select().from(s.logEntries).where(and(eq(s.logEntries.childId, child.id), inArray(s.logEntries.date, shown))).orderBy(asc(s.logEntries.time)),
    db.select().from(s.dailyReports).where(and(eq(s.dailyReports.childId, child.id), inArray(s.dailyReports.date, shown))),
  ]);
  const older = (await db.select({ id: s.logEntries.id }).from(s.logEntries)
    .where(and(eq(s.logEntries.childId, child.id), lt(s.logEntries.date, shown.at(-1)!))).limit(1)).length > 0;

  return (
    <div>
      <p className="mt-4 text-[13px] text-ink-2">What {child.firstName}&apos;s days looked like. Useful for spotting patterns, like eating less this week.</p>
      {shown.map((day) => {
        const es = entries.filter((e) => e.date === day);
        const rep = reports.find((r) => r.date === day);
        const meals = es.filter((e) => e.type === "meal");
        const nap = es.find((e) => e.type === "nap" && e.endTime);
        return (
          <section key={day} className="card mt-3 overflow-hidden">
            <div className="flex items-center justify-between bg-surface-2/70 px-4 py-2.5">
              <b className="text-[14px]">{fmtDate(day)}</b>
              {rep?.status === "sent"
                ? <Link href={`${base(child.id)}?tab=reports&report=${rep.id}`} scroll={false} className="badge bg-primary-soft text-primary">Report sent ›</Link>
                : es.length ? <span className="badge bg-surface text-ink-3">No report</span> : <span className="badge bg-surface text-ink-3">Absent</span>}
            </div>
            {es.length > 0 ? (
              <div className="px-4 py-2">
                <div className="mb-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-2">
                  <span>🍎 {meals.length} {meals.length === 1 ? "meal" : "meals"}</span>
                  {nap && <span>🌙 slept {fmtShort(nap.time)}–{fmtShort(nap.endTime)}</span>}
                  <span>💧 {es.filter((e) => e.type === "diaper").length}</span>
                </div>
                {es.map((e) => (
                  <div key={e.id} className="flex items-center gap-2.5 border-b border-dashed border-line py-1.5 text-[13.5px] last:border-0">
                    <TypeIcon type={e.type} size={24} />
                    <span className="min-w-0 flex-1 truncate">{e.label ? `${e.label}: ` : ""}{e.type === "nap" && e.endTime ? `${fmtShort(e.time)} – ${fmtShort(e.endTime)}` : e.details}</span>
                    <span className="tabular text-[12px] text-ink-3">{fmtShort(e.time)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="px-4 py-3 text-[13px] text-ink-3">No entries this day.</p>}
          </section>
        );
      })}
      <Pager page={page} more={older} href={(p) => `${base(child.id)}?tab=history&page=${p}`} />
    </div>
  );
}

// ------------------------------------------------------------------ Reports: sent + opened?
export async function ReportsTab({ child, page, open }: { child: Child; page: number; open?: string }) {
  const db = await getDb();
  const PAGE = 8;
  const all = await db.select().from(s.dailyReports)
    .where(and(eq(s.dailyReports.childId, child.id), eq(s.dailyReports.status, "sent"))).orderBy(desc(s.dailyReports.date));
  const rows = all.slice((page - 1) * PAGE, page * PAGE);
  const notes = rows.length ? await db.select({ n: s.notifications, u: s.users }).from(s.notifications)
    .innerJoin(s.users, eq(s.users.id, s.notifications.parentId))
    .where(and(eq(s.notifications.kind, "daily_report"), inArray(s.notifications.recordId, rows.map((r) => r.id)))) : [];
  const viewing = all.find((r) => String(r.id) === open);

  return (
    <div>
      <p className="mt-4 text-[13px] text-ink-2">{all.length} reports sent. “Opened” means a parent read the message or the report.</p>
      <div className="card mt-3 divide-y divide-line">
        {rows.map((r) => {
          const readers = [...new Set(notes.filter(({ n }) => n.recordId === r.id && n.readAt).map(({ u }) => u.name.split(" ")[0]))];
          return (
            <Link key={r.id} href={`${base(child.id)}?tab=reports&page=${page}&report=${r.id}`} scroll={false} className="flex items-center gap-3 px-4 py-3 active:bg-surface-2">
              <span className="min-w-0 flex-1">
                <b className="block text-[14px]">{fmtDate(r.date)}</b>
                <span className="block truncate text-[12.5px] text-ink-2">{parseReport(r.content).greeting}</span>
              </span>
              <span className="grid justify-items-end gap-1">
                <span className="tabular text-[11.5px] text-ink-3">{r.sentAt ? fmtTime(r.sentAt.slice(11)) : ""}</span>
                {readers.length
                  ? <span className="badge bg-success-soft text-[#2C6B42]">✓ {readers.join(" & ")}</span>
                  : <span className="badge bg-surface-2 text-ink-3">Not opened</span>}
              </span>
            </Link>
          );
        })}
        {all.length === 0 && <p className="p-5 text-center text-sm text-ink-3">No reports sent yet.</p>}
      </div>
      <Pager page={page} more={all.length > page * PAGE} href={(p) => `${base(child.id)}?tab=reports&page=${p}`} />

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label="Report">
          <Link href={`${base(child.id)}?tab=reports&page=${page}`} scroll={false} aria-label="Close" className="absolute inset-0 bg-ink/35" />
          <div className="drop-in relative max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] bg-bg px-4 pb-8 pt-3">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow">As the parents saw it</span>
              <Link href={`${base(child.id)}?tab=reports&page=${page}`} scroll={false} className="text-sm font-bold text-primary">Close</Link>
            </div>
            <ReportCard content={parseReport(viewing.content)} date={viewing.date} compact />
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ About: profile, parents, incidents
export async function AboutTab({ child, roomName, teachers }: { child: Child; roomName: string; teachers: string[] }) {
  const db = await getDb();
  const today = todayStr();
  const [parents, incidents] = await Promise.all([
    db.select({ u: s.users, relationship: s.childParents.relationship }).from(s.childParents)
      .innerJoin(s.users, eq(s.users.id, s.childParents.parentId)).where(eq(s.childParents.childId, child.id)).orderBy(asc(s.users.id)),
    db.select().from(s.incidents).where(eq(s.incidents.childId, child.id)).orderBy(desc(s.incidents.date), desc(s.incidents.time)),
  ]);
  const rows: [string, ReactNode][] = [
    ["Age", `${ageLabel(child.dateOfBirth, today)} · born ${fmtDate(child.dateOfBirth, { weekday: false, year: true })}`],
    ["Room", `${roomName} Room`],
    ["Teachers", teachers.join(", ")],
    ["With us since", child.enrolledOn ? fmtDate(child.enrolledOn, { weekday: false, year: true }) : "–"],
    ["Photos", child.photoConsent ? "📷 Allowed (consent signed)" : "🚫 Not allowed: no photos"],
  ];

  return (
    <div>
      <section className={`mt-4 rounded-[20px] border-l-4 p-4 ${child.medicalNotes ? "border-danger bg-danger-soft" : "border-success bg-success-soft/60"}`}>
        <div className={`text-[11px] font-bold uppercase tracking-wider ${child.medicalNotes ? "text-danger" : "text-[#2C6B42]"}`}>Allergies & medical</div>
        <p className="mt-1 text-[14.5px] font-semibold leading-[21px]">{child.medicalNotes ?? "None recorded"}</p>
      </section>

      <Section title="About">
        <dl className="divide-y divide-dashed divide-line text-[14px]">
          {rows.map(([k, v]) => <div key={k} className="grid grid-cols-[110px_1fr] gap-2 py-2.5"><dt className="text-ink-3">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
        </dl>
      </Section>

      <Section title="Parents & guardians">
        <div className="grid gap-2.5">
          {parents.map(({ u, relationship }, i) => (
            <div key={u.id} className="rounded-2xl bg-surface-2/70 p-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-[13px] font-bold text-white">{u.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[15px]">{u.name}</b>
                  <span className="text-[12.5px] text-ink-3">{relationship ?? "Parent"}{i === 0 ? " · primary contact" : ""}</span>
                </span>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {u.phone && <a href={`tel:${u.phone}`} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary text-[13px] font-bold text-white">📞 Call</a>}
                <a href={`mailto:${u.email}`} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface text-[13px] font-bold">✉ Email</a>
              </div>
              <p className="mt-2 text-[12px] text-ink-3">{u.phone ?? "No phone"} · {u.email}{u.whatsappOptIn ? " · WhatsApp ✓" : ""}</p>
            </div>
          ))}
          {parents.length === 0 && <p className="text-sm text-danger">No parent on file. Tell the director.</p>}
        </div>
        {parents.length > 0 && (
          <Link href={`/app/teacher/chat/${child.id}`} className="btn btn-sm btn-primary mt-3 w-full">💬 Message {child.firstName}&apos;s parents</Link>
        )}
        <p className="mt-2 text-[11.5px] text-ink-3">To change parent details, ask the director.</p>
      </Section>

      <Section title={`Incidents (${incidents.length})`}>
        {incidents.map((inc) => (
          <div key={inc.id} className="flex items-start gap-2.5 border-b border-dashed border-line py-2.5 last:border-0">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-danger-soft"><WarnIcon size={15} color="#C8412E" /></span>
            <span className="min-w-0 flex-1 text-[13.5px] leading-5">
              <b>{inc.injury}</b> · {inc.location}
              <span className="block text-[12px] text-ink-3">{fmtDate(inc.date, { weekday: false })}, {fmtTime(inc.time)}{inc.status === "approved" ? (inc.parentAckAt ? ` · parent read it ${fmtDate(inc.parentAckAt.slice(0, 10), { weekday: false })}` : " · parent hasn't read it yet") : ""}</span>
            </span>
            <Badge status={inc.status === "draft" ? "awaiting" : inc.status} />
          </div>
        ))}
        {incidents.length === 0 && <p className="text-[13px] text-ink-3">No incidents. 🌿</p>}
      </Section>
      <p className="mt-3 text-center text-[11.5px] text-ink-3">Only teachers of the {roomName} Room and the director can see this.</p>
    </div>
  );
}
