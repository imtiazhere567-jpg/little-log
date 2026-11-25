import "server-only";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { roomDay } from "./data";
import { addDays, dateOf, prevSchoolDay, schoolDays, todayStr, zoned } from "./time";

export const RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
] as const;
export type RangeKey = (typeof RANGES)[number]["key"] | "custom";
export type CustomRange = { from: string; to: string } | null;

/** Validate ?from=&to= for a custom range: real dates, not in the future, in order, at most a year. */
export function parseCustom(from?: string, to?: string): CustomRange {
  const ok = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
  if (!ok(from) || !ok(to)) return null;
  const today = todayStr();
  let [f, t] = [from!, to!].sort();
  if (t > today) t = today;
  if (f > t) f = t;
  if (f < addDays(t, -365)) f = addDays(t, -365);
  return { from: f, to: t };
}

export const ENTRY_TYPES = ["meal", "nap", "mood", "diaper", "activity", "note"] as const;

/** The date window a range covers, plus the (wider) window the trend chart shows. */
export function rangeWindow(range: RangeKey, custom: CustomRange = null) {
  const today = todayStr();
  let from = today, to = today;
  if (range === "custom" && custom) ({ from, to } = custom);
  if (range === "yesterday") from = to = prevSchoolDay(today);
  if (range === "7d") from = addDays(today, -6);
  if (range === "30d") from = addDays(today, -29);
  const days = schoolDays(from, to);
  // short ranges still get a 10-school-day trend so the chart has a shape
  let chartFrom = from;
  while (schoolDays(chartFrom, to).length < 10) chartFrom = addDays(chartFrom, -1);
  return { from, to, days, chartDays: schoolDays(chartFrom, to), chartFrom, today };
}

