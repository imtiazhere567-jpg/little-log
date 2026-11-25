import Link from "next/link";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { describeAudit } from "@/lib/audit-text";
import { roomDay } from "@/lib/data";
import { rangeWindow, ENTRY_TYPES, type CustomRange, type RangeKey } from "@/lib/dashboard";
import { dateOf, fmtDate, fmtShort, fmtStamp, fmtTime } from "@/lib/time";
import { Avatar, Badge, STATUS, TypeIcon, TYPE_STYLE } from "@/components/ui";
import { Chips, Modal, ModalTable, Pagination } from "./Modal";

export const PAGE_SIZE = 8;
type Params = Record<string, string | undefined>;
export type ViewCtx = {
  centerId: number;
  range: RangeKey;
  custom: CustomRange;
  rangeLabel: string;
  roomId: number | null;
  sp: Params;
  /** link back to the dashboard keeping range/room, plus extra params */
  href: (extra?: Params) => string;
};

const page = (sp: Params) => Math.max(1, Number(sp.page) || 1);
const slice = <T,>(rows: T[], p: number) => rows.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
const pill = (text: string, cls = "bg-surface-2 text-ink-2") => <span className={`badge ${cls}`}>{text}</span>;
const CHANNEL = { whatsapp: { label: "WhatsApp", color: "#2FA765" }, email: { label: "Email", color: "#4A7FD4" }, push: { label: "App", color: "#E8955A" } };

function ChildCell({ c, sub }: { c: { id: number; firstName: string; lastName: string; avatarBg: string; avatarFg: string }; sub?: string }) {
  return (
    <Link href={`/director/children/${c.id}`} className="flex items-center gap-3 hover:underline">
      <Avatar first={c.firstName} last={c.lastName} bg={c.avatarBg} fg={c.avatarFg} size={32} />
      <span><b className="block leading-4">{c.firstName} {c.lastName}</b>{sub && <span className="text-xs text-ink-3">{sub}</span>}</span>
    </Link>
  );
}

async function scope(ctx: ViewCtx) {
  const db = await getDb();
  const rooms = await db.select().from(s.rooms).where(eq(s.rooms.centerId, ctx.centerId)).orderBy(asc(s.rooms.id));
  const scoped = ctx.roomId ? rooms.filter((r) => r.id === ctx.roomId) : rooms;
  const kids = scoped.length ? await db.select().from(s.children).where(inArray(s.children.roomId, scoped.map((r) => r.id))) : [];
  return { db, rooms, scoped, kids, kidIds: kids.length ? kids.map((k) => k.id) : [0], roomOf: new Map(rooms.map((r) => [r.id, r])) };
}

