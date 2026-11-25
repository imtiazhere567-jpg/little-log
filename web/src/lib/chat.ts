import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gt, inArray, isNull, ne } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import type { User } from "./session";
import { parentChildren, teacherRooms } from "./data";

// One chat thread per child. Who is in it:
//   - the child's parents
//   - the teachers of the child's room
//   - the director (can read every thread and write in any of them)
// Teachers of other rooms never see it; parents only see their own children's threads.

export type ChatRole = "parent" | "teacher" | "director";
export type ChatMessage = {
  id: number; body: string; createdAt: string; senderId: number; senderName: string; role: ChatRole;
  replyTo: { id: number; senderName: string; role: ChatRole; body: string } | null;
};
export type Thread = {
  child: typeof s.children.$inferSelect; room: typeof s.rooms.$inferSelect;
  parents: { id: number; name: string; relationship: string | null }[];
  last: { body: string; senderName: string; role: ChatRole; createdAt: string } | null;
  unread: number;
};

/** The children whose threads this user can open. */
export const chatChildIds = cache(async (user: User): Promise<number[]> => {
  const db = await getDb();
  if (user.role === "parent") return (await parentChildren(user.id)).map((r) => r.child.id);
  if (user.role === "teacher") {
    const rooms = await teacherRooms(user.id);
    if (!rooms.length) return [];
    return (await db.select({ id: s.children.id }).from(s.children).where(inArray(s.children.roomId, rooms.map((r) => r.id)))).map((r) => r.id);
  }
  return (await db.select({ id: s.children.id }).from(s.children)
    .innerJoin(s.rooms, eq(s.rooms.id, s.children.roomId)).where(eq(s.rooms.centerId, user.centerId))).map((r) => r.id);
});

export async function canChat(user: User, childId: number) {
  return (await chatChildIds(user)).includes(childId);
}

const toRole = (r: string): ChatRole => (r === "parent" || r === "teacher" ? r : "director");

/** Thread list with the last message and the unread count for this user. */
export const threadsFor = cache(async (user: User): Promise<Thread[]> => {
  const ids = await chatChildIds(user);
  if (!ids.length) return [];
  const db = await getDb();
  const [kids, links, msgs, reads] = await Promise.all([
    db.select({ child: s.children, room: s.rooms }).from(s.children)
      .innerJoin(s.rooms, eq(s.rooms.id, s.children.roomId)).where(inArray(s.children.id, ids)).orderBy(asc(s.children.id)),
    db.select({ childId: s.childParents.childId, id: s.users.id, name: s.users.name, relationship: s.childParents.relationship })
      .from(s.childParents).innerJoin(s.users, eq(s.users.id, s.childParents.parentId)).where(inArray(s.childParents.childId, ids)),
    db.select({ m: s.messages, name: s.users.name, role: s.users.role }).from(s.messages)
      .innerJoin(s.users, eq(s.users.id, s.messages.senderId)).where(inArray(s.messages.childId, ids)).orderBy(desc(s.messages.id)),
    db.select().from(s.messageReads).where(eq(s.messageReads.userId, user.id)),
  ]);
  const readUpTo = new Map(reads.map((r) => [r.childId, r.lastReadId]));
  return kids.map(({ child, room }) => {
    const mine = msgs.filter((x) => x.m.childId === child.id);
    const last = mine[0];
    const upTo = readUpTo.get(child.id) ?? 0;
    return {
      child, room,
      parents: links.filter((l) => l.childId === child.id).sort((a, b) => a.id - b.id).map(({ id, name, relationship }) => ({ id, name, relationship })),
      last: last ? { body: last.m.body, senderName: last.name, role: toRole(last.role), createdAt: last.m.createdAt.toISOString() } : null,
      unread: mine.filter((x) => x.m.id > upTo && x.m.senderId !== user.id).length,
    };
  }).sort((a, b) => (b.last?.createdAt ?? "").localeCompare(a.last?.createdAt ?? ""));
});

export async function unreadTotal(user: User) {
  return (await threadsFor(user)).reduce((n, t) => n + t.unread, 0);
}

/** Messages in one thread (oldest first), optionally only the ones after `after`. */
export async function threadMessages(childId: number, after = 0): Promise<ChatMessage[]> {
  const db = await getDb();
  const rows = await db.select({ m: s.messages, name: s.users.name, role: s.users.role }).from(s.messages)
    .innerJoin(s.users, eq(s.users.id, s.messages.senderId))
    .where(and(eq(s.messages.childId, childId), gt(s.messages.id, after))).orderBy(asc(s.messages.id));
  const replyIds = [...new Set(rows.map((r) => r.m.replyToId).filter((x): x is number => !!x))];
  const replies = replyIds.length
    ? await db.select({ m: s.messages, name: s.users.name, role: s.users.role }).from(s.messages)
      .innerJoin(s.users, eq(s.users.id, s.messages.senderId)).where(inArray(s.messages.id, replyIds))
    : [];
  return rows.map(({ m, name, role }) => {
    const r = replies.find((x) => x.m.id === m.replyToId);
    return {
      id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), senderId: m.senderId, senderName: name, role: toRole(role),
      replyTo: r ? { id: r.m.id, senderName: r.name, role: toRole(r.role), body: r.m.body.slice(0, 140) } : null,
    };
  });
}