export async function dashboardData(centerId: number, range: RangeKey, roomId: number | null, custom: CustomRange = null) {
  const db = await getDb();
  const w = rangeWindow(range, custom);
  const allRooms = await db.select().from(s.rooms).where(eq(s.rooms.centerId, centerId)).orderBy(asc(s.rooms.id));
  const rooms = roomId ? allRooms.filter((r) => r.id === roomId) : allRooms;
  const roomIds = rooms.map((r) => r.id);
  const kids = roomIds.length ? await db.select().from(s.children).where(inArray(s.children.roomId, roomIds)) : [];
  const kidIds = kids.map((k) => k.id);
  const none = [0];

  const [entries, reports, incidents, drafts, notes, reviews] = await Promise.all([
    db.select({ childId: s.logEntries.childId, type: s.logEntries.type, date: s.logEntries.date }).from(s.logEntries)
      .where(and(inArray(s.logEntries.childId, kidIds.length ? kidIds : none), gte(s.logEntries.date, w.chartFrom), lte(s.logEntries.date, w.to))),
    db.select().from(s.dailyReports)
      .where(and(inArray(s.dailyReports.childId, kidIds.length ? kidIds : none), gte(s.dailyReports.date, w.chartFrom), lte(s.dailyReports.date, w.to))),
    db.select().from(s.incidents)
      .where(and(inArray(s.incidents.childId, kidIds.length ? kidIds : none), gte(s.incidents.date, w.from), lte(s.incidents.date, w.to))),
    db.select({ inc: s.incidents, child: s.children }).from(s.incidents)
      .innerJoin(s.children, eq(s.children.id, s.incidents.childId))
      .where(and(eq(s.incidents.status, "draft"), inArray(s.incidents.childId, kidIds.length ? kidIds : none)))
      .orderBy(desc(s.incidents.isSerious), asc(s.incidents.time)),
    db.select().from(s.voiceNotes)
      .where(and(inArray(s.voiceNotes.roomId, roomIds.length ? roomIds : none), gte(s.voiceNotes.date, w.from), lte(s.voiceNotes.date, w.to))),
    db.select().from(s.logEntries)
      .where(and(eq(s.logEntries.needsReview, true), inArray(s.logEntries.roomId, roomIds.length ? roomIds : none))),
  ]);

  // notifications belong to a report or incident; scope them through those records
  const scopedReportIds = new Set(reports.map((r) => r.id));
  const scopedIncidentIds = new Set((await db.select({ id: s.incidents.id }).from(s.incidents)
    .where(inArray(s.incidents.childId, kidIds.length ? kidIds : none))).map((r) => r.id));
  const notifs = (await db.select().from(s.notifications)
    .where(and(gte(s.notifications.createdAt, zoned(addDays(w.from, -1), "00:00")), lte(s.notifications.createdAt, zoned(addDays(w.to, 1), "23:59"))))
    .orderBy(desc(s.notifications.id)))
    .filter((n) => {
      const d = dateOf(new Date(n.createdAt));
      if (d < w.from || d > w.to) return false;
      return n.kind === "daily_report" ? scopedReportIds.has(n.recordId) : n.kind === "incident" && scopedIncidentIds.has(n.recordId);
    });

  const inRange = (d: string) => d >= w.from && d <= w.to;
  const rangeEntries = entries.filter((e) => inRange(e.date));
  const rangeSent = reports.filter((r) => r.status === "sent" && inRange(r.date));
  const expected = kids.length * w.days.length;

  // today's per-room status (always "today": it is the live operational view)
  const todayByRoom = await Promise.all(rooms.map((r) => roomDay(r.id, w.today)));
  const roomStatus = rooms.map((r, i) => {
    const day = todayByRoom[i];
    const count = (st: string) => day.children.filter((c) => c.status === st).length;
    return { room: r, total: day.children.length, sent: count("sent"), ready: count("ready"), review: count("review"), few: count("few"),
      entries: day.children.reduce((n, c) => n + c.entries.length, 0) };
  });
  const teachers = await db.select({ roomId: s.teacherRooms.roomId, name: s.users.name }).from(s.teacherRooms)
    .innerJoin(s.users, eq(s.users.id, s.teacherRooms.teacherId));

  const approvedInRange = incidents.filter((i) => i.status === "approved");
  const channel = (c: string) => notifs.filter((n) => n.channel === c);

  return {
    window: w,
    rooms: allRooms,
    scopeRooms: rooms,
    kpi: {
      children: kids.length,
      childrenWithNotesToday: new Set(entries.filter((e) => e.date === w.today).map((e) => e.childId)).size,
      reportsSent: rangeSent.length,
      reportsExpected: expected,
      pendingToday: roomStatus.reduce((n, r) => n + r.total - r.sent, 0),
      readyToday: roomStatus.reduce((n, r) => n + r.ready, 0),
      incidents: incidents.length,
      drafts: drafts.length,
      serious: drafts.filter((d) => d.inc.isSerious).length,
      notes: notes.length,
      entries: rangeEntries.length,
      notifications: notifs.length,
      notificationsRead: notifs.filter((n) => n.readAt).length,
      approved: approvedInRange.length,
      acknowledged: approvedInRange.filter((i) => i.parentAckAt).length,
      reviews: reviews.filter((r) => !r.childId).length,
    },
    // trend: reports sent per school day (single series)
    trend: w.chartDays.map((d) => ({
      date: d,
      sent: reports.filter((r) => r.status === "sent" && r.date === d).length,
      expected: kids.length,
      inRange: inRange(d),
    })),
    byType: ENTRY_TYPES.map((t) => ({ type: t, count: rangeEntries.filter((e) => e.type === t).length })),
    channels: (["whatsapp", "email", "push"] as const).map((c) => ({
      channel: c, sent: channel(c).length, read: channel(c).filter((n) => n.readAt).length,
    })),
    roomStatus: roomStatus.map((r) => ({ ...r, teachers: teachers.filter((t) => t.roomId === r.room.id).map((t) => t.name) })),
    drafts,
    todayChildren: todayByRoom.flatMap((d) => d.children.map((c) => ({ child: c.child, status: c.status, entries: c.entries.length }))),
    fewNotes: todayByRoom.flatMap((d) => d.children.filter((c) => c.status === "few").map((c) => c.child)),
  };
}

export type Dashboard = Awaited<ReturnType<typeof dashboardData>>;
