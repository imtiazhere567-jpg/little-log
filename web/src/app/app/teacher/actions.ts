"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { assertUser, audit } from "@/lib/session";
import { teacherCanSeeChild, teacherRooms, type Child } from "@/lib/data";
import { SAMPLES, type SampleItem } from "@/lib/samples";
import type { Draft } from "@/lib/parse-note";
import { buildReport } from "@/lib/report";
import { nowTime, todayStr } from "@/lib/time";
import { allowedFor, reportNotifications } from "@/lib/notify";
import { alertIncident, alertReportsSent } from "@/lib/alerts";
import type { EntryType } from "@/db/schema";

const ENTRY_TYPES: EntryType[] = ["meal", "nap", "diaper", "activity", "mood", "note"];

async function teacherAndRoom(roomId: number) {
  const t = await assertUser("teacher");
  const rooms = await teacherRooms(t.id);
  const room = rooms.find((r) => r.id === roomId);
  if (!room) throw new Error("Not your room");
  return { t, room };
}

// ---------- needs-review ----------
export async function resolveReview(fd: FormData) {
  const t = await assertUser("teacher");
  const entryId = Number(fd.get("entryId"));
  const childId = Number(fd.get("childId"));
  const db = await getDb();
  const [e] = await db.select().from(s.logEntries).where(eq(s.logEntries.id, entryId));
  if (!e || !(e.candidateIds ?? "").split(",").map(Number).includes(childId)) throw new Error("Invalid choice");
  if (!(await teacherCanSeeChild(t.id, childId))) throw new Error("Not your child");
  await db.update(s.logEntries).set({ childId, needsReview: false }).where(eq(s.logEntries.id, entryId));
  await audit(t.id, "resolved_name", "log_entries", entryId);
  revalidatePath("/app/teacher", "layout");
}

export async function skipReview(fd: FormData) {
  const t = await assertUser("teacher");
  const entryId = Number(fd.get("entryId"));
  const db = await getDb();
  const [e] = await db.select().from(s.logEntries).where(eq(s.logEntries.id, entryId));
  if (!e || !(await teacherRooms(t.id)).some((r) => r.id === e.roomId)) throw new Error("Not allowed");
  await db.delete(s.logEntries).where(eq(s.logEntries.id, entryId));
  await audit(t.id, "deleted", "log_entries", entryId);
  revalidatePath("/app/teacher", "layout");
}

// ---------- entries ----------
export async function deleteEntry(fd: FormData) {
  const t = await assertUser("teacher");
  const id = Number(fd.get("entryId"));
  const db = await getDb();
  const [e] = await db.select().from(s.logEntries).where(eq(s.logEntries.id, id));
  if (!e?.childId || !(await teacherCanSeeChild(t.id, e.childId))) throw new Error("Not allowed");
  await db.delete(s.logEntries).where(eq(s.logEntries.id, id));
  await audit(t.id, "deleted", "log_entries", id);
  revalidatePath("/app/teacher", "layout");
}

/** Validated fields shared by add + edit. Returns null when the entry is incomplete. */
function readEntry(fd: FormData) {
  const type = String(fd.get("type")) as EntryType;
  if (!ENTRY_TYPES.includes(type)) throw new Error("Bad type");
  const details = String(fd.get("details") ?? "").trim();
  const time = String(fd.get("time") || nowTime()).slice(0, 5);
  if (!details || !/^\d{2}:\d{2}$/.test(time)) return null;
  const endTime = type === "nap" ? String(fd.get("endTime") || "").slice(0, 5) || null : null;
  if (endTime && endTime <= time) throw new Error("The nap must end after it starts");
  const label = type === "meal" ? String(fd.get("label") || "Meal") : null;
  return { type, details, time, endTime, label };
}

export async function addEntry(fd: FormData) {
  const t = await assertUser("teacher");
  const childId = Number(fd.get("childId"));
  const child = await teacherCanSeeChild(t.id, childId);
  if (!child) throw new Error("Not your child");
  const e = readEntry(fd);
  if (!e) return;
  const db = await getDb();
  const [row] = await db.insert(s.logEntries).values({
    childId, roomId: child.roomId, ...e, date: todayStr(), createdBy: t.id,
  }).returning();
  await audit(t.id, "created", "log_entries", row.id);
  revalidatePath("/app/teacher", "layout");
}

export async function updateEntry(fd: FormData) {
  const t = await assertUser("teacher");
  const id = Number(fd.get("entryId"));
  const db = await getDb();
  const [old] = await db.select().from(s.logEntries).where(eq(s.logEntries.id, id));
  if (!old?.childId || !(await teacherCanSeeChild(t.id, old.childId))) throw new Error("Not allowed");
  const e = readEntry(fd);
  if (!e) return;
  await db.update(s.logEntries).set(e).where(eq(s.logEntries.id, id));
  await audit(t.id, "edited", "log_entries", id);
  revalidatePath("/app/teacher", "layout");
  redirect(`/app/teacher/child/${old.childId}?saved=1`);
}

