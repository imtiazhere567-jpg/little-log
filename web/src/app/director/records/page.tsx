import Link from "next/link";
import DateField from "@/components/DateField";
import { BrandField } from "@/components/BrandPicker";
import { asc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { childRecords } from "@/lib/records";
import { addDays, fmtDate, fmtShort, fmtTime, todayStr } from "@/lib/time";
import { Badge, TypeIcon, TYPE_STYLE } from "@/components/ui";
import { PageHead } from "../ui";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function Records({ searchParams }: PageProps<"/director/records">) {
  const director = await requireUser("director");
  const sp = await searchParams;
  const today = todayStr();
  const from = typeof sp.from === "string" && ISO.test(sp.from) ? sp.from : addDays(today, -30);
  const to = typeof sp.to === "string" && ISO.test(sp.to) ? sp.to : today;
  const childId = Number(sp.child) || 0;
  const db = await getDb();
  const kids = await db.select({ child: s.children, room: s.rooms }).from(s.children)
    .innerJoin(s.rooms, eq(s.rooms.id, s.children.roomId))
    .where(eq(s.rooms.centerId, director.centerId)).orderBy(asc(s.rooms.id), asc(s.children.firstName));
  const rec = childId ? await childRecords(childId, from, to, director.centerId) : null;
  const qs = `child=${childId}&from=${from}&to=${to}`;
  const days = rec ? [...new Set(rec.entries.map((e) => e.date))].sort().reverse() : [];

  return (
    <div className="w-full max-w-[1760px]">
      <PageHead title="Records & export" sub="Search everything recorded for a child and export it for state licensing inspections." />

      <form className="card mt-5 grid items-end gap-3 p-5 md:grid-cols-[2fr_1fr_1fr_auto]">
        <label className="grid gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Child</span>
          <BrandField name="child" defaultValue={childId ? String(childId) : ""} ariaLabel="Child"
            options={[{ value: "", label: "Choose a child…" }, ...kids.map(({ child: c, room }) => ({ value: String(c.id), label: `${c.firstName} ${c.lastName} · ${room.name}` }))]} />
        </label>
        <div className="grid gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">From</span>
          <DateField key={`f${from}`} name="from" value={from} max={today} ariaLabel="From date" />
        </div>
        <div className="grid gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">To</span>
          <DateField key={`t${to}`} name="to" value={to} max={today} ariaLabel="To date" />
        </div>
        <button className="btn btn-primary">Search</button>
      </form>

      {!rec && (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-10 text-center text-ink-3">
          Choose a child and a date range. The last 30 days are selected by default.
        </div>
      )}

      {rec && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-[26px] font-semibold">{rec.child.firstName} {rec.child.lastName}</h2>
              <p className="text-sm text-ink-2">{rec.room.name} Room · {fmtDate(from, { weekday: false, year: true })} – {fmtDate(to, { weekday: false, year: true })}</p>
            </div>
            <div className="flex gap-2">
              <a href={`/director/records/export?${qs}&format=pdf`} className="btn btn-primary">⬇ Export PDF</a>
              <a href={`/director/records/export?${qs}&format=csv`} className="btn btn-secondary">⬇ Export CSV</a>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            {[["Log entries", rec.entries.length], ["Daily reports sent", rec.reports.filter((r) => r.status === "sent").length], ["Incidents", rec.incidents.length]].map(([l, n]) => (
              <div key={l} className="card p-5">
                <div className="eyebrow">{l}</div>
                <div className="font-display tabular mt-1 text-[36px] font-semibold leading-10">{n}</div>
              </div>
            ))}
          </div>

          {rec.incidents.length > 0 && (
            <section className="mt-6">
              <h3 className="font-display mb-2 text-xl font-semibold">Incidents</h3>
              <div className="card divide-y divide-line">
                {rec.incidents.map((i) => (
                  <Link key={i.id} href={`/director/incidents/${i.id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-surface-2/40">
                    <span><b>{fmtDate(i.date)} · {fmtTime(i.time)}</b> · {i.injury} ({i.bodyPart}) · {i.location}</span>
                    <Badge status={i.status === "draft" ? "awaiting" : i.status} />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="mt-6">
            <h3 className="font-display mb-2 text-xl font-semibold">Daily logs</h3>
            <div className="grid gap-3">
              {days.map((d) => {
                const rep = rec.reports.find((r) => r.date === d);
                return (
                  <div key={d} className="card overflow-hidden">
                    <div className="flex items-center justify-between bg-surface-2 px-5 py-2.5 text-sm">
                      <b>{fmtDate(d, { year: true })}</b>
                      <span className="text-ink-3">{rep?.sentAt ? `Report sent ${fmtTime(rep.sentAt.slice(11))} by ${rec.nameOf(rep.approvedBy)}` : "No report sent"}</span>
                    </div>
                    <div className="grid gap-x-6 px-5 py-2 md:grid-cols-2 2xl:grid-cols-3">
                      {rec.entries.filter((e) => e.date === d).map((e) => (
                        <div key={e.id} className="flex items-center gap-3 py-1.5 text-sm">
                          <TypeIcon type={e.type} size={26} />
                          <span className="tabular w-11 text-ink-3">{fmtShort(e.time)}</span>
                          <span className={`w-16 text-xs font-bold ${TYPE_STYLE[e.type].fg}`}>{e.label ?? TYPE_STYLE[e.type].label}</span>
                          <span className="min-w-0 flex-1 truncate">{e.type === "nap" && e.endTime ? `${fmtShort(e.time)} – ${fmtShort(e.endTime)}` : e.details}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {days.length === 0 && <p className="card p-6 text-center text-sm text-ink-3">No log entries in this range.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
