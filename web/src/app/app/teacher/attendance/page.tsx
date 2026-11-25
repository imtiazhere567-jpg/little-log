import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { pickTeacherRoom } from "@/lib/data";
import { ABSENT_REASONS, pickupOptions, roomAttendance, type AttStatus } from "@/lib/attendance";
import { fmtDate, fmtTime, nowTime, todayStr } from "@/lib/time";
import { Avatar } from "@/components/ui";
import { absentAction, checkInAction, checkOutAction, undoAction } from "../attendance-actions";

const GROUPS: { key: AttStatus; title: string; color: string }[] = [
  { key: "not_arrived", title: "Not arrived yet", color: "#9A9088" },
  { key: "here", title: "Here now", color: "#3E8E5A" },
  { key: "gone", title: "Picked up", color: "#2F6F62" },
  { key: "absent", title: "Absent", color: "#C98A1B" },
];

export default async function Attendance({ searchParams }: PageProps<"/app/teacher/attendance">) {
  const teacher = await requireUser("teacher", "/app/teacher/attendance");
  const sp = await searchParams;
  const { rooms, room } = await pickTeacherRoom(teacher.id, typeof sp.room === "string" ? sp.room : undefined);
  if (!room) return <p className="p-6">No room assigned.</p>;
  const today = todayStr();
  const list = await roomAttendance(room.id, today);
  const db = await getDb();
  const [center] = await db.select().from(s.centers).where(eq(s.centers.id, room.centerId));
  const base = `/app/teacher/attendance${rooms.length > 1 ? `?room=${room.id}` : ""}`;
  const withQ = (q: string) => `${base}${base.includes("?") ? "&" : "?"}${q}`;
  const count = (k: AttStatus) => list.filter((x) => x.status === k).length;

  // bottom sheets (server-rendered, opened with ?sheet=out-12 / absent-12)
  const [sheetKind, sheetId] = typeof sp.sheet === "string" ? sp.sheet.split("-") : [];
  const sheetRow = list.find((x) => String(x.child.id) === sheetId);
  const options = sheetKind === "out" && sheetRow ? await pickupOptions(sheetRow.child.id) : [];
  const [doneKind, doneId] = typeof sp.done === "string" ? sp.done.split("-") : [];
  const doneRow = list.find((x) => String(x.child.id) === doneId);

  return (
    <div className="px-[18px]">
      <Link href="/app/teacher" className="mt-1 inline-block text-sm font-bold text-primary">← Today</Link>
      <div className="eyebrow mt-2">{fmtDate(today)} · {room.name} Room</div>
      <h1 className="font-display mt-0.5 text-[30px] font-semibold leading-[35px]">Check in &amp; out</h1>
      <p className="mt-1 text-[13px] leading-5 text-ink-2">Tap when a child arrives and when they go home. Parents get a short app message each time.</p>

      {rooms.length > 1 && (
        <div className="mt-3 flex gap-1.5">
          {rooms.map((r) => (
            <Link key={r.id} href={`/app/teacher/attendance?room=${r.id}`} scroll={false}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${r.id === room.id ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-ink-2"}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />{r.name}
            </Link>
          ))}
        </div>
      )}

      {doneRow && (
        <div className="drop-in mt-3 flex items-center gap-2 rounded-2xl bg-success-soft px-3.5 py-2.5 text-[13px] font-semibold text-[#2C6B42]">
          <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-success text-white">✓</span>
          <span className="flex-1">{doneRow.child.firstName} {doneKind === "in" ? "checked in" : "checked out"}. The parents got an app message.</span>
          <Link href={base} scroll={false} aria-label="Dismiss" className="text-ink-3">✕</Link>
        </div>
      )}

      {/* summary */}
      <div className="card mt-4 p-4">
        <div className="flex items-baseline gap-2">
          <span className="font-display tabular text-[30px] font-semibold leading-8">{count("here")}</span>
          <span className="text-[14px] font-semibold text-ink-2">of {list.length} children here now</span>
        </div>
        <div className="mt-2.5 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-surface-2">
          {GROUPS.map((g) => count(g.key) > 0 && <span key={g.key} style={{ width: `${(count(g.key) / list.length) * 100}%`, background: g.color }} />)}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-semibold text-ink-2">
          {GROUPS.map((g) => <span key={g.key} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: g.color }} />{count(g.key)} {g.title.toLowerCase()}</span>)}
        </div>
        <p className="mt-2 text-[12px] text-ink-3">Center closes at {fmtTime(center.closesAt)}. Parents get a pickup reminder 30 minutes before.</p>
      </div>

      {GROUPS.map((g) => {
        const rows = list.filter((x) => x.status === g.key);
        if (!rows.length) return null;
        return (
          <section key={g.key} className="mt-5">
            <h2 className="eyebrow mb-2 flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: g.color }} />{g.title} · {rows.length}</h2>
            <div className="grid grid-cols-1 gap-2">
              {rows.map(({ child: c, att }) => (
                <div key={c.id} className="flex min-w-0 items-center gap-3 rounded-[20px] border border-line bg-surface px-3 py-2.5 shadow-[var(--shadow-1)]">
                  <Avatar first={c.firstName} last={c.lastName} bg={c.avatarBg} fg={c.avatarFg} size={42} />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[15px]">{c.firstName} {c.lastName}</b>
                    <span className="block truncate text-[12px] text-ink-3">
                      {g.key === "not_arrived" ? `Usually ${fmtTime(c.expectedIn)} – ${fmtTime(c.expectedOut)}`
                        : g.key === "here" ? `Here since ${fmtTime(att?.checkInAt)} · goes home ~${fmtTime(c.expectedOut)}`
                        : g.key === "gone" ? `${fmtTime(att?.checkInAt)} – ${fmtTime(att?.checkOutAt)} · ${att?.pickedUpBy ?? ""}`
                        : `Absent · ${att?.absentReason ?? "No reason"}`}
                    </span>
                    {g.key !== "not_arrived" && (
                      <form action={undoAction} className="inline">
                        <input type="hidden" name="childId" value={c.id} /><input type="hidden" name="back" value={base} />
                        <button className="text-[11.5px] font-bold text-ink-3 underline-offset-2 hover:text-primary hover:underline">↶ Undo</button>
                      </form>
                    )}
                  </div>
                  {g.key === "not_arrived" && (
                    <div className="flex flex-none flex-col items-end gap-1">
                      <form action={checkInAction}>
                        <input type="hidden" name="childId" value={c.id} /><input type="hidden" name="back" value={base} />
                        <button className="h-9 rounded-full bg-success px-4 text-[13px] font-bold text-white shadow-[0_4px_10px_rgba(62,142,90,.3)]">Check in</button>
                      </form>
                      <Link href={withQ(`sheet=absent-${c.id}`)} scroll={false} className="text-[11.5px] font-bold text-ink-3 hover:text-[#8A5E0F]">Mark absent</Link>
                    </div>
                  )}
                  {g.key === "here" && (
                    <Link href={withQ(`sheet=out-${c.id}`)} scroll={false}
                      className="flex h-9 flex-none items-center rounded-full bg-primary px-4 text-[13px] font-bold text-white shadow-[0_4px_10px_rgba(47,111,98,.3)]">Check out</Link>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* check-out sheet: who is picking up? */}
      {sheetKind === "out" && sheetRow && (
        <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label={`Check out ${sheetRow.child.firstName}`}>
          <Link href={base} scroll={false} aria-label="Close" className="absolute inset-0 bg-ink/35" />
          <form action={checkOutAction} className="drop-in relative max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] bg-surface px-5 pb-8 pt-3 shadow-[var(--shadow-3)]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
            <input type="hidden" name="childId" value={sheetRow.child.id} /><input type="hidden" name="back" value={base} />
            <h2 className="font-display text-[22px] font-semibold leading-7">Who is picking up {sheetRow.child.firstName}?</h2>
            <p className="mt-1 text-[13px] text-ink-2">Only people on this list may take {sheetRow.child.firstName} home. Check their ID if you don&apos;t know them.</p>
            <div className="mt-3 grid gap-2">
              {options.map((o, i) => (
                <label key={o.key} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line px-3.5 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft/60">
                  <input type="radio" name="pickup" value={o.key} defaultChecked={i === 0} required className="h-4 w-4 accent-[#2F6F62]" />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15px]">{o.name}</b>
                    <span className="text-[12px] text-ink-3">{o.relationship}{o.phone ? ` · ${o.phone}` : ""}</span>
                  </span>
                  {o.parent ? <span className="badge bg-primary-soft text-primary">Parent</span> : <span className="badge bg-surface-2 text-ink-2">Allowed</span>}
                </label>
              ))}
            </div>
            <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[12.5px] leading-[18px] text-danger">
              <b>Someone not on the list?</b> Don&apos;t release {sheetRow.child.firstName}. Call the director first.
            </p>
            <button className="btn btn-primary mt-4 w-full">Check out at {fmtTime(nowTime())}</button>
          </form>
        </div>
      )}

      {/* absent sheet */}
      {sheetKind === "absent" && sheetRow && (
        <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label={`Mark ${sheetRow.child.firstName} absent`}>
          <Link href={base} scroll={false} aria-label="Close" className="absolute inset-0 bg-ink/35" />
          <form action={absentAction} className="drop-in relative w-full rounded-t-[28px] bg-surface px-5 pb-8 pt-3 shadow-[var(--shadow-3)]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
            <input type="hidden" name="childId" value={sheetRow.child.id} /><input type="hidden" name="back" value={base} />
            <h2 className="font-display text-[22px] font-semibold leading-7">{sheetRow.child.firstName} is absent today</h2>
            <p className="mt-1 text-[13px] text-ink-2">Why? The parents get a short message so they can call if it&apos;s a mistake.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ABSENT_REASONS.map((r, i) => (
                <label key={r} className="cursor-pointer rounded-full border border-line px-4 py-2 text-[14px] font-semibold has-[:checked]:border-[#C98A1B] has-[:checked]:bg-warning-soft has-[:checked]:text-[#8A5E0F]">
                  <input type="radio" name="reason" value={r} defaultChecked={i === 0} className="sr-only" />{r}
                </label>
              ))}
            </div>
            <button className="btn mt-5 w-full bg-warning text-white">Mark absent</button>
          </form>
        </div>
      )}
    </div>
  );
}
