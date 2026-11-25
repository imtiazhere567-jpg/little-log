"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { assertUser, audit } from "@/lib/session";
import { setCenterTz, todayStr } from "@/lib/time";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const ids = (fd: FormData, k: string) => fd.getAll(k).map(Number).filter(Boolean);

const AVATARS: [string, string][] = [
  ["#FBEBD9", "#9A5414"], ["#E6E9F6", "#3B4C8F"], ["#DDF0F2", "#256A74"], ["#EFE6F6", "#663F8A"],
  ["#F7F0D2", "#7A6410"], ["#E3F0EC", "#2F6F62"], ["#FCE3DC", "#9A3F2A"], ["#E9EEDC", "#4F6A26"],
];

async function director() {
  const d = await assertUser("director");
  return d;
}

async function roomInCenter(roomId: number, centerId: number) {
  const db = await getDb();
  const [r] = await db.select().from(s.rooms).where(and(eq(s.rooms.id, roomId), eq(s.rooms.centerId, centerId)));
  if (!r) throw new Error("Unknown room");
  return r;
}

// ---------- children ----------
export async function saveChild(fd: FormData) {
  const d = await director();
  const db = await getDb();
  const id = Number(fd.get("id")) || null;
  const firstName = str(fd, "firstName"), lastName = str(fd, "lastName"), dob = str(fd, "dateOfBirth");
  if (!firstName || !lastName || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) throw new Error("Name and date of birth are required");
  const room = await roomInCenter(Number(fd.get("roomId")), d.centerId);
  const values = {
    firstName, lastName, dateOfBirth: dob, roomId: room.id, photoConsent: fd.get("photoConsent") === "on",
    medicalNotes: str(fd, "medicalNotes") || null,
  };
  let childId: number;
  if (id) {
    await db.update(s.children).set(values).where(eq(s.children.id, id));
    childId = id;
    await audit(d.id, "edited", "children", id);
  } else {
    const [bg, fg] = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const [row] = await db.insert(s.children).values({ ...values, avatarBg: bg, avatarFg: fg }).returning();
    childId = row.id;
    await audit(d.id, "created", "children", childId);
  }
  // parent links (max 2 per the spec)
  const parentIds = ids(fd, "parentIds").slice(0, 2);
  const before = await db.select().from(s.childParents).where(eq(s.childParents.childId, childId));
  await db.delete(s.childParents).where(eq(s.childParents.childId, childId));
  if (parentIds.length) await db.insert(s.childParents).values(parentIds.map((p) => ({
    childId, parentId: p, relationship: before.find((b) => b.parentId === p)?.relationship ?? null, // keep "Mother", "Father"…
  })));
  revalidatePath("/", "layout");
  redirect(`/director/children/${childId}?saved=1`);
}

// ---------- parents (edited from the child's profile) ----------
export async function saveParent(fd: FormData) {
  const d = await director();
  const db = await getDb();
  const id = Number(fd.get("id"));
  const childId = Number(fd.get("childId"));
  const name = str(fd, "name"), email = str(fd, "email").toLowerCase(), phone = str(fd, "phone") || null;
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Name and a valid email are required");
  const [p] = await db.select().from(s.users).where(and(eq(s.users.id, id), eq(s.users.role, "parent"), eq(s.users.centerId, d.centerId)));
  if (!p) throw new Error("Unknown parent");
  await db.update(s.users).set({ name, email, phone, whatsappOptIn: fd.get("whatsapp") === "on" }).where(eq(s.users.id, id));
  // the relationship belongs to this child-parent pair (a grandparent may be "Mother" to no one)
  if (childId) {
    await db.update(s.childParents).set({ relationship: str(fd, "relationship") || null })
      .where(and(eq(s.childParents.childId, childId), eq(s.childParents.parentId, id)));
  }
  await audit(d.id, "edited", "users", id);
  revalidatePath("/", "layout");
  redirect(childId ? `/director/children/${childId}?tab=family&saved=parent` : "/director/children");
}

