import Link from "next/link";
import { requireUser } from "@/lib/session";
import { pickTeacherRoom, roomDay, type ChildStatus } from "@/lib/data";
import { fmtShort, fmtDate, fmtTime, greetingFor, minutesBetween, nowTime, todayStr, ageLabel, isNew } from "@/lib/time";
import { getDb, schema as s } from "@/db";
import { eq } from "drizzle-orm";
import { Avatar, Badge, EntryRow, STATUS, TypeIcon, WarnIcon } from "@/components/ui";
import { resolveReview, skipReview } from "./actions";
import { roomAttendance } from "@/lib/attendance";

const FILTERS: { key: string; label: string; match: (s: ChildStatus) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "review", label: "Needs review", match: (s) => s === "review" },
  { key: "few", label: "Few notes", match: (s) => s === "few" },
  { key: "ready", label: "Ready", match: (s) => s === "ready" },
  { key: "sent", label: "Sent", match: (s) => s === "sent" },
];

export default async function TeacherToday({ searchParams }: PageProps<"/app/teacher">) {
  const teacher = await requireUser("teacher");
  const sp = await searchParams;
  const roomParam = typeof sp.room === "string" ? sp.room : undefined;
  const filter = typeof sp.filter === "string" ? sp.filter : "all";
  const open = typeof sp.open === "string" ? sp.open : undefined;
  const { rooms, room } = await pickTeacherRoom(teacher.id, roomParam);
  if (!room) return <p className="p-6">No room assigned.</p>;

  const today = todayStr();
  const now = nowTime();
  const db = await getDb();
  const [center] = await db.select().from(s.centers).where(eq(s.centers.id, room.centerId));
  const day = await roomDay(room.id, today);
  const att = await roomAttendance(room.id, today);
  const here = att.filter((a) => a.status === "here").length;
  const waiting = att.filter((a) => a.status === "not_arrived").length;
  const absent = att.filter((a) => a.status === "absent").length;
  const kids = day.children;
  const count = (st: ChildStatus) => kids.filter((k) => k.status === st).length;
  const readyOrSent = count("ready") + count("sent");
  const minsLeft = minutesBetween(now, center.reportSendTime);
  const countdown = minsLeft > 0 ? `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m left` : "due now";
  const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
  const shown = kids.filter((k) => f.match(k.status));
  const nameOf = new Map(kids.map((k) => [k.child.id, k.child]));
  const pct = (n: number) => `${(n / Math.max(kids.length, 1)) * 100}%`;
  const qs = (extra: Record<string, string>) =>
    "?" + new URLSearchParams({ ...(rooms.length > 1 ? { room: String(room.id) } : {}), filter, ...extra }).toString();

  // incident popup (opened from the red card)
  const showInc = day.incidents.find((i) => String(i.id) === sp.incident);
  const [incNote] = showInc?.voiceNoteId ? await db.select().from(s.voiceNotes).where(eq(s.voiceNotes.id, showInc.voiceNoteId)) : [];
  const [incStaff] = showInc ? await db.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, showInc.staffId)) : [];
  const incChild = showInc ? nameOf.get(showInc.childId) : undefined;

  return (
    <div className="px-[18px]">
      {/* header */}
      <div className="mt-1.5 flex items-start justify-between">
        <div>
          <div className="eyebrow">{fmtDate(today)}</div>
          <h1 className="font-display mt-0.5 text-[30px] font-semibold leading-[35px]">
            {greetingFor(now)}, {teacher.name.replace("Ms. ", "")}
          </h1>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {rooms.map((r) => (
              <Link key={r.id} href={`/app/teacher?room=${r.id}`}
                className={`inline-flex items-center gap-1.5 rounded-full border py-1.5 pl-2 pr-3 text-[13px] font-semibold ${r.id === room.id ? "border-line bg-surface text-ink-2" : "border-transparent text-ink-3"}`}>
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: r.color }} />
                {r.name} Room{r.id === room.id ? ` · ${kids.length} children` : ""}
              </Link>
            ))}
          </div>
        </div>
        <Link href="/app/teacher/me" className="grid h-[42px] w-[42px] place-items-center rounded-full bg-primary text-sm font-bold text-white">
          {teacher.name.replace("Ms. ", "").slice(0, 2).toUpperCase()}
        </Link>
      </div>

      {/* attendance */}
      <Link href={`/app/teacher/attendance${rooms.length > 1 ? `?room=${room.id}` : ""}`}
        className="mt-[18px] flex items-center gap-3 rounded-[20px] border border-line bg-surface px-4 py-3 shadow-[var(--shadow-1)]">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-success-soft text-[18px]">🏫</span>
        <span className="min-w-0 flex-1">
          <b className="block text-[15px]">{here} of {att.length} here now</b>
          <span className="block truncate text-[12px] text-ink-3">
            {[waiting && `${waiting} not arrived`, absent && `${absent} absent`, att.length - here - waiting - absent > 0 && `${att.length - here - waiting - absent} picked up`].filter(Boolean).join(" · ") || "Everyone is checked in"}
          </span>
        </span>
        <span className="flex h-9 flex-none items-center rounded-full bg-primary-soft px-3.5 text-[13px] font-bold text-primary">Check in / out ›</span>
      </Link>

      {/* progress */}
      <div className="card mt-3 rounded-[22px] p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Daily reports</div>
            <div className="font-display tabular text-[26px] font-semibold leading-[30px]">
              {readyOrSent} <span className="font-sans text-[15px] font-semibold text-ink-3">of {kids.length} ready</span>
            </div>
          </div>
          <div className="rounded-full bg-accent-soft px-2.5 py-1.5 text-xs font-bold text-accent-ink">
            ⏱ Due {fmtTime(center.reportSendTime).replace(":00", "")} · {countdown}
          </div>
        </div>
        <div className="my-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface-2">
          <i className="block bg-primary" style={{ width: pct(count("sent")) }} />
          <i className="block bg-success" style={{ width: pct(count("ready")) }} />
          <i className="block bg-warning" style={{ width: pct(count("review")) }} />
          <i className="block bg-[#E2D8C9]" style={{ width: pct(count("few")) }} />
        </div>
        <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs font-semibold text-ink-2">
          {([["sent", "bg-primary", "Sent"], ["ready", "bg-success", "Ready"], ["review", "bg-warning", "Review"], ["few", "bg-[#E2D8C9]", "Few notes"]] as const).map(([k, c, l]) => (
            <span key={k} className="flex items-center gap-1.5"><b className={`h-2 w-2 rounded-full ${c}`} />{l} {count(k)}</span>
          ))}
        </div>
        <p className="mt-2.5 border-t border-dashed border-line pt-2 text-[12px] leading-[17px] text-ink-3">
          Send every child&apos;s report to parents by {fmtTime(center.reportSendTime)}. Nothing is sent automatically: you tap “Approve &amp; send” in Reports.
        </p>
      </div>

      {/* needs attention */}
      <div className="mt-3.5 grid gap-2.5">
        {day.reviews.map((r) => {
          const cands = (r.candidateIds ?? "").split(",").map(Number).map((id) => nameOf.get(id)).filter(Boolean);
          return (
            <div key={r.id} className="rounded-[18px] border border-l-4 border-line border-l-warning bg-surface p-3.5 shadow-[var(--shadow-1)]">
              <div className="flex items-center gap-2 text-[15px] font-bold">
                <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-warning-soft text-[13px] font-extrabold text-warning">?</span>
                Who is “{r.mentionedName}”?
              </div>
              <p className="ml-[30px] mt-1 text-sm leading-5 text-ink-2">
                From your {fmtTime(r.time)} note: <i className="text-ink">{r.details}</i>. {cands.length === 0 ? "No child matches." : `${cands.length} children match.`}
              </p>
              <div className="ml-[30px] mt-2.5 flex flex-wrap gap-2">
                {cands.map((c) => (
                  <form key={c!.id} action={resolveReview}>
                    <input type="hidden" name="entryId" value={r.id} />
                    <input type="hidden" name="childId" value={c!.id} />
                    <button className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface-2 pl-1.5 pr-3.5 text-sm font-semibold hover:border-primary">
                      <Avatar first={c!.firstName} last={c!.lastName} bg={c!.avatarBg} fg={c!.avatarFg} size={28} />
                      {c!.firstName} {c!.lastName[0]}.
                    </button>
                  </form>
                ))}
                <form action={skipReview}>
                  <input type="hidden" name="entryId" value={r.id} />
                  <button className="h-10 px-3.5 text-sm font-semibold text-ink-3">Skip</button>
                </form>
              </div>
            </div>
          );
        })}
        {day.incidents.map((inc) => {
          const c = nameOf.get(inc.childId)!;
          return (
            <Link key={inc.id} href={qs({ incident: String(inc.id) })} scroll={false}
              className="flex items-center gap-3 rounded-[18px] border-l-4 border-danger bg-danger-soft px-3.5 py-3 transition active:scale-[.99]">
              <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-danger"><WarnIcon /></span>
              <div className="min-w-0">
                <b className="block text-sm">{c.firstName}: incident {inc.status === "draft" ? "sent to director" : inc.status}</b>
                <small className="text-[13px] text-ink-2">{inc.injury} · {inc.location.toLowerCase()} · {fmtTime(inc.time)}</small>
              </div>
              <span className="ml-auto text-right text-[10px] font-bold uppercase leading-3 tracking-wider text-danger">
                {inc.status === "draft" ? <>Awaiting<br />approval</> : inc.status}
              </span>
              <span className="text-danger/60">›</span>
            </Link>
          );
        })}
      </div>

      {/* children */}
      <div className="mx-0.5 mb-2.5 mt-6 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-semibold">Children</h2>
        <Link href="/app/teacher/reports" className="text-[13px] font-bold text-primary">Review reports →</Link>
      </div>
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        {FILTERS.map((x) => {
          const n = x.key === "all" ? kids.length : count(x.key as ChildStatus);
          return (
            <Link key={x.key} href={qs({ filter: x.key })} scroll={false}
              className={`flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold ${x.key === f.key ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2"}`}>
              {x.label} <em className="not-italic opacity-60">{n}</em>
            </Link>
          );
        })}
      </div>

      {f.key === "review" && (
        <p className="mb-3 rounded-2xl bg-warning-soft px-3.5 py-2.5 text-[13px] leading-5 text-[#6B4A0C]">
          <b>Needs review:</b> a voice note mentioned a name that matches more than one child (like “Sam” for Samuel and Samantha).
          The AI never guesses, so pick the right child on the yellow card above.
        </p>
      )}
      {f.key === "few" && (
        <p className="mb-3 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[13px] leading-5 text-ink-2">
          <b className="text-ink">Few notes:</b> fewer than 3 entries today. A good report usually has a meal, a nap and a diaper.
          Record a voice note or add entries before {fmtTime(center.reportSendTime)}.
        </p>
      )}
      {f.key === "ready" && (
        <p className="mb-3 rounded-2xl bg-success-soft px-3.5 py-2.5 text-[13px] leading-5 text-[#2C6B42]">
          <b>Ready:</b> 3 or more entries and no unclear names. Send them from Reports.
        </p>
      )}
      <div className="grid gap-2.5">
        {shown.map(({ child: c, entries, status, incidents, report }) => {
          const isOpen = open === String(c.id);
          const types = [...new Set(entries.map((e) => e.type))];
          const last = entries.at(-1);
          return (
            <div key={c.id} className={`overflow-hidden rounded-[20px] border bg-surface ${isOpen ? "border-[#D8CDBD] shadow-[var(--shadow-2)]" : "border-line shadow-[var(--shadow-1)]"}`}>
              <Link href={qs(isOpen ? {} : { open: String(c.id) })} scroll={false} className="flex items-center gap-3 px-3.5 py-3">
                <Avatar first={c.firstName} last={c.lastName} bg={c.avatarBg} fg={c.avatarFg} size={46}
                  dot={incidents.some((i) => i.status === "draft") ? { color: "#C8412E", symbol: "!" } : STATUS[status].dot} />
                <div className="min-w-0">
                  <h3 className="font-display flex items-center gap-1.5 text-lg font-semibold leading-[22px]">
                    {c.firstName} {c.lastName}
                    {entries.some((e) => isNew(e.createdAt)) && <span className="badge bg-accent px-1.5 py-[3px] font-sans text-[9.5px] text-white">{entries.filter((e) => isNew(e.createdAt)).length} new</span>}
                  </h3>
                  {isOpen || status === "sent" ? (
                    <div className="mt-0.5 text-xs font-medium text-ink-3">
                      {status === "sent" && report?.sentAt ? `Report sent at ${fmtTime(report.sentAt.slice(11))}` :
                        `${ageLabel(c.dateOfBirth, today)} · ${last ? `last note ${fmtTime(last.time)}` : "no notes yet"}`}
                    </div>
                  ) : (
                    <div className="mt-1.5 flex gap-1">
                      {types.map((t) => <TypeIcon key={t} type={t} size={24} />)}
                      {incidents.length > 0 && <TypeIcon type="incident" size={24} />}
                      {Array.from({ length: Math.max(0, 3 - types.length) }).map((_, i) => (
                        <span key={i} className="h-6 w-6 rounded-[7px] border-[1.5px] border-dashed border-line" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="ml-auto grid justify-items-end gap-1">
                  <Badge status={status}>{status === "few" ? `${entries.length} ${entries.length === 1 ? "note" : "notes"}` : undefined}</Badge>
                  <span className="text-ink-3">{isOpen ? "▴" : "▾"}</span>
                </div>
              </Link>
              {isOpen && (
                <div className="border-t border-line bg-gradient-to-b from-surface to-[#FFFCF8] px-3.5 pb-3 pt-1">
                  {entries.length === 0 && <p className="py-3 text-sm text-ink-3">Nothing logged yet today.</p>}
                  {entries.map((e) => (
                    <EntryRow key={e.id} isNew={isNew(e.createdAt)} type={e.type} label={e.label} details={e.details}
                      end={e.endTime ? `${fmtShort(e.time)} – ${fmtShort(e.endTime)}` : undefined} time={fmtShort(e.time)} />
                  ))}
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                      { href: `/app/teacher/record?child=${c.id}`, icon: "🎙", label: "Record", cls: "bg-accent text-white border-accent" },
                      { href: `/app/teacher/child/${c.id}`, icon: "✎", label: "Entries", cls: "bg-surface text-ink border-line" },
                      { href: `/app/teacher/reports/${c.id}`, icon: "📄", label: "Report", cls: "bg-primary text-white border-primary" },
                    ].map((b) => (
                      <Link key={b.label} href={b.href} aria-label={`${b.label} for ${c.firstName}`}
                        className={`flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border text-[13px] font-bold transition active:scale-95 ${b.cls}`}>
                        <span className="text-[15px] leading-none">{b.icon}</span>{b.label}
                      </Link>
                    ))}
                  </div>
                  <Link href={`/app/teacher/child/${c.id}?tab=about`} className="mt-2 block text-center text-[12.5px] font-bold text-primary">
                    View {c.firstName}&apos;s profile, history &amp; parents →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
        {shown.length === 0 && <p className="py-6 text-center text-sm text-ink-3">No children in this filter.</p>}
      </div>

      {showInc && incChild && (
        <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label="Incident details">
          <Link href={qs({})} scroll={false} aria-label="Close" className="absolute inset-0 bg-ink/35" />
          <div className="drop-in relative max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] bg-surface px-5 pb-8 pt-3 shadow-[var(--shadow-3)]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-danger"><WarnIcon size={20} /></span>
              <div className="min-w-0 flex-1">
                <div className="eyebrow text-danger">Incident · {fmtTime(showInc.time)}</div>
                <h2 className="font-display text-[22px] font-semibold leading-7">{incChild.firstName} {incChild.lastName}</h2>
              </div>
              <Link href={qs({})} scroll={false} className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-surface-2" aria-label="Close">✕</Link>
            </div>
            <div className={`mt-3 rounded-xl px-3 py-2 text-[13px] font-semibold ${showInc.status === "draft" ? "bg-warning-soft text-[#8A5E0F]" : showInc.status === "approved" ? "bg-success-soft text-[#2C6B42]" : "bg-surface-2 text-ink-2"}`}>
              {showInc.status === "draft" ? "⏳ Waiting for the director. Parents haven't been told yet."
                : showInc.status === "approved" ? "✓ Approved by the director. Parents were notified." : "Rejected by the director. Parents were not notified."}
            </div>
            <dl className="mt-4 divide-y divide-dashed divide-line text-[14px]">
              {([["Where", showInc.location], ["What happened", showInc.description], ["Injury", `${showInc.injury} (${showInc.bodyPart.toLowerCase()})`],
                ["First aid", showInc.actionTaken], ["Staff present", incStaff?.name ?? ""], ["Serious", showInc.isSerious ? "Yes · director calls the parent" : "No"]] as const).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[105px_1fr] gap-2 py-2.5"><dt className="text-ink-3">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
            </dl>
            {incNote && (
              <div className="mt-3 rounded-2xl bg-surface-2 p-3.5">
                <div className="eyebrow mb-1">From your voice note · {fmtTime(incNote.time)}</div>
                <p className="text-[14px] italic leading-[21px] text-ink-2">“{incNote.transcript}”</p>
              </div>
            )}
            <p className="mt-4 text-center text-xs leading-[18px] text-ink-3">Only the director can edit or approve incidents. Something wrong? Tell the director.</p>
          </div>
        </div>
      )}
    </div>
  );
}