export async function markThreadRead(userId: number, childId: number) {
  const db = await getDb();
  const [last] = await db.select({ id: s.messages.id }).from(s.messages).where(eq(s.messages.childId, childId)).orderBy(desc(s.messages.id)).limit(1);
  const lastReadId = last?.id ?? 0;
  await db.insert(s.messageReads).values({ userId, childId, lastReadId })
    .onConflictDoUpdate({ target: [s.messageReads.userId, s.messageReads.childId], set: { lastReadId } });
  // the parent's "new message" phone notification for this thread is read too
  await db.update(s.notifications).set({ readAt: new Date() }).where(and(
    eq(s.notifications.parentId, userId), eq(s.notifications.kind, "message"), eq(s.notifications.recordId, childId), isNull(s.notifications.readAt)));
}

/** Save a message and tell the right people (without the message text, like report notifications). */
export async function postMessage(user: User, childId: number, body: string, replyToId?: number | null) {
  const db = await getDb();
  const text = body.replace(/\s+\n/g, "\n").trim().slice(0, 2000);
  if (!text) throw new Error("Empty message");
  let reply: number | null = null;
  if (replyToId) {
    const [r] = await db.select({ id: s.messages.id }).from(s.messages).where(and(eq(s.messages.id, replyToId), eq(s.messages.childId, childId)));
    reply = r?.id ?? null;
  }
  const [m] = await db.insert(s.messages).values({ childId, senderId: user.id, body: text, replyToId: reply }).returning();
  await markThreadRead(user.id, childId);

  const [child] = await db.select().from(s.children).where(eq(s.children.id, childId));
  const [room] = await db.select().from(s.rooms).where(eq(s.rooms.id, child.roomId));
  const [center] = await db.select().from(s.centers).where(eq(s.centers.id, room.centerId));
  if (user.role !== "parent") {
    // staff wrote → app notification to the child's parents
    if (center.notifyPush) {
      const parents = await db.select({ id: s.childParents.parentId }).from(s.childParents).where(eq(s.childParents.childId, childId));
      const who = user.role === "director" ? `${user.name} (director)` : user.name;
      if (parents.length) await db.insert(s.notifications).values(parents.map((p) => ({
        parentId: p.id, channel: "push" as const, kind: "message" as const, recordId: childId,
        title: "Littlelog", body: `New message from ${who} about ${child.firstName}`,
      })));
    }
  } else {
    // a parent wrote → the director's bell (one alert per thread until it is read)
    const href = `/director/messages?child=${childId}`;
    const title = `New message from ${user.name}`;
    const alertBody = `${child.firstName} ${child.lastName} · ${room.name} Room`;
    const [open] = await db.select().from(s.staffAlerts)
      .where(and(eq(s.staffAlerts.href, href), isNull(s.staffAlerts.readAt), ne(s.staffAlerts.kind, "report_sent")));
    if (open) await db.update(s.staffAlerts).set({ title, body: alertBody, createdAt: new Date() }).where(eq(s.staffAlerts.id, open.id));
    else await db.insert(s.staffAlerts).values({ centerId: room.centerId, kind: "message", title, body: alertBody, href });
  }
  return m.id;
}

/** Everyone in a child's thread, for the header ("who can read this"). */
export async function threadMembers(childId: number) {
  const db = await getDb();
  const [row] = await db.select({ child: s.children, room: s.rooms }).from(s.children)
    .innerJoin(s.rooms, eq(s.rooms.id, s.children.roomId)).where(eq(s.children.id, childId));
  const [parents, teachers, directors] = await Promise.all([
    db.select({ id: s.users.id, name: s.users.name, phone: s.users.phone, relationship: s.childParents.relationship }).from(s.childParents)
      .innerJoin(s.users, eq(s.users.id, s.childParents.parentId)).where(eq(s.childParents.childId, childId)).orderBy(asc(s.users.id)),
    db.select({ id: s.users.id, name: s.users.name }).from(s.teacherRooms)
      .innerJoin(s.users, eq(s.users.id, s.teacherRooms.teacherId)).where(eq(s.teacherRooms.roomId, row.room.id)).orderBy(asc(s.users.id)),
    db.select({ id: s.users.id, name: s.users.name }).from(s.users)
      .where(and(eq(s.users.role, "director"), eq(s.users.centerId, row.room.centerId))),
  ]);
  return { child: row.child, room: row.room, parents, teachers, directors };
}

/** "Sarah & David Carter" style list of names. */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  const lasts = names.map((n) => n.split(" ").slice(1).join(" "));
  if (lasts.every((l) => l && l === lasts[0])) return `${names.slice(0, -1).map((n) => n.split(" ")[0]).join(", ")} & ${names.at(-1)}`;
  return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}
