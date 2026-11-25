import "server-only";
import { cache } from "react";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import type { User } from "./session";
import { addDays, fmtTime, minutesBetween, nowTime, todayStr, weekday, zoned } from "./time";

// Check-in / check-out. Licensing in the US and UK requires a record of when each child
// arrived, when they left and who picked them up. Parents get a short app notification
// for each step (never report details), plus two reminders: "Is Emma coming today?" and
// "Please pick up Emma, we close at 6:00 PM".

export type AttStatus = "not_arrived" | "here" | "gone" | "absent";
export type Att = typeof s.attendance.$inferSelect;

export const statusOf = (a: Att | undefined | null): AttStatus =>
  !a ? "not_arrived" : a.absent ? "absent" : a.checkOutAt ? "gone" : a.checkInAt ? "here" : "not_arrived";

export const ABSENT_REASONS = ["Sick", "Family day", "Vacation", "Appointment", "Other"];

/** Today's (or any day's) attendance for every child in a room. */
export const roomAttendance = cache(async (roomId: number, date: string) => {
  const db = await getDb();
  const kids = await db.select().from(s.children).where(eq(s.children.roomId, roomId)).orderBy(asc(s.children.firstName));
  const rows = kids.length ? await db.select().from(s.attendance)
    .where(and(eq(s.attendance.date, date), inArray(s.attendance.childId, kids.map((k) => k.id)))) : [];
  return kids.map((child) => {
    const att = rows.find((r) => r.childId === child.id) ?? null;
    return { child, att, status: statusOf(att) };
  });
});

export async function childAttendance(childId: number, date: string) {
  const db = await getDb();
  const [a] = await db.select().from(s.attendance).where(and(eq(s.attendance.childId, childId), eq(s.attendance.date, date)));
  return a ?? null;
}

/** Who may pick this child up: the parents (always), then the extra adults from enrollment. */
export async function pickupOptions(childId: number) {
  const db = await getDb();
  const [parents, others] = await Promise.all([
    db.select({ id: s.users.id, name: s.users.name, phone: s.users.phone, relationship: s.childParents.relationship })
      .from(s.childParents).innerJoin(s.users, eq(s.users.id, s.childParents.parentId)).where(eq(s.childParents.childId, childId)).orderBy(asc(s.users.id)),
    db.select().from(s.pickups).where(eq(s.pickups.childId, childId)).orderBy(asc(s.pickups.id)),
  ]);
  return [
    ...parents.map((p) => ({ key: `p${p.id}`, name: p.name, relationship: p.relationship ?? "Parent", phone: p.phone, parent: true })),
    ...others.map((o) => ({ key: `o${o.id}`, name: o.name, relationship: o.relationship, phone: o.phone, parent: false })),
  ];
}

const first = (name: string) => name.replace(/^(Ms|Mr|Mrs)\.\s*/, "").split(" ")[0];

/** "tomorrow" or "on Monday" — the next day the center is open. */
function nextOpenDay(date: string) {
  let d = addDays(date, 1);
  while ([0, 6].includes(weekday(d))) d = addDays(d, 1);
  return d === addDays(date, 1) ? "tomorrow" : `on ${new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}`;
}

/** App notification to the child's parents (push only: attendance is quick, routine news). */
async function tellParents(childId: number, title: string, body: string, onlyIfNotSentToday = false) {
  const db = await getDb();
  const [row] = await db.select({ c: s.children, center: s.centers }).from(s.children)
    .innerJoin(s.rooms, eq(s.rooms.id, s.children.roomId)).innerJoin(s.centers, eq(s.centers.id, s.rooms.centerId))
    .where(eq(s.children.id, childId));
  if (!row?.center.notifyPush) return;
  const parents = await db.select({ id: s.childParents.parentId }).from(s.childParents).where(eq(s.childParents.childId, childId));
  for (const p of parents) {
    if (onlyIfNotSentToday) {
      const [dup] = await db.select({ id: s.notifications.id }).from(s.notifications).where(and(
        eq(s.notifications.parentId, p.id), eq(s.notifications.kind, "attendance"), eq(s.notifications.recordId, childId),
        eq(s.notifications.title, title), gte(s.notifications.createdAt, zoned(todayStr(), "00:00"))));
      if (dup) continue;
    }
    await db.insert(s.notifications).values({ parentId: p.id, channel: "push", kind: "attendance", recordId: childId, title, body });
  }
}

async function upsert(childId: number, date: string, set: Partial<typeof s.attendance.$inferInsert>) {
  const db = await getDb();
  const [row] = await db.insert(s.attendance).values({ childId, date, ...set })
    .onConflictDoUpdate({ target: [s.attendance.childId, s.attendance.date], set }).returning();
  return row;
}

export async function checkIn(by: User, child: typeof s.children.$inferSelect) {
  const at = nowTime();
  const row = await upsert(child.id, todayStr(), { checkInAt: at, checkInBy: by.id, absent: false, absentReason: null, absentBy: null, checkOutAt: null, checkOutBy: null, pickedUpBy: null });
  await tellParents(child.id, "Checked in", `${child.firstName} checked in at ${fmtTime(at)} ✓ Have a good day!`);
  return row;
}

