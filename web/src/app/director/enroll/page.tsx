import { asc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { todayStr } from "@/lib/time";
import EnrollWizard from "./EnrollWizard";

export const metadata = { title: "Enroll a child · Littlelog" };

/** "6–12 months" → [6, 12]; "1–2 years" → [12, 23]; "3–5 years" → [36, 59] (months, inclusive) */
function monthsRange(ageGroup: string): [number, number] {
  const m = ageGroup.match(/(\d+)\s*[–-]\s*(\d+)\s*(month|year)/i);
  if (!m) return [0, 999];
  const [a, b] = [Number(m[1]), Number(m[2])];
  return m[3].toLowerCase().startsWith("month") ? [a, b] : [a * 12, b * 12 - 1];
}

export default async function EnrollPage() {
  const director = await requireUser("director");
  const db = await getDb();
  const rooms = await db.select().from(s.rooms).where(eq(s.rooms.centerId, director.centerId)).orderBy(asc(s.rooms.id));
  const kids = await db.select({ id: s.children.id, roomId: s.children.roomId, firstName: s.children.firstName }).from(s.children);
  const parents = await db.select().from(s.users).where(eq(s.users.role, "parent")).orderBy(asc(s.users.name));
  const links = await db.select({ parentId: s.childParents.parentId, childId: s.childParents.childId }).from(s.childParents);

  return (
    <EnrollWizard
      today={todayStr()}
      rooms={rooms.map((r) => ({
        id: r.id, name: r.name, ageGroup: r.ageGroup, color: r.color,
        months: monthsRange(r.ageGroup), count: kids.filter((k) => k.roomId === r.id).length,
      }))}
      parents={parents.map((p) => ({
        id: p.id, name: p.name, email: p.email, phone: p.phone ?? "",
        children: links.filter((l) => l.parentId === p.id).map((l) => kids.find((k) => k.id === l.childId)?.firstName).filter(Boolean) as string[],
      }))}
    />
  );
}