export async function DashboardView({ ctx }: { ctx: ViewCtx }) {
  const { sp } = ctx;
  const p = page(sp);
  const w = rangeWindow(ctx.range, ctx.custom);
  const close = ctx.href();
  const pager = (total: number, extra: Params) => (
    <Pagination page={p} pageSize={PAGE_SIZE} total={total} hrefFor={(n) => ctx.href({ ...extra, page: String(n) })} />
  );
  const scopeLabel = `${ctx.rangeLabel}${ctx.roomId ? "" : " · all rooms"}`;

  switch (sp.view) {
    // ---------------------------------------------------------------- children
    case "children": case "room": {
      const { rooms, scoped, roomOf } = await scope(ctx);
      const target = sp.view === "room" ? rooms.filter((r) => String(r.id) === sp.roomv) : scoped;
      const days = await Promise.all(target.map((r) => roomDay(r.id, w.today)));
      const all = days.flatMap((d) => d.children);
      const status = sp.status ?? "all";
      const rows = all.filter((c) => status === "all" || c.status === status);
      const base = { view: sp.view, roomv: sp.roomv, status };
      const title = sp.view === "room" ? `${target[0]?.name ?? ""} Room` : "Children";
      return (
        <Modal title={title} eyebrow="Today" sub={sp.view === "room" ? `${target[0]?.ageGroup} · today's report status for every child` : "Every child in scope with today's report status"}
          closeHref={close} footer={pager(rows.length, base)}>
          <Chips items={(["all", "sent", "ready", "review", "few"] as const).map((k) => ({
            label: k === "all" ? "All" : STATUS[k].label, count: k === "all" ? all.length : all.filter((c) => c.status === k).length,
            href: ctx.href({ ...base, status: k }), on: status === k,
          }))} />
          <ModalTable head={["Child", "Room", "Entries today", "Last note", "Status"]} rows={slice(rows, p).map((c) => [
            <ChildCell key="c" c={c.child} />,
            roomOf.get(c.child.roomId)?.name,
            <span key="e" className="tabular">{c.entries.length}</span>,
            c.entries.at(-1) ? fmtTime(c.entries.at(-1)!.time) : "–",
            <Badge key="s" status={c.status} />,
          ])} />
        </Modal>
      );
    }

    // ---------------------------------------------------------------- reports sent
    case "reports": {
      const { db, kids, kidIds, roomOf } = await scope(ctx);
      const from = sp.date ?? w.from, to = sp.date ?? w.to;
      const reps = await db.select().from(s.dailyReports)
        .where(and(inArray(s.dailyReports.childId, kidIds), eq(s.dailyReports.status, "sent"), gte(s.dailyReports.date, from), lte(s.dailyReports.date, to)))
        .orderBy(desc(s.dailyReports.date), desc(s.dailyReports.sentAt));
      const users = await db.select({ id: s.users.id, name: s.users.name }).from(s.users);
      const kid = new Map(kids.map((k) => [k.id, k]));
      const base = { view: "reports", date: sp.date };
      return (
        <Modal title="Reports sent" eyebrow={sp.date ? fmtDate(sp.date) : scopeLabel} sub="Every daily report delivered to parents"
          closeHref={close} footer={pager(reps.length, base)}>
          {sp.date && <Chips items={[{ label: `Only ${fmtDate(sp.date)}`, href: ctx.href(base), on: true }, { label: `Whole range (${ctx.rangeLabel})`, href: ctx.href({ view: "reports" }), on: false }]} />}
          <ModalTable head={["Date", "Child", "Room", "Sent at", "Approved by"]} rows={slice(reps, p).map((r) => {
            const c = kid.get(r.childId)!;
            return [
              <span key="d" className="tabular">{fmtDate(r.date, { weekday: false })}</span>,
              <ChildCell key="c" c={c} />,
              roomOf.get(c.roomId)?.name,
              <span key="t" className="tabular">{r.sentAt ? fmtTime(r.sentAt.slice(11)) : "–"}</span>,
              <span key="a" className="flex items-center justify-between gap-3">{users.find((u) => u.id === r.approvedBy)?.name}
                <Link href={`/director/children/${c.id}?tab=reports&report=${r.id}`} className="font-bold text-primary">Read →</Link></span>,
            ];
          })} empty="No reports were sent in this range." />
        </Modal>
      );
    }

    // ---------------------------------------------------------------- pending today
    case "pending": {
      const { scoped, roomOf } = await scope(ctx);
      const days = await Promise.all(scoped.map((r) => roomDay(r.id, w.today)));
      const rows = days.flatMap((d) => d.children).filter((c) => c.status !== "sent")
        .sort((a, b) => ["review", "few", "ready"].indexOf(a.status) - ["review", "few", "ready"].indexOf(b.status));
      return (
        <Modal title="Waiting to be sent" eyebrow="Today" sub="Reports teachers still need to review and send. Needs-review and few-notes first."
          closeHref={close} footer={pager(rows.length, { view: "pending" })}>
          <ModalTable head={["Child", "Room", "Entries", "Why it's waiting"]} rows={slice(rows, p).map((c) => [
            <ChildCell key="c" c={c.child} />,
            roomOf.get(c.child.roomId)?.name,
            <span key="e" className="tabular">{c.entries.length}</span>,
            <span key="w" className="flex items-center gap-2"><Badge status={c.status} />
              <span className="text-xs text-ink-3">{c.status === "review" ? "an unclear name may be this child" : c.status === "few" ? "fewer than 3 notes so far" : "ready for the teacher to send"}</span></span>,
          ])} empty="Every report has been sent. 🌿" />
        </Modal>
      );
    }

    // ---------------------------------------------------------------- incidents
    case "incidents": {
      const { db, kids, kidIds, roomOf } = await scope(ctx);
      const all = await db.select().from(s.incidents)
        .where(and(inArray(s.incidents.childId, kidIds), gte(s.incidents.date, w.from), lte(s.incidents.date, w.to)))
        .orderBy(desc(s.incidents.date), desc(s.incidents.time));
      const drafts = await db.select().from(s.incidents).where(and(inArray(s.incidents.childId, kidIds), eq(s.incidents.status, "draft")));
      const merged = [...new Map([...drafts, ...all].map((i) => [i.id, i])).values()];
      const status = sp.status ?? "all";
      const rows = merged.filter((i) => status === "all" || i.status === status).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
      const kid = new Map(kids.map((k) => [k.id, k]));
      const base = { view: "incidents", status };
      return (
        <Modal title="Incidents" eyebrow={scopeLabel} sub="Drafts waiting for you are always shown, whatever the date range" closeHref={close} footer={pager(rows.length, base)}>
          <Chips items={(["all", "draft", "approved", "rejected"] as const).map((k) => ({
            label: k === "all" ? "All" : k === "draft" ? "Waiting" : STATUS[k].label,
            count: k === "all" ? merged.length : merged.filter((i) => i.status === k).length, href: ctx.href({ ...base, status: k }), on: status === k,
          }))} />
          <ModalTable head={["When", "Child", "What happened", "Status", ""]} rows={slice(rows, p).map((i) => {
            const c = kid.get(i.childId)!;
            return [
              <span key="d" className="tabular whitespace-nowrap">{fmtDate(i.date, { weekday: false })}, {fmtTime(i.time)}</span>,
              <ChildCell key="c" c={c} sub={roomOf.get(c.roomId)?.name} />,
              <span key="w"><b>{i.injury}</b><span className="block text-xs text-ink-3">{i.location}</span></span>,
              <span key="s" className="flex gap-1.5">{i.isSerious && pill("Serious", "bg-danger text-white")}<Badge status={i.status === "draft" ? "awaiting" : i.status} /></span>,
              <Link key="l" href={`/director/incidents/${i.id}`} className="font-bold text-primary">{i.status === "draft" ? "Review →" : "Open →"}</Link>,
            ];
          })} empty="No incidents in this range. 🌿" />
        </Modal>
      );
    }

    // ---------------------------------------------------------------- voice notes
    case "notes": {
      const { db, scoped, roomOf } = await scope(ctx);
      const notes = await db.select({ n: s.voiceNotes, t: s.users }).from(s.voiceNotes).innerJoin(s.users, eq(s.users.id, s.voiceNotes.teacherId))
        .where(and(inArray(s.voiceNotes.roomId, scoped.length ? scoped.map((r) => r.id) : [0]), gte(s.voiceNotes.date, w.from), lte(s.voiceNotes.date, w.to)))
        .orderBy(desc(s.voiceNotes.date), desc(s.voiceNotes.time));
      return (
        <Modal title="Voice notes" eyebrow={scopeLabel} sub="What teachers said, as text. Audio is deleted after transcription." closeHref={close} footer={pager(notes.length, { view: "notes" })} wide>
          <ModalTable head={["When", "Teacher", "Room", "Transcript"]} rows={slice(notes, p).map(({ n, t }) => [
            <span key="d" className="tabular whitespace-nowrap">{fmtDate(n.date, { weekday: false })}, {fmtTime(n.time)}</span>,
            <b key="t">{t.name}</b>,
            roomOf.get(n.roomId)?.name,
            <span key="x" className="line-clamp-2 text-ink-2">“{n.transcript}”</span>,
          ])} empty="No voice notes in this range." />
        </Modal>
      );
    }

    // ---------------------------------------------------------------- log entries
    case "entries": {
      const { db, kids, kidIds } = await scope(ctx);
      const type = sp.type ?? "all";
      const all = await db.select().from(s.logEntries)
        .where(and(inArray(s.logEntries.childId, kidIds), gte(s.logEntries.date, w.from), lte(s.logEntries.date, w.to)))
        .orderBy(desc(s.logEntries.date), desc(s.logEntries.time));
      const users = await db.select({ id: s.users.id, name: s.users.name }).from(s.users);
      const rows = all.filter((e) => type === "all" || e.type === type);
      const kid = new Map(kids.map((k) => [k.id, k]));
      const base = { view: "entries", type };
      return (
        <Modal title="Log entries" eyebrow={scopeLabel} sub="Everything teachers recorded, newest first" closeHref={close} footer={pager(rows.length, base)} wide>
          <Chips items={[{ label: "All", count: all.length, href: ctx.href({ ...base, type: "all" }), on: type === "all" },
            ...ENTRY_TYPES.map((t) => ({ label: TYPE_STYLE[t].label, count: all.filter((e) => e.type === t).length, href: ctx.href({ ...base, type: t }), on: type === t, color: `var(--color-${t})` }))]} />
          <ModalTable head={["When", "Child", "Type", "Details", "Recorded by"]} rows={slice(rows, p).map((e) => [
            <span key="d" className="tabular whitespace-nowrap">{fmtDate(e.date, { weekday: false })}, {fmtShort(e.time)}</span>,
            <ChildCell key="c" c={kid.get(e.childId!)!} />,
            <span key="t" className="flex items-center gap-2"><TypeIcon type={e.type} size={26} /><span className="text-xs font-bold">{e.label ?? TYPE_STYLE[e.type].label}</span></span>,
            e.type === "nap" && e.endTime ? `${fmtShort(e.time)} – ${fmtShort(e.endTime)}` : e.details,
            users.find((u) => u.id === e.createdBy)?.name,
          ])} empty="No entries in this range." />
        </Modal>
      );
    }

    // ---------------------------------------------------------------- notifications
    case "notifications": {
      const { db, kidIds } = await scope(ctx);
      const channel = sp.channel ?? "all";
      const reportIds = new Set((await db.select({ id: s.dailyReports.id }).from(s.dailyReports).where(inArray(s.dailyReports.childId, kidIds))).map((r) => r.id));
      const incIds = new Set((await db.select({ id: s.incidents.id }).from(s.incidents).where(inArray(s.incidents.childId, kidIds))).map((r) => r.id));
      const all = (await db.select({ n: s.notifications, u: s.users }).from(s.notifications).innerJoin(s.users, eq(s.users.id, s.notifications.parentId))
        .orderBy(desc(s.notifications.id)))
        .filter(({ n }) => {
          const d = dateOf(new Date(n.createdAt));
          return d >= w.from && d <= w.to && (n.kind === "daily_report" ? reportIds.has(n.recordId) : n.kind === "incident" && incIds.has(n.recordId));
        });
      const rows = all.filter(({ n }) => channel === "all" || n.channel === channel);
      const base = { view: "notifications", channel };
      return (
        <Modal title="Parent notifications" eyebrow={scopeLabel} sub="Every WhatsApp, email and app message. They only say a report is ready." closeHref={close} footer={pager(rows.length, base)} wide>
          <Chips items={[{ label: "All", count: all.length, href: ctx.href({ ...base, channel: "all" }), on: channel === "all" },
            ...(["whatsapp", "email", "push"] as const).map((c) => ({ label: CHANNEL[c].label, count: all.filter(({ n }) => n.channel === c).length, href: ctx.href({ ...base, channel: c }), on: channel === c, color: CHANNEL[c].color }))]} />
          <ModalTable head={["Sent", "Parent", "Channel", "Message", "Read"]} rows={slice(rows, p).map(({ n, u }) => [
            <span key="d" className="tabular whitespace-nowrap">{fmtStamp(n.createdAt)}</span>,
            <b key="p">{u.name}</b>,
            <span key="c" className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CHANNEL[n.channel].color }} />{CHANNEL[n.channel].label}</span>,
            <span key="m" className="line-clamp-1 text-ink-2">{n.channel === "email" ? n.title : n.body}</span>,
            n.readAt ? pill("✓ Read", "bg-success-soft text-[#2C6B42]") : pill("Unread"),
          ])} empty="No notifications in this range." />
        </Modal>
      );
    }

    // ---------------------------------------------------------------- incident read receipts
    case "acks": {
      const { db, kids, kidIds } = await scope(ctx);
      const rows = await db.select().from(s.incidents)
        .where(and(inArray(s.incidents.childId, kidIds), eq(s.incidents.status, "approved"), gte(s.incidents.date, w.from), lte(s.incidents.date, w.to)))
        .orderBy(desc(s.incidents.date));
      const kid = new Map(kids.map((k) => [k.id, k]));
      return (
        <Modal title="Did parents read it?" eyebrow={scopeLabel} sub="Approved incident reports and whether a parent tapped “I've read this”" closeHref={close} footer={pager(rows.length, { view: "acks" })}>
          <ModalTable head={["Date", "Child", "Incident", "Parent read it"]} rows={slice(rows, p).map((i) => [
            <span key="d" className="tabular">{fmtDate(i.date, { weekday: false })}</span>,
            <ChildCell key="c" c={kid.get(i.childId)!} />,
            <Link key="i" href={`/director/incidents/${i.id}`} className="hover:underline">{i.injury}</Link>,
            i.parentAckAt ? pill(`✓ ${fmtDate(i.parentAckAt.slice(0, 10), { weekday: false })}`, "bg-success-soft text-[#2C6B42]") : pill("Not yet", "bg-warning-soft text-[#8A5E0F]"),
          ])} empty="No approved incidents in this range." />
        </Modal>
      );
    }

    // ---------------------------------------------------------------- names to review
    case "reviews": {
      const { db, scoped, roomOf } = await scope(ctx);
      const rows = await db.select().from(s.logEntries)
        .where(and(eq(s.logEntries.needsReview, true), inArray(s.logEntries.roomId, scoped.length ? scoped.map((r) => r.id) : [0])))
        .orderBy(desc(s.logEntries.date), desc(s.logEntries.time));
      const open = rows.filter((r) => !r.childId);
      const kids = await db.select().from(s.children);
      return (
        <Modal title="Unclear names" eyebrow="Waiting for teachers" sub="The AI never guesses. When a name matches two children, the teacher picks." closeHref={close} footer={pager(open.length, { view: "reviews" })}>
          <ModalTable head={["When", "Room", "Heard", "Could be", "Note"]} rows={slice(open, p).map((r) => [
            <span key="d" className="tabular whitespace-nowrap">{fmtDate(r.date, { weekday: false })}, {fmtTime(r.time)}</span>,
            roomOf.get(r.roomId)?.name,
            <b key="h">“{r.mentionedName}”</b>,
            (r.candidateIds ?? "").split(",").map(Number).map((id) => kids.find((k) => k.id === id)?.firstName).join(" or "),
            <span key="n" className="text-ink-2">{r.details}</span>,
          ])} empty="No unclear names. 🌿" />
        </Modal>
      );
    }

    // ---------------------------------------------------------------- activity
    case "activity": {
      const db = await getDb();
      const rows = await db.select({ a: s.auditLog, u: s.users }).from(s.auditLog)
        .innerJoin(s.users, eq(s.users.id, s.auditLog.userId)).orderBy(desc(s.auditLog.createdAt), desc(s.auditLog.id));
      const page = slice(rows, p);
      const lines = await describeAudit(page);
      return (
        <Modal title="Activity" eyebrow="Audit log" sub="Who viewed, created, edited, approved or exported what" closeHref={close} footer={pager(rows.length, { view: "activity" })}>
          <ModalTable head={["When", "Who", "What happened"]} rows={page.map(({ a, u }) => {
            const l = lines.get(a.id)!;
            return [
              <span key="d" className="tabular whitespace-nowrap">{fmtStamp(a.createdAt)}</span>,
              <span key="u"><b>{u.name}</b><span className="block text-xs capitalize text-ink-3">{u.role}</span></span>,
              <span key="w"><span className={l.tone === "bad" ? "text-danger" : ""}>{l.what}</span>{l.detail && <span className="block max-w-[520px] truncate text-xs text-ink-3">{l.detail}</span>}</span>,
            ];
          })} />
        </Modal>
      );
    }
  }
  return null;
}
