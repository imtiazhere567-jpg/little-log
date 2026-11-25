import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { currentUser } from "@/lib/session";
import { fmtDate } from "@/lib/time";

type Hit = { group: string; title: string; sub: string; href: string };

// Director-wide search: children, parents, teachers and incidents.
export async function GET(req: NextRequest) {
  const director = await currentUser("director");
  if (!director) return NextResponse.json({ hits: [] }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ hits: [] });
  const has = (...v: (string | null | undefined)[]) => v.some((x) => x?.toLowerCase().includes(q));

  const db = await getDb();
  const [kids, users, incs, links] = await Promise.all([
    db.select({ c: s.children, r: s.rooms }).from(s.children).innerJoin(s.rooms, eq(s.rooms.id, s.children.roomId))
      .where(eq(s.rooms.centerId, director.centerId)),
    db.select().from(s.users).where(eq(s.users.centerId, director.centerId)),
    db.select({ i: s.incidents, c: s.children }).from(s.incidents).innerJoin(s.children, eq(s.children.id, s.incidents.childId))
      .orderBy(desc(s.incidents.date)),
    db.select({ parentId: s.childParents.parentId, childId: s.childParents.childId, first: s.children.firstName })
      .from(s.childParents).innerJoin(s.children, eq(s.children.id, s.childParents.childId)),
  ]);

  const hits: Hit[] = [
    ...kids.filter(({ c }) => has(`${c.firstName} ${c.lastName}`)).slice(0, 5).map(({ c, r }) => ({
      group: "Children", title: `${c.firstName} ${c.lastName}`, sub: `${r.name} Room`, href: `/director/children/${c.id}`,
    })),
    // a parent opens on their (first) child's profile, with their edit panel ready
    ...users.filter((u) => u.role === "parent" && has(u.name, u.email, u.phone)).slice(0, 4).map((u) => {
      const mine = links.filter((l) => l.parentId === u.id);
      return {
        group: "Parents", title: u.name,
        sub: mine.length ? `Parent of ${mine.map((l) => l.first).join(" & ")}` : u.email,
        href: mine.length ? `/director/children/${mine[0].childId}?editParent=${u.id}` : "/director/children",
      };
    }),
    ...users.filter((u) => u.role === "teacher" && has(u.name, u.email)).slice(0, 3).map((u) => ({
      group: "Teachers", title: u.name, sub: u.email, href: `/director/teachers?edit=${u.id}`,
    })),
    ...incs.filter(({ i, c }) => has(`${c.firstName} ${c.lastName}`, i.injury, i.location)).slice(0, 4).map(({ i, c }) => ({
      group: "Incidents", title: `${c.firstName} · ${i.injury}`, sub: `${fmtDate(i.date)} · ${i.status === "draft" ? "awaiting approval" : i.status}`,
      href: `/director/incidents/${i.id}`,
    })),
  ];
  return NextResponse.json({ hits });
}