// ---------- voice notes (demo AI) ----------
function matchChild(name: string, kids: Child[]) {
  const n = name.toLowerCase();
  const exact = kids.filter((k) => k.firstName.toLowerCase() === n);
  if (exact.length === 1) return { match: exact[0], candidates: exact };
  const prefix = kids.filter((k) => k.firstName.toLowerCase().startsWith(n));
  if (exact.length === 0 && prefix.length === 1) return { match: prefix[0], candidates: prefix };
  return { match: null, candidates: exact.length ? exact : prefix };
}

export type AnalyzedGroup = {
  name: string;
  childId: number | null;
  childName: string | null;
  candidates: { id: number; name: string }[];
  items: SampleItem[];
};

/** Simulates speech-to-text + AI sorting: returns per-child results for a sample note. */
export async function analyzeSample(sampleId: string, roomId: number): Promise<AnalyzedGroup[]> {
  const { room } = await teacherAndRoom(roomId);
  const sample = SAMPLES.find((x) => x.id === sampleId);
  if (!sample) throw new Error("Unknown sample");
  const db = await getDb();
  const kids = await db.select().from(s.children).where(eq(s.children.roomId, room.id));
  const groups = new Map<string, AnalyzedGroup>();
  for (const it of sample.items) {
    if (!groups.has(it.child)) {
      const m = matchChild(it.child, kids);
      groups.set(it.child, {
        name: it.child,
        childId: m.match?.id ?? null,
        childName: m.match ? `${m.match.firstName} ${m.match.lastName}` : null,
        candidates: m.candidates.map((k) => ({ id: k.id, name: `${k.firstName} ${k.lastName}` })),
        items: [],
      });
    }
    groups.get(it.child)!.items.push(it);
  }
  return [...groups.values()];
}

/** Saves a sample voice note. `choices` maps unclear names to the child the teacher picked. */
export async function saveSample(sampleId: string, roomId: number, choices: Record<string, number>) {
  const { t, room } = await teacherAndRoom(roomId);
  const sample = SAMPLES.find((x) => x.id === sampleId);
  if (!sample) throw new Error("Unknown sample");
  const groups = await analyzeSample(sampleId, roomId);
  const db = await getDb();
  const date = todayStr();
  const [vn] = await db.insert(s.voiceNotes).values({
    teacherId: t.id, roomId: room.id, transcript: sample.transcript, date, time: nowTime(),
  }).returning();

  let entries = 0, incidents = 0, reviews = 0;
  for (const g of groups) {
    const picked = choices[g.name];
    const childId = g.childId ?? (g.candidates.some((c) => c.id === picked) ? picked : null);
    for (const it of g.items) {
      if (it.type === "incident") {
        if (!childId) continue;
        const [inc] = await db.insert(s.incidents).values({
          childId, voiceNoteId: vn.id, date, time: it.time, location: it.location,
          description: it.description, injury: it.injury, bodyPart: it.bodyPart, actionTaken: it.actionTaken,
          staffId: t.id, isSerious: it.serious, callParentNow: it.callParentNow, status: "draft",
        }).returning();
        await audit(t.id, "created", "incidents", inc.id);
        await alertIncident(t, childId, inc.id, it.serious);
        incidents++;
        continue;
      }
      await db.insert(s.logEntries).values({
        childId, roomId: room.id, voiceNoteId: vn.id, type: it.type, label: it.label ?? null,
        details: it.details, date, time: it.time, endTime: it.endTime ?? null, createdBy: t.id,
        needsReview: childId === null, mentionedName: childId === null ? g.name : null,
        candidateIds: childId === null ? g.candidates.map((c) => c.id).join(",") : null,
      });
      if (childId) entries++; else reviews++;
    }
  }
  await audit(t.id, "created", "voice_notes", vn.id);
  revalidatePath("/app/teacher", "layout");
  return { entries, incidents, reviews };
}

