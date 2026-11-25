import Link from "next/link";
import DateField from "@/components/DateField";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { parseReport, roomDay, type ChildStatus } from "@/lib/data";
import { fmtDate, fmtStamp, fmtTime, prevSchoolDay, addDays, todayStr, weekday } from "@/lib/time";
import { Avatar, STATUS } from "@/components/ui";
import { SegmentBar } from "@/components/charts";
import ReportCard from "@/components/ReportCard";
import { PageHead, SidePanel } from "../ui";
import { Pagination } from "../Modal";

const STATUSES: { key: "all" | ChildStatus; label: string; color?: string }[] = [
  { key: "all", label: "All" },
  { key: "sent", label: "Sent", color: "#2F6F62" },
  { key: "ready", label: "Ready", color: "#3E8E5A" },
  { key: "review", label: "Review", color: "#C98A1B" },
  { key: "few", label: "Few notes", color: "#D9CFBF" },
];
const PAGE = 12;

// A report's journey: teachers collect notes → it's ready (or blocked by an unclear name) → sent → a parent opens it.
const STEPS = ["Notes", "Ready", "Sent", "Opened"];
function StageTrack({ status, entries, opened }: { status: ChildStatus; entries: number; opened: boolean }) {
  const at = status === "sent" ? (opened ? 3 : 2) : status === "few" ? 0 : 1;
  const blocked = status === "review";
  const label = blocked ? "Needs review: unclear name" : status === "few" ? `Collecting notes (${entries} of 3)` : status === "ready" ? "Ready: waiting for the teacher to send"
    : opened ? "Opened by a parent" : "Sent: not opened yet";
  return (
    <div className="min-w-[230px]">
      <div className="flex items-center" aria-hidden>
        {STEPS.map((st, i) => {
          const here = i === at;
          const check = i < at || (here && !blocked && status !== "few");
          const color = here && blocked ? "#C98A1B" : i > at ? "#E7DFD2" : i >= 2 ? "#2F6F62" : i === 1 ? "#3E8E5A" : "#9A9088";
          return (
            <span key={st} className="flex flex-1 items-center last:flex-none">
              <span className={`grid h-[18px] w-[18px] flex-none place-items-center rounded-full text-[10px] font-black text-white ${here ? "ring-4" : ""}`}
                style={{ background: color, ["--tw-ring-color" as string]: `${color}33` }}>
                {here && blocked ? "?" : check ? "✓" : here ? "•" : ""}
              </span>
              {i < STEPS.length - 1 && <span className="mx-0.5 h-[3px] flex-1 rounded-full" style={{ background: i < at ? "#B9D3CB" : "#EFE8DD" }} />}
            </span>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-wider text-ink-3">{STEPS.map((st) => <span key={st}>{st}</span>)}</div>
      <div className={`mt-0.5 text-[12px] font-semibold ${blocked ? "text-[#8A5E0F]" : "text-ink-2"}`}>{label}</div>
    </div>
  );
}

export default async function DailyReports({ searchParams }: PageProps<"/director/reports">) {
  const director = await requireUser("director");
  const sp = await searchParams;
  const today = todayStr();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const status = STATUSES.find((x) => x.key === sp.status)?.key ?? "all";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const db = await getDb();
  const rooms = await db.select().from(s.rooms).where(eq(s.rooms.centerId, director.centerId)).orderBy(asc(s.rooms.id));
  const roomId = rooms.some((r) => String(r.id) === sp.room) ? Number(sp.room) : null;
  const days = await Promise.all(rooms.map(async (r) => ({ room: r, day: await roomDay(r.id, date) })));
  const all = days.flatMap(({ room, day }) => day.children.map((c) => ({ ...c, room })));
  const scoped = all.filter((c) => !roomId || c.room.id === roomId);
  const rows = scoped.filter((c) => (status === "all" || c.status === status) && (!q || `${c.child.firstName} ${c.child.lastName}`.toLowerCase().includes(q)));
  const sentCount = all.filter((c) => c.status === "sent").length;
  const view = all.find((c) => String(c.child.id) === sp.view && c.report);
  // who opened each sent report (any app counts as opened)
  const reportIds = all.flatMap((c) => (c.report?.status === "sent" ? [c.report.id] : []));
  const reads = reportIds.length ? await db.select({ recordId: s.notifications.recordId, readAt: s.notifications.readAt, name: s.users.name })
    .from(s.notifications).innerJoin(s.users, eq(s.users.id, s.notifications.parentId))
    .where(and(eq(s.notifications.kind, "daily_report"), inArray(s.notifications.recordId, reportIds), isNotNull(s.notifications.readAt))) : [];
  const openedBy = (id?: number) => {
    const mine = reads.filter((r) => r.recordId === id).sort((a, b) => +a.readAt! - +b.readAt!);
    return mine.length ? { names: [...new Set(mine.map((r) => r.name.split(" ")[0]))], at: mine[0].readAt! } : null;
  };
  const openedCount = reportIds.filter((id) => openedBy(id)).length;

  let next = addDays(date, 1);
  while ([0, 6].includes(weekday(next))) next = addDays(next, 1);
  const href = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | null> = { date: date === today ? null : date, room: roomId ? String(roomId) : null, status: status === "all" ? null : status, q: q || null, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/director/reports${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="w-full max-w-[1760px]">
      <PageHead title="Daily reports" sub={`${fmtDate(date)} · ${sentCount} of ${all.length} reports sent · ${openedCount} opened by parents`} />

      {/* date navigation */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href={href({ date: prevSchoolDay(date), page: null })} className="btn btn-sm btn-secondary">← Previous day</Link>
        <form className="flex items-center gap-2">
          {roomId && <input type="hidden" name="room" value={roomId} />}
          <DateField key={date} name="date" value={date} max={today} autoSubmit className="w-[200px]" ariaLabel="Pick a day" />
        </form>
        {date < today && <Link href={href({ date: next > today ? null : next, page: null })} className="btn btn-sm btn-secondary">Next day →</Link>}
        {date !== today && <Link href={href({ date: null, page: null })} className="btn btn-sm btn-ghost">Today</Link>}
      </div>

      {/* room summary cards (click to filter) */}
      <div className="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {days.map(({ room, day }) => {
          const on = roomId === room.id;
          const count = (k: ChildStatus) => day.children.filter((c) => c.status === k).length;
          return (
            <Link key={room.id} href={href({ room: on ? null : String(room.id), page: null })}
              className={`card block p-4 transition hover:shadow-[var(--shadow-2)] ${on ? "ring-2 ring-primary" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-bold"><span className="h-3 w-3 rounded-full" style={{ background: room.color }} />{room.name}</span>
                <span className="tabular text-sm"><b>{count("sent")}</b><span className="text-ink-3">/{day.children.length} sent</span></span>
              </div>
              <div className="mt-3"><SegmentBar parts={STATUSES.slice(1).map((x) => ({ label: x.label, value: count(x.key as ChildStatus), color: x.color! }))} /></div>
              <div className="mt-2 text-xs text-ink-3">{on ? "Showing this room · click to clear" : `${count("ready")} ready · ${count("review")} review · ${count("few")} few notes`}</div>
            </Link>
          );
        })}
      </div>

      {/* filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {STATUSES.map((x) => (
          <Link key={x.key} href={href({ status: x.key === "all" ? null : x.key, page: null })}
            className={`flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold ${status === x.key ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"}`}>
            {x.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />}
            {x.label} <span className="opacity-60">{x.key === "all" ? scoped.length : scoped.filter((c) => c.status === x.key).length}</span>
          </Link>
        ))}
        <form className="ml-auto">
          {date !== today && <input type="hidden" name="date" value={date} />}
          {roomId && <input type="hidden" name="room" value={roomId} />}
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="Search a child…" className="h-10 w-64 rounded-full border border-line bg-surface px-4 text-sm" />
        </form>
      </div>

      {/* paginated table */}
      <div className="card mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wider text-ink-3">
            <tr><th className="px-5 py-3">Child</th><th>Room</th><th>Entries</th><th className="py-3">Stage</th><th>Details</th><th className="px-5" /></tr>
          </thead>
          <tbody>
            {rows.slice((page - 1) * PAGE, page * PAGE).map(({ child: c, room, status: st, report, entries }) => (
              <tr key={c.id} className="border-t border-line hover:bg-surface-2/40">
                <td className="px-5 py-2.5">
                  <Link href={`/director/children/${c.id}`} className="flex items-center gap-3 hover:underline">
                    <Avatar first={c.firstName} last={c.lastName} bg={c.avatarBg} fg={c.avatarFg} size={32} dot={STATUS[st].dot} />
                    <b>{c.firstName} {c.lastName}</b>
                  </Link>
                </td>
                <td><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: room.color }} />{room.name}</span></td>
                <td className="tabular">{entries.length}</td>
                <td className="py-2.5 pr-4"><StageTrack status={st} entries={entries.length} opened={!!openedBy(report?.id)} /></td>
                <td className="text-[13px] text-ink-2">
                  {(() => {
                    const o = openedBy(report?.id);
                    if (report?.sentAt) return <>Sent {fmtTime(report.sentAt.slice(11))}{o ? <><br /><span className="font-semibold text-primary">✓ {o.names.join(" & ")} · {fmtStamp(o.at, { date: false })}</span></> : <><br /><span className="text-ink-3">Not opened yet</span></>}</>;
                    return st === "review" ? "Teacher must say which child an unclear note is about" : st === "few" ? "Waiting for more notes" : "Ready: the teacher can send it now";
                  })()}
                </td>
                <td className="px-5 text-right">
                  {report?.status === "sent"
                    ? <Link href={href({ view: String(c.id), page: String(page) })} scroll={false} className="font-bold text-primary">Read →</Link>
                    : <span className="text-ink-3">–</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-ink-3">No children match these filters.</td></tr>}
          </tbody>
        </table>
        {rows.length > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination page={page} pageSize={PAGE} total={rows.length} hrefFor={(n) => href({ page: String(n) })} />
          </div>
        )}
      </div>

      {view?.report && (
        <SidePanel title={`${view.child.firstName} ${view.child.lastName}`} eyebrow="Daily report as sent to parents" closeHref={href({ page: String(page) })}>
          <ReportCard content={parseReport(view.report.content)} date={date} compact />
        </SidePanel>
      )}
    </div>
  );
}
