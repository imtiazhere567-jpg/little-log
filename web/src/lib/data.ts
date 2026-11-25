import "server-only";
import { cache } from "react";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import type { ReportContent } from "./report";

export type Child = typeof s.children.$inferSelect;
export type Entry = typeof s.logEntries.$inferSelect;
export type Room = typeof s.rooms.$inferSelect;
export type Incident = typeof s.incidents.$inferSelect;
export type DailyReport = typeof s.dailyReports.$inferSelect;

export const teacherRooms = cache(async (teacherId: number): Promise<Room[]> => {
  const db = await getDb();
  const rows = await db.select({ room: s.rooms }).from(s.teacherRooms)
    .innerJoin(s.rooms, eq(s.rooms.id, s.teacherRooms.roomId))
    .where(eq(s.teacherRooms.teacherId, teacherId))
    .orderBy(asc(s.rooms.id));
  return rows.map((r) => r.room);
});

/** Room the teacher is viewing; only rooms they are assigned to are allowed. */
export async function pickTeacherRoom(teacherId: number, requested?: string) {
  const rooms = await teacherRooms(teacherId);
  const room = rooms.find((r) => String(r.id) === requested) ?? rooms[0];
  return { rooms, room };
}

export const teacherCanSeeChild = cache(async (teacherId: number, childId: number) => {
  const db = await getDb();
  const rooms = await teacherRooms(teacherId);
  const [c] = await db.select().from(s.children).where(eq(s.children.id, childId));
  return c && rooms.some((r) => r.id === c.roomId) ? c : null;
});

export type ChildStatus = "sent" | "review" | "ready" | "few";

export const roomDay = cache(async (roomId: number, date: string) => {
  const db = await getDb();
  const kids = await db.select().from(s.children).where(eq(s.children.roomId, roomId)).orderBy(asc(s.children.id));
  const ids = kids.map((k) => k.id);
  const [entries, reports, reviews, incs] = await Promise.all([
    ids.length ? db.select().from(s.logEntries)
      .where(and(inArray(s.logEntries.childId, ids), eq(s.logEntries.date, date)))
      .orderBy(asc(s.logEntries.time)) : Promise.resolve([] as Entry[]),
    ids.length ? db.select().from(s.dailyReports)
      .where(and(inArray(s.dailyReports.childId, ids), eq(s.dailyReports.date, date))) : Promise.resolve([] as DailyReport[]),
    db.select().from(s.logEntries).where(and(eq(s.logEntries.roomId, roomId), eq(s.logEntries.date, date),
      eq(s.logEntries.needsReview, true), isNull(s.logEntries.childId))).orderBy(asc(s.logEntries.time)),
    ids.length ? db.select().from(s.incidents)
      .where(and(inArray(s.incidents.childId, ids), eq(s.incidents.date, date))) : Promise.resolve([] as Incident[]),
  ]);

  const reviewCandidates = new Set(reviews.flatMap((r) => (r.candidateIds ?? "").split(",").map(Number)));
  const children = kids.map((k) => {
    const mine = entries.filter((e) => e.childId === k.id);
    const report = reports.find((r) => r.childId === k.id);
    const incidents = incs.filter((i) => i.childId === k.id);
    let status: ChildStatus;
    if (report?.status === "sent") status = "sent";
    else if (reviewCandidates.has(k.id)) status = "review";
    else if (mine.length >= 3) status = "ready";
    else status = "few";
    return { child: k, entries: mine, report, incidents, status };
  });
  return { children, reviews, incidents: incs };
});

export function parseReport(content: string): ReportContent {
  return JSON.parse(content) as ReportContent;
}

/** Children of a parent. Every parent query must go through this list. */
export const parentChildren = cache(async (parentId: number) => {
  const db = await getDb();
  const rows = await db.select({ child: s.children, room: s.rooms }).from(s.childParents)
    .innerJoin(s.children, eq(s.children.id, s.childParents.childId))
    .innerJoin(s.rooms, eq(s.rooms.id, s.children.roomId))
    .where(eq(s.childParents.parentId, parentId))
    .orderBy(asc(s.children.id));
  return rows;
});