// ---------- daily reports ----------
export async function sendReports(fd: FormData) {
  const t = await assertUser("teacher");
  const ids = String(fd.get("childIds") ?? "").split(",").map(Number).filter(Boolean);
  const db = await getDb();
  const date = todayStr();
  const rooms = await teacherRooms(t.id);
  const kids = ids.length ? await db.select().from(s.children).where(inArray(s.children.id, ids)) : [];
  const [center] = await db.select().from(s.centers).where(eq(s.centers.id, t.centerId));
  const sent: (typeof kids)[number][] = [];
  let sentRoom = "";

  for (const c of kids) {
    const room = rooms.find((r) => r.id === c.roomId);
    if (!room) continue; // only children in the teacher's rooms
    const entries = await db.select().from(s.logEntries)
      .where(and(eq(s.logEntries.childId, c.id), eq(s.logEntries.date, date)))
      .orderBy(asc(s.logEntries.time));
    if (!entries.length) continue;
    const content = JSON.stringify(buildReport({
      firstName: c.firstName, date, teacherName: t.name, roomName: room.name, entries, emojis: center.reportEmojis,
    }));
    const [existing] = await db.select().from(s.dailyReports)
      .where(and(eq(s.dailyReports.childId, c.id), eq(s.dailyReports.date, date)));
    if (existing?.status === "sent") continue;
    const sentAt = `${date}T${nowTime()}`;
    let reportId: number;
    if (existing) {
      await db.update(s.dailyReports).set({ content, status: "sent", approvedBy: t.id, sentAt })
        .where(eq(s.dailyReports.id, existing.id));
      reportId = existing.id;
    } else {
      const [row] = await db.insert(s.dailyReports).values({
        childId: c.id, date, content, status: "sent", approvedBy: t.id, sentAt,
      }).returning();
      reportId = row.id;
    }
    await audit(t.id, "approved_and_sent", "daily_reports", reportId);

    const parents = await db.select({ u: s.users }).from(s.childParents)
      .innerJoin(s.users, eq(s.users.id, s.childParents.parentId))
      .where(eq(s.childParents.childId, c.id));
    const notes = parents.flatMap(({ u }) => allowedFor(reportNotifications(u, c.firstName, reportId), center, u));
    if (notes.length) await db.insert(s.notifications).values(notes);
    sent.push(c);
    sentRoom = room.name;
  }
  await alertReportsSent(t, sent, sentRoom);
  revalidatePath("/", "layout");
  // confirmation: come back to the same screen with a "Sent!" sheet
  const back = String(fd.get("back") ?? "");
  if (sent.length && back.startsWith("/app/teacher")) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}sent=${sent.map((c) => c.id).join(",")}`);
  }
}

// ---------- one-child voice note (speak or type → check → save) ----------
export async function saveChildNote(input: { childId: number; transcript: string; drafts: Draft[] }) {
  const t = await assertUser("teacher");
  const child = await teacherCanSeeChild(t.id, Number(input.childId));
  if (!child) throw new Error("Not your child");
  const transcript = input.transcript.trim().slice(0, 4000);
  if (!transcript && !input.drafts.length) throw new Error("Nothing to save");
  const db = await getDb();
  // privacy, enforced on the server too: other children in the room become "a friend"
  const others = (await db.select({ n: s.children.firstName }).from(s.children).where(eq(s.children.roomId, child.roomId)))
    .map((r) => r.n).filter((n) => n !== child.firstName);
  const re = others.length ? new RegExp(`\\b(${others.map((n) => n.replace(/[^A-Za-z'-]/g, "")).join("|")})\\b`, "gi") : null;
  const safe = (v: unknown, max = 300) => { const x = String(v ?? "").trim().slice(0, max); return re ? x.replace(re, "a friend") : x; };
  const hhmm = (v: unknown) => (/^\d{2}:\d{2}$/.test(String(v)) ? String(v) : nowTime());

  const date = todayStr();
  const [vn] = await db.insert(s.voiceNotes).values({ teacherId: t.id, roomId: child.roomId, transcript: transcript || "(typed entries)", date, time: nowTime() }).returning();
  let entries = 0, incidents = 0;
  for (const d of input.drafts.slice(0, 20)) {
    if (d.kind === "incident") {
      const [inc] = await db.insert(s.incidents).values({
        childId: child.id, voiceNoteId: vn.id, date, time: hhmm(d.time), location: safe(d.location, 80) || "Classroom",
        description: safe(d.description) || "Not described", injury: safe(d.injury, 80) || "Minor injury",
        bodyPart: safe(d.bodyPart, 40) || "Not stated", actionTaken: safe(d.actionTaken) || "Comforted",
        staffId: t.id, isSerious: !!d.serious, callParentNow: !!d.callParentNow, status: "draft",
      }).returning();
      await audit(t.id, "created", "incidents", inc.id);
      await alertIncident(t, child.id, inc.id, !!d.serious);
      incidents++;
      continue;
    }
    if (!ENTRY_TYPES.includes(d.type)) continue;
    const details = safe(d.details);
    if (!details) continue;
    const time = hhmm(d.time);
    const endTime = d.type === "nap" && d.endTime && /^\d{2}:\d{2}$/.test(d.endTime) && d.endTime > time ? d.endTime : null;
    await db.insert(s.logEntries).values({
      childId: child.id, roomId: child.roomId, voiceNoteId: vn.id, type: d.type,
      label: d.type === "meal" ? safe(d.label, 40) || "Meal" : null, details, date, time, endTime, createdBy: t.id,
    });
    entries++;
  }
  await audit(t.id, "created", "voice_notes", vn.id);
  revalidatePath("/app/teacher", "layout");
  return { entries, incidents };
}
