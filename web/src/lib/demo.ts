import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";

export type ViewAsOption = {
  id: number;
  name: string;
  sub: string;      // children or rooms
  why: string;      // what this person is good for in the demo
  initials: string;
  bg: string;
  fg: string;
};

const initialsOf = (name: string) => {
  const parts = name.replace(/^(Ms|Mr|Mrs)\.\s*/, "").split(" ").filter(Boolean);
  // "Ms. Sara" → "SA", "Sarah Carter" → "SC"
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
};

// The people worth showing in the demo, each for a reason.
const FEATURED_TEACHERS = [
  { email: "sara@sunnydays.demo", why: "The main demo story" },
  { email: "leah@sunnydays.demo", why: "Shows the room switcher" },
];
const FEATURED_PARENTS = [
  { child: ["Emma", "Carter"], why: "2 children · has an incident to read" },
  { child: ["Owen", "Hayes"], why: "Hears about Owen's fall after approval" },
  { child: ["Maya", "Johnson"], why: "Serious incident · director calls first" },
];

export async function teacherOptions(currentId?: number | null): Promise<ViewAsOption[]> {
  const db = await getDb();
  const teachers = await db.select().from(s.users).where(eq(s.users.role, "teacher"));
  const assign = await db.select({ teacherId: s.teacherRooms.teacherId, room: s.rooms.name }).from(s.teacherRooms)
    .innerJoin(s.rooms, eq(s.rooms.id, s.teacherRooms.roomId));
  const make = (t: typeof teachers[number], why: string): ViewAsOption => {
    const rooms = assign.filter((a) => a.teacherId === t.id).map((a) => a.room);
    return {
      id: t.id, name: t.name, why, initials: initialsOf(t.name), bg: "#2F6F62", fg: "#FFFFFF",
      sub: rooms.length ? `${rooms.join(" & ")} Room${rooms.length > 1 ? "s" : ""}` : "No room yet",
    };
  };
  const list = FEATURED_TEACHERS.flatMap((f) => {
    const t = teachers.find((x) => x.email === f.email);
    return t ? [make(t, f.why)] : [];
  });
  // someone opened via "View as teacher" from the director app stays visible
  const cur = teachers.find((t) => t.id === currentId);
  if (cur && !list.some((o) => o.id === cur.id)) list.push(make(cur, "Opened from the director app"));
  return list;
}

export async function parentOptions(currentId?: number | null): Promise<ViewAsOption[]> {
  const db = await getDb();
  const links = await db.select({ parent: s.users, child: s.children }).from(s.childParents)
    .innerJoin(s.users, eq(s.users.id, s.childParents.parentId))
    .innerJoin(s.children, eq(s.children.id, s.childParents.childId));
  const kidsOf = (pid: number) => links.filter((l) => l.parent.id === pid).map((l) => l.child);
  const make = (p: typeof links[number]["parent"], why: string): ViewAsOption => {
    const kids = kidsOf(p.id);
    return {
      id: p.id, name: p.name, why, initials: initialsOf(p.name),
      bg: kids[0]?.avatarBg ?? "#F4EEE4", fg: kids[0]?.avatarFg ?? "#6B625B",
      sub: kids.length ? kids.map((k) => k.firstName).join(" & ") : "No child linked yet",
    };
  };
  const list: ViewAsOption[] = [];
  for (const f of FEATURED_PARENTS) {
    // first parent on file for that child
    const l = links.filter((x) => x.child.firstName === f.child[0] && x.child.lastName === f.child[1])
      .sort((a, b) => a.parent.id - b.parent.id)[0];
    if (l && !list.some((o) => o.id === l.parent.id)) list.push(make(l.parent, f.why));
  }
  if (currentId && !list.some((o) => o.id === currentId)) {
    const [p] = await db.select().from(s.users).where(and(eq(s.users.id, currentId), eq(s.users.role, "parent")));
    if (p) list.push(make(p, "Opened from the director app"));
  }
  return list;
}
