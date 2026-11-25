import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import type { User } from "./session";

// The director's bell. Teachers' work shows up here without the director having to look:
// reports sent (one alert per "send", not per child, to keep it quiet), new incidents, parent messages.

export async function alertReportsSent(t: User, kids: { firstName: string; lastName: string }[], roomName: string) {
  if (!kids.length) return;
  const db = await getDb();
  const names = kids.map((k) => `${k.firstName} ${k.lastName}`);
  await db.insert(s.staffAlerts).values({
    centerId: t.centerId, kind: "report_sent",
    title: kids.length === 1 ? `${t.name} sent ${kids[0].firstName}'s report` : `${t.name} sent ${kids.length} reports`,
    body: `${names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3} more` : names.join(", ")} · ${roomName} Room`,
    href: "/director/reports?status=sent",
  });
}

export async function alertIncident(t: User, childId: number, incidentId: number, serious: boolean) {
  const db = await getDb();
  const [c] = await db.select().from(s.children).where(eq(s.children.id, childId));
  await db.insert(s.staffAlerts).values({
    centerId: t.centerId, kind: "incident",
    title: serious ? `Serious incident: ${c.firstName} ${c.lastName}` : `Incident to approve: ${c.firstName} ${c.lastName}`,
    body: `Logged by ${t.name}. Parents see it only after you approve it.`,
    href: `/director/incidents/${incidentId}`,
  });
}