// ---------- teachers ----------
export async function saveTeacher(fd: FormData) {
  const d = await director();
  const db = await getDb();
  const id = Number(fd.get("id")) || null;
  const name = str(fd, "name"), email = str(fd, "email");
  if (!name || !email.includes("@")) throw new Error("Name and a valid email are required");
  let teacherId: number;
  if (id) {
    const [t] = await db.select().from(s.users).where(and(eq(s.users.id, id), eq(s.users.role, "teacher")));
    if (!t) throw new Error("Unknown teacher");
    await db.update(s.users).set({ name, email }).where(eq(s.users.id, id));
    teacherId = id;
    await audit(d.id, "edited", "users", id);
  } else {
    const [row] = await db.insert(s.users).values({ centerId: d.centerId, role: "teacher", name, email }).returning();
    teacherId = row.id;
    await audit(d.id, "created", "users", teacherId);
  }
  const roomIds = ids(fd, "roomIds");
  const valid = roomIds.length
    ? (await db.select().from(s.rooms).where(and(inArray(s.rooms.id, roomIds), eq(s.rooms.centerId, d.centerId)))).map((r) => r.id)
    : [];
  await db.delete(s.teacherRooms).where(eq(s.teacherRooms.teacherId, teacherId));
  if (valid.length) await db.insert(s.teacherRooms).values(valid.map((r) => ({ teacherId, roomId: r })));
  revalidatePath("/", "layout");
  redirect(`/director/teachers?saved=${teacherId}`);
}

// ---------- settings (one form per Settings tab) ----------
const TIME = /^\d{2}:\d{2}$/;
export async function saveSettings(fd: FormData) {
  const d = await director();
  const db = await getDb();
  const section = str(fd, "section");
  const on = (k: string) => fd.get(k) === "on";
  let values: Partial<typeof s.centers.$inferInsert> = {};

  switch (section) {
    case "general": {
      const name = str(fd, "name"), timezone = str(fd, "timezone");
      if (!name) throw new Error("Center name is required");
      try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); } catch { throw new Error("Unknown time zone"); }
      values = { name, timezone, address: str(fd, "address") || null, phone: str(fd, "phone") || null,
        email: str(fd, "email") || null, licenseNo: str(fd, "licenseNo") || null };
      setCenterTz(timezone);
      break;
    }
    case "hours": {
      const opensAt = str(fd, "opensAt"), closesAt = str(fd, "closesAt");
      if (!TIME.test(opensAt) || !TIME.test(closesAt) || opensAt >= closesAt) throw new Error("Opening must be before closing");
      const days = fd.getAll("schoolDays").map(String).filter((x) => /^[0-6]$/.test(x));
      values = { opensAt, closesAt, schoolDays: days.join(",") || "1,2,3,4,5" };
      break;
    }
    case "reports": {
      const reportSendTime = str(fd, "reportSendTime");
      if (!TIME.test(reportSendTime)) throw new Error("Send time is required");
      values = { reportSendTime, teacherReview: on("teacherReview"), reportEmojis: on("reportEmojis") };
      break;
    }
    case "notifications":
      values = { notifyWhatsapp: on("notifyWhatsapp"), notifyEmail: on("notifyEmail"), notifyPush: on("notifyPush"), notifySms: on("notifySms") };
      break;
    case "incidents":
      values = { incidentReminderMin: Math.min(240, Math.max(0, Number(fd.get("incidentReminderMin")) || 0)) };
      break;
    case "privacy":
      values = { deleteRecordings: on("deleteRecordings"), retentionYears: Math.min(25, Math.max(1, Number(fd.get("retentionYears")) || 5)) };
      break;
    default:
      throw new Error("Unknown settings section");
  }
  await db.update(s.centers).set(values).where(eq(s.centers.id, d.centerId));
  await audit(d.id, `edited_settings_${section}`, "centers", d.centerId);
  revalidatePath("/", "layout");
  redirect(`/director/settings?section=${section}&saved=1`);
}

// ---------- enrollment: one child + their parents in a single step ----------
export type EnrollParent =
  | { mode: "existing"; id: number; relationship: string }
  | { mode: "new"; name: string; email: string; phone: string; relationship: string; whatsapp: boolean };

