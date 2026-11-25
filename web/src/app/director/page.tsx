import Link from "next/link";
import type { ReactNode } from "react";
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { describeAudit } from "@/lib/audit-text";
import { requireUser } from "@/lib/session";
import { dashboardData, parseCustom, RANGES, type RangeKey } from "@/lib/dashboard";
import DateRangeSelect from "@/components/DateRangeSelect";
import { dateOf, fmtDate, fmtStamp, fmtTime, greetingFor, nowTime, todayStr } from "@/lib/time";
import { Avatar, TYPE_STYLE, WarnIcon } from "@/components/ui";
import BrandSelect from "@/components/BrandSelect";
import GlobalSearch from "@/components/GlobalSearch";
import { ColumnChart, HBarChart, SegmentBar } from "@/components/charts";
import { DashboardView, type ViewCtx } from "./dashboard-views";

type Params = Record<string, string | undefined>;

const STATUS_PARTS = [
  { key: "sent", label: "Sent", color: "#2F6F62" },
  { key: "ready", label: "Ready", color: "#3E8E5A" },
  { key: "review", label: "Review", color: "#C98A1B" },
  { key: "few", label: "Few notes", color: "#D9CFBF" },
] as const;
const CHANNELS = { whatsapp: { label: "WhatsApp", color: "#2FA765", icon: "💬" }, email: { label: "Email", color: "#4A7FD4", icon: "✉️" }, push: { label: "App", color: "#E8955A", icon: "🔔" } };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default async function Dashboard({ searchParams }: PageProps<"/director">) {
  const director = await requireUser("director");
  const raw = await searchParams;
  const sp: Params = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const custom = sp.range === "custom" ? parseCustom(sp.from, sp.to) : null;
  const range = (custom ? "custom" : RANGES.find((r) => r.key === sp.range)?.key ?? "today") as RangeKey;
  const rangeLabel = custom
    ? (custom.from === custom.to ? fmtDate(custom.from, { weekday: false }) : `${fmtDate(custom.from, { weekday: false })} – ${fmtDate(custom.to, { weekday: false })}`)
    : RANGES.find((r) => r.key === range)!.label;

  const db = await getDb();
  const [center] = await db.select().from(s.centers).where(eq(s.centers.id, director.centerId));
  const roomsAll = await db.select().from(s.rooms).where(eq(s.rooms.centerId, director.centerId));
  const roomId = roomsAll.some((r) => String(r.id) === sp.room) ? Number(sp.room) : null;
  const d = await dashboardData(director.centerId, range, roomId, custom);
  const k = d.kpi;
  const hereNow = (await db.select({ id: s.attendance.id }).from(s.attendance)
    .where(and(eq(s.attendance.date, todayStr()), isNotNull(s.attendance.checkInAt), isNull(s.attendance.checkOutAt), eq(s.attendance.absent, false)))).length;

  // every link keeps the current filters
  const href = (extra: Params = {}, keep: Params = {}) => {
    const q = new URLSearchParams();
    const all = { range: range === "today" ? undefined : range, from: custom?.from, to: custom?.to, room: roomId ? String(roomId) : undefined, ...keep, ...extra };
    // "all" is the default for type/channel filters, so it stays out of the URL (status keeps it: its default differs per view)
    for (const [key, v] of Object.entries(all)) if (v && (v !== "all" || key === "status")) q.set(key, v);
    const s2 = q.toString();
    return `/director${s2 ? `?${s2}` : ""}`;
  };
  const ctx: ViewCtx = { centerId: director.centerId, range, custom, rangeLabel, roomId, sp, href };

  const seriousParents = d.drafts.some((x) => x.inc.isSerious)
    ? await db.select({ childId: s.childParents.childId, u: s.users }).from(s.childParents)
        .innerJoin(s.users, eq(s.users.id, s.childParents.parentId))
        .where(inArray(s.childParents.childId, d.drafts.filter((x) => x.inc.isSerious).map((x) => x.child.id)))
    : [];
  const scopeName = roomId ? `${d.scopeRooms[0]?.name} Room` : "All rooms";
  const single = d.window.days.length === 1;
  const periodWord = single ? (range === "today" ? "today" : fmtDate(d.window.from)) : custom ? rangeLabel : rangeLabel.toLowerCase();

  return (
    <div className="w-full max-w-[1760px]">
      {/* ------------------------------------------------ serious alert */}
      {d.drafts.filter((x) => x.inc.isSerious).map(({ inc, child }) => {
        const p = seriousParents.find((x) => x.childId === child.id)?.u;
        return (
          <div key={inc.id} className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl bg-danger px-5 py-4 text-white shadow-[0_10px_30px_rgba(200,65,46,.3)]">
            <WarnIcon size={24} />
            <div className="min-w-0">
              <b className="block text-[15px]">Serious incident · {child.firstName} {child.lastName}</b>
              <span className="text-sm opacity-90">{inc.injury} ({inc.bodyPart.toLowerCase()}) at {fmtTime(inc.time)}. Call the parent now.</span>
            </div>
            <div className="ml-auto flex gap-2">
              {p?.phone && <a href={`tel:${p.phone}`} className="btn btn-sm bg-white text-danger">📞 Call {p.name.split(" ")[0]}</a>}
              <Link href={`/director/incidents/${inc.id}`} className="btn btn-sm border border-white/50 text-white">Review</Link>
            </div>
          </div>
        );
      })}

      {/* ------------------------------------------------ header + filters */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">{fmtDate(d.window.today)} · {center.name}</div>
          <h1 className="font-display mt-1 text-[34px] font-semibold leading-10">{greetingFor(nowTime())}, {director.name.split(" ")[0]}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 shadow-[var(--shadow-1)]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> Live · updated {fmtTime(nowTime())}
        </span>
        <Link href="/director/attendance" className="flex items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-xs font-bold text-[#2C6B42] shadow-[var(--shadow-1)] hover:brightness-95">
          🏫 {hereNow} of {k.children} here now →
        </Link>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <DateRangeSelect value={range} label={rangeLabel} custom={custom} max={d.window.today}
          presets={RANGES.map((r) => ({ key: r.key, label: r.label, href: href({ range: r.key === "today" ? undefined : r.key, from: undefined, to: undefined }) }))}
          customHref={href({ range: "custom", from: "FROM", to: "TO" })} />
        <BrandSelect label="Room" value={roomId ? String(roomId) : "all"} width={260}
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1H4a1 1 0 01-1-1z" /></svg>}
          options={[{ key: "all", label: "All rooms", hint: `${roomsAll.length} rooms`, href: href({ room: undefined }) },
            ...d.rooms.map((r) => ({ key: String(r.id), label: `${r.name} Room`, hint: r.ageGroup, color: r.color, href: href({ room: String(r.id) }) }))]} />
        {(range !== "today" || roomId) && (
          <Link href="/director" className="rounded-full px-3 py-2 text-[13px] font-bold text-primary hover:bg-primary-soft">Clear filters</Link>
        )}
        <div className="ml-auto w-full md:w-auto md:min-w-[380px]"><GlobalSearch /></div>
      </div>

      {/* ------------------------------------------------ KPI tiles */}
      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile href={href({ view: "children" })} label="Children" value={k.children} sub={`${k.childrenWithNotesToday} with notes today · ${scopeName.toLowerCase()}`} />
        <Tile href={href({ view: "reports" })} label={`Reports sent ${periodWord}`} value={k.reportsSent}
          sub={`${pct(k.reportsSent, k.reportsExpected)}% of ${k.reportsExpected} expected`}
          meter={{ value: k.reportsSent, max: k.reportsExpected, color: "#2F6F62", track: "#E3F0EC" }} />
        <Tile href={href({ view: "pending" })} label="Waiting to send today" value={k.pendingToday}
          sub={`${k.readyToday} ready · send at ${fmtTime(center.reportSendTime)}`} />
        <Tile href={href({ view: "incidents", status: "draft" })} label="Incidents awaiting you" value={k.drafts}
          sub={`${k.incidents} incident${k.incidents === 1 ? "" : "s"} ${periodWord}`} status={k.serious ? { text: `${k.serious} serious`, tone: "danger" } : k.drafts ? { text: "Needs approval", tone: "warning" } : undefined} />
        <Tile href={href({ view: "notes" })} label={`Voice notes ${periodWord}`} value={k.notes} sub="turned into entries by the AI" />
        <Tile href={href({ view: "entries" })} label={`Log entries ${periodWord}`} value={k.entries}
          sub={k.reviews ? `${k.reviews} unclear name${k.reviews === 1 ? "" : "s"} to review` : "no unclear names"} />
        <Tile href={href({ view: "notifications" })} label={`Parent messages ${periodWord}`} value={k.notifications}
          sub={`${pct(k.notificationsRead, k.notifications)}% opened · WhatsApp, email, app`}
          meter={{ value: k.notificationsRead, max: k.notifications, color: "#4A7FD4", track: "#E4ECF8" }} />
        <Tile href={href({ view: "acks" })} label="Incident reports read" value={`${k.acknowledged}/${k.approved}`}
          sub={k.approved ? `${pct(k.acknowledged, k.approved)}% of parents confirmed` : `none approved ${periodWord}`} />
      </div>

      {/* ------------------------------------------------ charts */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Reports sent per school day" sub={`${scopeName} · ${d.trend.length} school days · click a day for its list`}
          action={<Link href={href({ view: "reports" })} scroll={false} className="text-sm font-bold text-primary">All reports →</Link>}>
          <ColumnChart data={d.trend.map((t) => ({
            key: t.date, label: fmtDate(t.date), short: new Date(t.date + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", day: "numeric" }),
            value: t.sent, target: t.expected, href: href({ view: "reports", date: t.date }), dim: !single && !t.inRange, current: t.date === d.window.today,
          }))} />
          {!single && <p className="mt-1 text-xs text-ink-3">Faded columns are outside the selected range.</p>}
        </Card>

        <Card title="What teachers logged" sub={`${scopeName} · ${periodWord} · click a type to see entries`}
          action={<Link href={href({ view: "entries" })} scroll={false} className="text-sm font-bold text-primary">All entries →</Link>}>
          <HBarChart data={d.byType.map((t) => ({
            key: t.type, label: TYPE_STYLE[t.type].label, icon: TYPE_STYLE[t.type].icon, value: t.count,
            color: `var(--color-${t.type})`, href: href({ view: "entries", type: t.type }),
          }))} />
        </Card>
      </div>

      {/* ------------------------------------------------ rooms + attention */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card title={roomId ? `${scopeName} today` : "Rooms today"}
          sub={roomId ? "Every child's report status · click a child to open their profile" : "Daily report status by room · click a room for its children"}
          action={<Legend items={STATUS_PARTS.map((p) => ({ label: p.label, color: p.color }))} />}>
          {roomId && (
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              {d.todayChildren.map(({ child: c, status, entries }) => (
                <Link key={c.id} href={`/director/children/${c.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5 hover:bg-surface-2/60">
                  <Avatar first={c.firstName} last={c.lastName} bg={c.avatarBg} fg={c.avatarFg} size={34} />
                  <span className="min-w-0 flex-1"><b className="block truncate text-sm">{c.firstName} {c.lastName}</b>
                    <span className="text-xs text-ink-3">{entries} {entries === 1 ? "entry" : "entries"} today</span></span>
                  <span className="h-2.5 w-2.5 flex-none rounded-full" title={status}
                    style={{ background: STATUS_PARTS.find((p) => p.key === status)?.color }} />
                  <span className="w-16 text-right text-xs font-semibold text-ink-2">{STATUS_PARTS.find((p) => p.key === status)?.label}</span>
                </Link>
              ))}
            </div>
          )}
          <div className="-mx-2 grid gap-1">
            {d.roomStatus.map((r) => (
              <Link key={r.room.id} href={href({ view: "room", roomv: String(r.room.id) })} scroll={false}
                className="grid grid-cols-[minmax(150px,1.1fr)_2fr_auto] items-center gap-5 rounded-2xl px-3 py-3 hover:bg-surface-2/60">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-bold"><span className="h-3 w-3 rounded-full" style={{ background: r.room.color }} />{r.room.name}</span>
                  <span className="block truncate text-xs text-ink-3">{r.teachers.join(", ") || "No teacher"} · {r.entries} entries</span>
                </span>
                <SegmentBar parts={STATUS_PARTS.map((p) => ({ label: p.label, value: r[p.key], color: p.color }))} />
                <span className="tabular w-20 text-right text-sm"><b className="text-[15px]">{r.sent}</b><span className="text-ink-3">/{r.total} sent</span></span>
              </Link>
            ))}
          </div>
        </Card>

        <Card title="Needs your attention" sub="Click any item">
          <div className="grid gap-2">
            {d.drafts.slice(0, 4).map(({ inc, child }) => (
              <Link key={inc.id} href={`/director/incidents/${inc.id}`}
                className={`flex items-center gap-3 rounded-2xl border-l-4 px-3.5 py-2.5 ${inc.isSerious ? "border-danger bg-danger-soft" : "border-warning bg-warning-soft/60"} hover:shadow-[var(--shadow-1)]`}>
                <Avatar first={child.firstName} last={child.lastName} bg={child.avatarBg} fg={child.avatarFg} size={32} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{child.firstName} · {inc.injury}</b>
                  <span className="text-xs text-ink-2">Incident awaiting approval · {fmtTime(inc.time)}</span>
                </span>
                {inc.isSerious && <span className="badge bg-danger text-white">Serious</span>}
              </Link>
            ))}
            {k.reviews > 0 && (
              <Attention href={href({ view: "reviews" })} icon="?" tone="warning"
                title={`${k.reviews} unclear name${k.reviews === 1 ? "" : "s"}`} sub="A teacher needs to pick the right child" />
            )}
            {d.fewNotes.length > 0 && (
              <Attention href={href({ view: "children", status: "few" })} icon="✎" tone="muted"
                title={`${d.fewNotes.length} children with few notes`} sub={d.fewNotes.slice(0, 4).map((c) => c.firstName).join(", ") + (d.fewNotes.length > 4 ? "…" : "")} />
            )}
            {k.readyToday > 0 && (
              <Attention href={href({ view: "pending" })} icon="✓" tone="success"
                title={`${k.readyToday} reports ready to send`} sub={`Teachers send them at ${fmtTime(center.reportSendTime)}`} />
            )}
            {!d.drafts.length && !k.reviews && !d.fewNotes.length && !k.readyToday && <p className="py-6 text-center text-sm text-ink-3">All clear. 🌿</p>}
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------ parents + activity */}
      <div className="mt-5 grid gap-5 pb-4 xl:grid-cols-[1fr_1fr]">
        <Card title="Report notifications to parents" sub={`${periodWord} · messages sent and how many parents opened them`}
          action={<Link href={href({ view: "notifications" })} scroll={false} className="text-sm font-bold text-primary">All messages →</Link>}>
          {d.channels.every((c) => c.sent === 0)
            ? <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink-2">No reports sent {periodWord === "today" ? "yet today" : "in this period"}. Parents are notified the moment a teacher sends a report, so these numbers fill up around send time. Pick “Last 7 days” above to see past days.</p>
            : <SegmentBar height={10} parts={d.channels.map((c) => ({ label: CHANNELS[c.channel].label, value: c.sent, color: CHANNELS[c.channel].color }))} />}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {d.channels.map((c) => (
              <Link key={c.channel} href={href({ view: "notifications", channel: c.channel })} scroll={false}
                className="rounded-2xl border border-line px-4 py-3 hover:bg-surface-2/60">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: CHANNELS[c.channel].color }} />{CHANNELS[c.channel].label}
                </span>
                <span className="mt-1 block text-[26px] font-semibold leading-8">{c.sent}</span>
                <span className="text-xs text-ink-3">{pct(c.read, c.sent)}% opened</span>
              </Link>
            ))}
          </div>
        </Card>

        <RecentActivity href={href({ view: "activity" })} />
      </div>

      <DashboardView ctx={ctx} />
    </div>
  );
}

// ---------------------------------------------------------------------------- pieces

function Tile({ href, label, value, sub, meter, status }: {
  href: string; label: string; value: number | string; sub: string;
  meter?: { value: number; max: number; color: string; track: string };
  status?: { text: string; tone: "danger" | "warning" };
}) {
  return (
    <Link href={href} scroll={false}
      className="card group flex flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-2)] focus-visible:shadow-[var(--shadow-2)]">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink-2">{label}</span>
        {status ? (
          <span className={`badge ${status.tone === "danger" ? "bg-danger text-white" : "bg-warning-soft text-[#8A5E0F]"}`}>
            {status.tone === "danger" ? "⚠" : "●"} {status.text}
          </span>
        ) : <span className="text-ink-3 opacity-0 transition group-hover:opacity-100">↗</span>}
      </div>
      <div className="mt-2 text-[34px] font-semibold leading-10 tracking-tight">{value}</div>
      {meter && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: meter.track }}>
          <div className="h-full rounded-full" style={{ width: `${pct(meter.value, meter.max)}%`, background: meter.color }} />
        </div>
      )}
      <div className="mt-2 text-[12.5px] text-ink-3">{sub}</div>
    </Link>
  );
}

function Card({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[20px] font-semibold leading-6">{title}</h2>
          {sub && <p className="mt-0.5 text-[12.5px] text-ink-3">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs font-semibold text-ink-2">
      {items.map((i) => <span key={i.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.color }} />{i.label}</span>)}
    </div>
  );
}

function Attention({ href, icon, tone, title, sub }: { href: string; icon: string; tone: "warning" | "muted" | "success"; title: string; sub: string }) {
  const cls = { warning: "bg-warning-soft text-warning", muted: "bg-surface-2 text-ink-2", success: "bg-success-soft text-success" }[tone];
  return (
    <Link href={href} scroll={false} className="flex items-center gap-3 rounded-2xl border border-line px-3.5 py-2.5 hover:bg-surface-2/60">
      <span className={`grid h-8 w-8 flex-none place-items-center rounded-full text-sm font-extrabold ${cls}`}>{icon}</span>
      <span className="min-w-0 flex-1"><b className="block text-sm">{title}</b><span className="block truncate text-xs text-ink-2">{sub}</span></span>
      <span className="text-ink-3">›</span>
    </Link>
  );
}

async function RecentActivity({ href }: { href: string }) {
  const db = await getDb();
  const rows = await db.select({ a: s.auditLog, u: s.users }).from(s.auditLog)
    .innerJoin(s.users, eq(s.users.id, s.auditLog.userId)).orderBy(desc(s.auditLog.createdAt), desc(s.auditLog.id)).limit(5);
  const lines = await describeAudit(rows);
  const today = todayStr();
  return (
    <Card title="Recent activity" sub="Who did what, from the audit log" action={<Link href={href} scroll={false} className="text-sm font-bold text-primary">View all →</Link>}>
      <div className="grid">
        {rows.map(({ a, u }) => {
          const l = lines.get(a.id)!;
          return (
            <Link key={a.id} href={l.href ?? href} scroll={false} className="flex items-start gap-3 border-b border-dashed border-line py-2.5 last:border-0 hover:bg-surface-2/40">
              <span className={`mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-full text-[11px] font-bold text-white ${u.role === "director" ? "bg-primary" : u.role === "teacher" ? "bg-accent" : "bg-[#4A7FD4]"}`}>
                {u.name.replace(/^(Ms|Mr)\.\s*/, "").slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block"><b>{u.name}</b> <span className={l.tone === "bad" ? "text-danger" : "text-ink-2"}>{l.what}</span></span>
                {l.detail && <span className="block truncate text-[12.5px] text-ink-3">{l.detail}</span>}
              </span>
              <span className="tabular whitespace-nowrap pt-0.5 text-xs text-ink-3">{fmtStamp(a.createdAt, { date: dateOf(a.createdAt) !== today })}</span>
            </Link>
          );
        })}
        {rows.length === 0 && <p className="py-6 text-center text-sm text-ink-3">No activity yet.</p>}
      </div>
    </Card>
  );
}
