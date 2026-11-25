import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema as s } from "@/db";

/** Reading something in one app clears that app's notification for it (other apps keep theirs). */
export async function markReadServer(parentId: number, where: {
  channel?: "whatsapp" | "email" | "push"; id?: number; recordId?: number; kind?: "daily_report" | "incident" | "message" | "attendance";
}) {
  const db = await getDb();
  const conds = [eq(s.notifications.parentId, parentId), isNull(s.notifications.readAt)];
  if (where.id) conds.push(eq(s.notifications.id, where.id));
  if (where.channel) conds.push(eq(s.notifications.channel, where.channel));
  if (where.recordId) conds.push(eq(s.notifications.recordId, where.recordId));
  if (where.kind) conds.push(eq(s.notifications.kind, where.kind));
  await db.update(s.notifications).set({ readAt: new Date() }).where(and(...conds));
}