export async function checkOut(by: User, child: typeof s.children.$inferSelect, pickupKey: string) {
  const who = (await pickupOptions(child.id)).find((p) => p.key === pickupKey);
  if (!who) throw new Error("Only people on the pickup list can collect a child.");
  const date = todayStr();
  const at = nowTime();
  const cur = await childAttendance(child.id, date);
  const row = await upsert(child.id, date, { checkInAt: cur?.checkInAt ?? at, checkInBy: cur?.checkInBy ?? by.id, checkOutAt: at, checkOutBy: by.id, pickedUpBy: `${who.name} (${who.relationship})`, absent: false });
  await tellParents(child.id, "Picked up",
    `${child.firstName} was picked up by ${who.parent ? first(who.name) : who.name} at ${fmtTime(at)}. Thank you, see you ${nextOpenDay(date)}! 👋`);
  return row;
}

export async function markAbsent(by: User, child: typeof s.children.$inferSelect, reason: string) {
  const r = ABSENT_REASONS.includes(reason) ? reason : "Other";
  const row = await upsert(child.id, todayStr(), { absent: true, absentReason: r, absentBy: by.id, checkInAt: null, checkInBy: null, checkOutAt: null, checkOutBy: null, pickedUpBy: null });
  const db = await getDb();
  if (by.role === "parent") {
    // the room's teachers see it on their list; the director gets a quiet alert
    const [room] = await db.select().from(s.rooms).where(eq(s.rooms.id, child.roomId));
    await db.insert(s.staffAlerts).values({ centerId: room.centerId, kind: "attendance", title: `${child.firstName} ${child.lastName} is not coming today`,
      body: `${by.name} said: ${r} · ${room.name} Room`, href: "/director/attendance" });
  } else {
    await tellParents(child.id, "Marked absent", `${child.firstName} is marked absent today (${r}). If that's wrong, please call us.`);
  }
  return row;
}

/** Teacher fixes a mistake: undo the last step. */
export async function undoAttendance(child: typeof s.children.$inferSelect) {
  const date = todayStr();
  const cur = await childAttendance(child.id, date);
  if (!cur) return;
  const db = await getDb();
  if (cur.checkOutAt) await db.update(s.attendance).set({ checkOutAt: null, checkOutBy: null, pickedUpBy: null }).where(eq(s.attendance.id, cur.id));
  else await db.delete(s.attendance).where(eq(s.attendance.id, cur.id));
}

// ------------------------------------------------------------------ reminders
// A real deployment runs these from a scheduled job (e.g. Vercel Cron every 5 minutes).
// In the demo they run whenever a parent phone or the director app checks for news.
const g = globalThis as unknown as { __llRemindersAt?: number };

export async function runAttendanceReminders() {
  if (Date.now() - (g.__llRemindersAt ?? 0) < 60_000) return; // at most once a minute
  g.__llRemindersAt = Date.now();
  const date = todayStr();
  if ([0, 6].includes(weekday(date))) return;
  const now = nowTime();
  const db = await getDb();
  const centers = await db.select().from(s.centers);
  for (const center of centers) {
    const rows = await db.select({ c: s.children, room: s.rooms }).from(s.children)
      .innerJoin(s.rooms, eq(s.rooms.id, s.children.roomId)).where(eq(s.rooms.centerId, center.id));
    const att = rows.length ? await db.select().from(s.attendance)
      .where(and(eq(s.attendance.date, date), inArray(s.attendance.childId, rows.map((r) => r.c.id)))) : [];
    for (const { c, room } of rows) {
      const a = att.find((x) => x.childId === c.id);
      const st = statusOf(a);
      // 1. not here 30 minutes after the usual drop-off → ask the parents
      if (st === "not_arrived" && minutesBetween(c.expectedIn, now) >= 30 && now < center.closesAt) {
        await tellParents(c.id, "Is " + c.firstName + " coming today?",
          `${c.firstName} usually arrives by ${fmtTime(c.expectedIn)}. Tap to let us know if ${c.firstName} is staying home today.`, true);
      }
      // 2. still here 30 minutes before closing → pickup reminder
      if (st === "here" && minutesBetween(now, center.closesAt) <= 30 && minutesBetween(now, center.closesAt) > 0) {
        await tellParents(c.id, "Pickup reminder", `${center.name} closes at ${fmtTime(center.closesAt)}. Please pick up ${c.firstName} by then. Thank you!`, true);
      }
      // 3. still here after closing → the director's bell (once)
      if (st === "here" && now > center.closesAt) {
        const href = `/director/attendance?late=${c.id}`;
        const [dup] = await db.select({ id: s.staffAlerts.id }).from(s.staffAlerts)
          .where(and(eq(s.staffAlerts.href, href), gte(s.staffAlerts.createdAt, zoned(date, "00:00"))));
        if (!dup) await db.insert(s.staffAlerts).values({ centerId: center.id, kind: "attendance",
          title: `Late pickup: ${c.firstName} ${c.lastName}`, body: `Still checked in after closing (${fmtTime(center.closesAt)}) · ${room.name} Room`, href });
      }
    }
  }
}
