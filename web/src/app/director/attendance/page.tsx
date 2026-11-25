import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { roomAttendance, type AttStatus } from "@/lib/attendance";
import { fmtDate, fmtTime, minutesBetween, nowTime, prevSchoolDay, todayStr } from "@/lib/time";
import { Avatar } from "@/components/ui";
import BrandSelect from "@/components/BrandSelect";
import DateField from "@/components/DateField";
import { PageHead } from "../ui";
import { Pagination } from "../Modal";

const PAGE = 12;

const STATUS: Record<AttStatus, { label: string; cls: string; color: string }> = {
  here: { label: "Here", cls: "bg-success-soft text-[#2C6B42]", color: "#3E8E5A" },
  gone: { label: "Picked up", cls: "bg-primary-soft text-primary", color: "#2F6F62" },
  not_arrived: { label: "Not arrived", cls: "bg-surface-2 text-ink-2", color: "#C9BFB0" },
  absent: { label: "Absent", cls: "bg-warning-soft text-[#8A5E0F]", color: "#C98A1B" },
};

export default async function AttendancePage({ searchParams }: PageProps<"/director/attendance">) {
  const director = await requireUser("director", "/director/attendance");
  const sp = await searchParams;
  const today = todayStr();
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;
  const db = await getDb();
  const [center] = await db.select().from(s.centers).where(eq(s.centers.id, director.centerId));
  const rooms = await db.select().from(s.rooms).where(eq(s.rooms.centerId, director.centerId)).orderBy(asc(s.rooms.id));
  const roomId = rooms.some((r) => String(r.id) === sp.room) ? Number(sp.room) : null;
  const show = (["all", "here", "gone", "not_arrived", "absent", "late"] as const).find((k) => k === sp.show) ?? "all";
  const all = (await Promise.all(rooms.map(async (room) => (await roomAttendance(room.id, date)).map((x) => ({ ...x, room }))))).flat();
  const scoped = all.filter((x) => !roomId || x.room.id === roomId);
  const isToday = date === today;
  const now = nowTime();
  // flags worth a director's attention
  const lateArrival = (x: (typeof all)[number]) => !!x.att?.checkInAt && minutesBetween(x.child.expectedIn, x.att.checkInAt) >= 30;
  const latePickup = (x: (typeof all)[number]) => (!!x.att?.checkOutAt && x.att.checkOutAt > center.closesAt) || (isToday && x.status === "here" && now > center.closesAt);
  const rows = scoped.filter((x) => show === "all" || (show === "late" ? latePickup(x) || lateArrival(x) : x.status === show));
  const count = (k: AttStatus) => scoped.filter((x) => x.status === k).length;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));

  const href = (extra: Record<string, string | number | null>) => {
    const p = new URLSearchParams();
    const merged = { date: isToday ? null : date, room: roomId, show: show === "all" ? null : show, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `/director/attendance${p.toString() ? `?${p}` : ""}`;
  };
  const tiles: { key: typeof show; label: string; value: number; sub: string }[] = [
    { key: "here", label: isToday ? "Here now" : "Came in", value: isToday ? count("here") : count("here") + count("gone"), sub: `of ${scoped.length} children` },
    { key: "gone", label: "Picked up", value: count("gone"), sub: "checked out" },
    { key: "not_arrived", label: isToday ? "Not arrived yet" : "No record", value: count("not_arrived"), sub: isToday ? "parents get a reminder" : "not checked in" },
    { key: "absent", label: "Absent", value: count("absent"), sub: "sick, vacation…" },
    { key: "late", label: "Late", value: scoped.filter((x) => latePickup(x) || lateArrival(x)).length, sub: `arrived 30+ min late or picked up after ${fmtTime(center.closesAt)}` },
  ];

  return (
    <div className="w-full max-w-[1760px]">
      <PageHead title="Attendance" sub={`${fmtDate(date)} · check-in and check-out times, and who picked each child up. Kept for licensing.`} />

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <Link href={href({ date: prevSchoolDay(date) })} className="btn btn-sm btn-secondary">← Previous day</Link>
        <form>
          {roomId && <input type="hidden" name="room" value={roomId} />}
          <DateField key={date} name="date" value={date} max={today} autoSubmit className="w-[200px]" ariaLabel="Pick a day" />
        </form>
        {!isToday && <Link href={href({ date: null })} className="btn btn-sm btn-ghost">Today</Link>}
        <BrandSelect label="Room" value={roomId ? String(roomId) : "all"} width={240}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1H4a1 1 0 01-1-1z" /></svg>}
          options={[{ key: "all", label: "All rooms", href: href({ room: null }) }, ...rooms.map((r) => ({ key: String(r.id), label: `${r.name} Room`, color: r.color, hint: r.ageGroup, href: href({ room: r.id }) }))]} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {tiles.map((t) => (
          <Link key={t.key} href={href({ show: show === t.key ? null : t.key })} scroll={false}
            className={`card p-4 transition hover:shadow-[var(--shadow-2)] ${show === t.key ? "ring-2 ring-primary" : ""}`}>
            <span className="text-[13px] font-semibold text-ink-2">{t.label}</span>
            <span className={`mt-1 block text-[30px] font-semibold leading-9 ${t.key === "late" && t.value ? "text-danger" : ""}`}>{t.value}</span>
            <span className="text-xs text-ink-3">{t.sub}</span>
          </Link>
        ))}
      </div>

      <div className="card mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wider text-ink-3">
            <tr><th className="px-5 py-3">Child</th><th>Room</th><th>Status</th><th>In</th><th>Out</th><th>Picked up by</th><th className="px-5">Usual hours</th></tr>
          </thead>
          <tbody>
            {rows.slice((page - 1) * PAGE, page * PAGE).map((x) => {
              const st = STATUS[x.status];
              return (
                <tr key={x.child.id} className="border-t border-line hover:bg-surface-2/40">
                  <td className="px-5 py-2.5">
                    <Link href={`/director/children/${x.child.id}`} className="flex items-center gap-3 hover:underline">
                      <Avatar first={x.child.firstName} last={x.child.lastName} bg={x.child.avatarBg} fg={x.child.avatarFg} size={32} />
                      <b>{x.child.firstName} {x.child.lastName}</b>
                    </Link>
                  </td>
                  <td><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: x.room.color }} />{x.room.name}</span></td>
                  <td><span className={`badge ${st.cls}`}>{st.label}{x.status === "absent" && x.att?.absentReason ? ` · ${x.att.absentReason}` : ""}</span></td>
                  <td className="tabular">{x.att?.checkInAt ? <span className={lateArrival(x) ? "font-bold text-[#8A5E0F]" : ""}>{fmtTime(x.att.checkInAt)}{lateArrival(x) ? " · late" : ""}</span> : <span className="text-ink-3">–</span>}</td>
                  <td className="tabular">{x.att?.checkOutAt ? <span className={latePickup(x) ? "font-bold text-danger" : ""}>{fmtTime(x.att.checkOutAt)}{latePickup(x) ? " · late" : ""}</span>
                    : latePickup(x) ? <span className="font-bold text-danger">Still here after closing</span> : <span className="text-ink-3">–</span>}</td>
                  <td className="text-ink-2">{x.att?.pickedUpBy ?? <span className="text-ink-3">–</span>}</td>
                  <td className="tabular px-5 text-ink-3">{fmtTime(x.child.expectedIn)} – {fmtTime(x.child.expectedOut)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-ink-3">No children match.</td></tr>}
          </tbody>
        </table>
        {rows.length > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination page={page} pageSize={PAGE} total={rows.length} hrefFor={(n) => href({ page: n === 1 ? null : n })} />
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-ink-3">Teachers check children in and out on the phone app. Parents can mark a child absent before drop-off.</p>
    </div>
  );
}
