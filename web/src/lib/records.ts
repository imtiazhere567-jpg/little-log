import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb, schema as s } from "@/db";

/** Everything recorded for one child in a date range: for licensing inspections. */
export async function childRecords(childId: number, from: string, to: string, centerId: number) {
  const db = await getDb();
  const [row] = await db.select({ child: s.children, room: s.rooms }).from(s.children)
    .innerJoin(s.rooms, eq(s.rooms.id, s.children.roomId))
    .where(and(eq(s.children.id, childId), eq(s.rooms.centerId, centerId)));
  if (!row) return null;
  const users = await db.select({ id: s.users.id, name: s.users.name }).from(s.users);
  const nameOf = (id: number | null) => users.find((u) => u.id === id)?.name ?? "";
  const [entries, reports, incidents, parents] = await Promise.all([
    db.select().from(s.logEntries)
      .where(and(eq(s.logEntries.childId, childId), gte(s.logEntries.date, from), lte(s.logEntries.date, to)))
      .orderBy(asc(s.logEntries.date), asc(s.logEntries.time)),
    db.select().from(s.dailyReports)
      .where(and(eq(s.dailyReports.childId, childId), gte(s.dailyReports.date, from), lte(s.dailyReports.date, to)))
      .orderBy(asc(s.dailyReports.date)),
    db.select().from(s.incidents)
      .where(and(eq(s.incidents.childId, childId), gte(s.incidents.date, from), lte(s.incidents.date, to)))
      .orderBy(asc(s.incidents.date), asc(s.incidents.time)),
    db.select({ u: s.users }).from(s.childParents).innerJoin(s.users, eq(s.users.id, s.childParents.parentId))
      .where(eq(s.childParents.childId, childId)),
  ]);
  return { ...row, entries, reports, incidents, parents: parents.map((p) => p.u), nameOf };
}

export type ChildRecords = NonNullable<Awaited<ReturnType<typeof childRecords>>>;
