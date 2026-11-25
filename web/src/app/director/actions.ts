"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { assertUser, audit } from "@/lib/session";
import { allowedFor, incidentNotifications } from "@/lib/notify";
import { nowStamp } from "@/lib/time";

const FIELDS = ["location", "description", "injury", "bodyPart", "actionTaken"] as const;

export async function decideIncident(fd: FormData) {
  const director = await assertUser("director");
  const id = Number(fd.get("id"));
  const decision = String(fd.get("decision"));
  if (decision !== "approve" && decision !== "reject") throw new Error("Bad decision");
  const db = await getDb();
  const [inc] = await db.select().from(s.incidents).where(eq(s.incidents.id, id));
  if (!inc || inc.status !== "draft") throw new Error("Already decided");

  // The director may correct the draft before deciding.
  const edits: Partial<typeof s.incidents.$inferInsert> = {};
  for (const f of FIELDS) {
    const v = fd.get(f);
    if (typeof v === "string" && v.trim()) edits[f] = v.trim();
  }
  const decidedAt = nowStamp();
  await db.update(s.incidents).set({
    ...edits,
    status: decision === "approve" ? "approved" : "rejected",
    approvedBy: director.id,
    decidedAt,
  }).where(eq(s.incidents.id, id));
  await audit(director.id, decision === "approve" ? "approved" : "rejected", "incidents", id);

  // Only after approval does the parent hear about it.
  if (decision === "approve") {
    const [child] = await db.select().from(s.children).where(eq(s.children.id, inc.childId));
    const parents = await db.select({ u: s.users }).from(s.childParents)
      .innerJoin(s.users, eq(s.users.id, s.childParents.parentId))
      .where(eq(s.childParents.childId, inc.childId));
    const [center] = await db.select().from(s.centers).where(eq(s.centers.id, director.centerId));
    const notes = parents.flatMap(({ u }) => allowedFor(incidentNotifications(u, child.firstName, id), center, u));
    if (notes.length) await db.insert(s.notifications).values(notes);
  }
  revalidatePath("/", "layout");
  redirect(`/director/incidents?done=${decision}`);
}