export type EnrollInput = {
  child: { firstName: string; lastName: string; dateOfBirth: string; roomId: number; medicalNotes: string; expectedIn?: string; expectedOut?: string };
  parents: EnrollParent[];
  photoConsent: boolean;
  pickups?: { name: string; relationship: string; phone: string }[];
};

export async function enrollFamily(input: EnrollInput): Promise<{ ok: true; childId: number; parentIds: number[] } | { ok: false; error: string }> {
  const d = await director();
  const db = await getDb();
  const c = input.child;
  const firstName = c.firstName.trim(), lastName = c.lastName.trim();
  if (!firstName || !lastName) return { ok: false, error: "The child's first and last name are required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.dateOfBirth)) return { ok: false, error: "Please enter a valid date of birth." };
  if (!input.parents.length || input.parents.length > 2) return { ok: false, error: "Add one or two parents." };
  const room = await roomInCenter(Number(c.roomId), d.centerId).catch(() => null);
  if (!room) return { ok: false, error: "Please choose a room." };
  const hhmm = (v: string | undefined, def: string) => (v && /^\d{2}:\d{2}$/.test(v) ? v : def);
  const expectedIn = hhmm(c.expectedIn, "08:00"), expectedOut = hhmm(c.expectedOut, "17:00");
  if (expectedOut <= expectedIn) return { ok: false, error: "The usual pick-up time must be after drop-off." };
  const pickups = (input.pickups ?? []).slice(0, 4).map((p) => ({ name: p.name.trim().slice(0, 80), relationship: p.relationship.trim().slice(0, 40) || "Other", phone: p.phone.trim().slice(0, 30) || null }));
  if (pickups.some((p) => !p.name)) return { ok: false, error: "Each pickup person needs a name." };

  // resolve parents first, so nothing is written if one is invalid
  const resolved: { id?: number; create?: typeof s.users.$inferInsert; relationship: string }[] = [];
  for (const p of input.parents) {
    if (p.mode === "existing") {
      const [u] = await db.select().from(s.users).where(and(eq(s.users.id, p.id), eq(s.users.role, "parent")));
      if (!u) return { ok: false, error: "One of the chosen parents no longer exists." };
      resolved.push({ id: u.id, relationship: p.relationship });
    } else {
      const name = p.name.trim(), email = p.email.trim().toLowerCase();
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: `Each new parent needs a name and a valid email.` };
      // same email already on file → link that parent instead of creating a duplicate
      const [dup] = await db.select().from(s.users).where(and(eq(s.users.email, email), eq(s.users.role, "parent")));
      if (dup) resolved.push({ id: dup.id, relationship: p.relationship });
      else resolved.push({ create: { centerId: d.centerId, role: "parent", name, email, phone: p.phone.trim() || null, whatsappOptIn: p.whatsapp }, relationship: p.relationship });
    }
  }
  if (resolved.filter((r) => r.id).length !== new Set(resolved.filter((r) => r.id).map((r) => r.id)).size) {
    return { ok: false, error: "The same parent was added twice." };
  }

  const [bg, fg] = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  const [child] = await db.insert(s.children).values({
    roomId: room.id, firstName, lastName, dateOfBirth: c.dateOfBirth, photoConsent: input.photoConsent,
    medicalNotes: c.medicalNotes.trim() || null, avatarBg: bg, avatarFg: fg, enrolledOn: todayStr(), expectedIn, expectedOut,
  }).returning();
  if (pickups.length) await db.insert(s.pickups).values(pickups.map((p) => ({ ...p, childId: child.id })));
  await audit(d.id, "enrolled", "children", child.id);

  const parentIds: number[] = [];
  for (const r of resolved) {
    let id = r.id;
    if (!id && r.create) {
      const [u] = await db.insert(s.users).values(r.create).returning();
      id = u.id;
      await audit(d.id, "created", "users", id);
    }
    await db.insert(s.childParents).values({ childId: child.id, parentId: id!, relationship: r.relationship || null });
    parentIds.push(id!);
  }
  revalidatePath("/", "layout");
  return { ok: true, childId: child.id, parentIds };
}
