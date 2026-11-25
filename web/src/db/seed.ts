import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "./index";
import * as s from "./schema";
import type { EntryType } from "./schema";
import { buildReport } from "@/lib/report";
import { addDays, centerTz, todayStr, weekday, zoned } from "@/lib/time";
import { incidentNotifications, reportNotifications } from "@/lib/notify";

// Small deterministic random generator so the demo looks the same after every reset.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AVATARS: [string, string][] = [
  ["#FBEBD9", "#9A5414"], ["#E6E9F6", "#3B4C8F"], ["#DDF0F2", "#256A74"],
  ["#EFE6F6", "#663F8A"], ["#F7F0D2", "#7A6410"], ["#E3F0EC", "#2F6F62"],
  ["#FCE3DC", "#9A3F2A"], ["#E9EEDC", "#4F6A26"],
];

type RoomDef = {
  name: string; ageGroup: string; color: string; ageMonths: [number, number];
  kids: [string, string][];
};

const ROOMS: RoomDef[] = [
  { name: "Sunflower", ageGroup: "Toddlers · 1–2 years", color: "#E8955A", ageMonths: [13, 23],
    kids: [["Emma", "Carter"], ["Owen", "Hayes"], ["Samuel", "Ortiz"], ["Samantha", "Price"],
      ["Ivy", "Cooper"], ["Noah", "Reed"], ["Lily", "Chen"], ["Henry", "Walker"]] },
  { name: "Bluebird", ageGroup: "Infants · 6–12 months", color: "#5B6FB5", ageMonths: [6, 12],
    kids: [["Ava", "Nguyen"], ["Ethan", "Brooks"], ["Mila", "Rossi"], ["Liam", "Foster"],
      ["Chloe", "Martin"], ["Aria", "Collins"], ["Lucas", "Silva"], ["Hana", "Sato"]] },
  { name: "Ladybug", ageGroup: "Twos · 2–3 years", color: "#8A5FB0", ageMonths: [24, 35],
    kids: [["Isla", "Turner"], ["Mason", "Wright"], ["Ella", "Morgan"], ["Jack", "Garcia"],
      ["Ruby", "Evans"], ["Felix", "Hart"], ["Nora", "Hughes"], ["Theo", "Walsh"]] },
  { name: "Rainbow", ageGroup: "Pre-K · 3–5 years", color: "#2F6F62", ageMonths: [38, 58],
    kids: [["Leo", "Carter"], ["Maya", "Johnson"], ["Adam", "Reynolds"], ["Sofia", "Romano"],
      ["Daniel", "Park"], ["Amelia", "Ward"], ["Oliver", "Grant"], ["Zoe", "Mitchell"]] },
];

const TEACHERS = [
  { name: "Ms. Sara", full: "Sara Thompson", email: "sara@sunnydays.demo", rooms: ["Sunflower"] },
  { name: "Ms. Maya", full: "Maya Lopez", email: "maya@sunnydays.demo", rooms: ["Bluebird"] },
  { name: "Ms. Grace", full: "Grace Bailey", email: "grace@sunnydays.demo", rooms: ["Ladybug"] },
  { name: "Ms. Claire", full: "Claire Dawson", email: "claire@sunnydays.demo", rooms: ["Rainbow"] },
  { name: "Ms. Leah", full: "Leah Kim", email: "leah@sunnydays.demo", rooms: ["Ladybug", "Rainbow"] },
];

const PARENT_FIRST = ["Hannah", "Michael", "Rosa", "Jessica", "Tom", "Mei", "Andrew", "Laura", "Kenji",
  "Emily", "Chris", "Sophie", "Peter", "Rachel", "Mark", "Elena", "James", "Julia", "Ryan", "Anna",
  "Sam", "Megan", "Ben", "Grace", "Steven", "Kate", "Olivia", "Paul", "Natalie", "Dan"];

const ACTIVITIES = ["Finger painting", "Story time on the rug", "Sensory bin with rice and scoops",
  "Building a tower with wooden blocks", "Outdoor play in the sandbox", "Singing and dancing",
  "Playdough shapes", "Water play", "Stacking cups", "Bubble play outside", "Puzzle time",
  "Watering the class plants", "Music with shakers", "Drawing with crayons"];
const ACT_SOCIAL = ["with a friend", "with friends", ""];
const PREK_ACTS = ["Letter tracing", "Counting games", "Science: sink or float", "Painting at the easel",
  "Garden walk", "Building a block city", "Dress-up play", "Puppet show", "Yoga for kids", "Cutting practice with safe scissors"];
const AMOUNTS = ["Ate all of it", "Ate most of it", "Ate half", "Ate a little"];
const MOODS = ["Happy and playful", "Calm and cheerful", "Curious and busy", "Happy", "A little tired after nap, then cheerful", "Very chatty today"];
const SNACKS = ["Apple slices", "Banana and crackers", "Yogurt", "Cheese and crackers", "Pear slices", "Rice cakes"];
const LUNCHES = ["Pasta with veggies", "Rice and lentils", "Chicken and rice", "Mac and cheese with peas", "Veggie soup and bread", "Fish and potatoes"];

type NewEntry = typeof s.logEntries.$inferInsert;

export async function seedDemoData(db: Db) {
  const r = rng(20261124);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const today = todayStr();

  // ---------- center, staff, rooms ----------
  const [center] = await db.insert(s.centers).values({
    name: "Sunny Days Childcare", timezone: centerTz(),
    address: "48 Willow Street, Brooklyn, NY 11201", phone: "+1 555 0100",
    email: "hello@sunnydays.demo", licenseNo: "DC-482119",
  }).returning();
  const cid = center.id;

  const [director] = await db.insert(s.users).values({
    centerId: cid, name: "Maria Bennett", email: "maria@sunnydays.demo", role: "director", phone: "+1 555 0100",
  }).returning();

  const roomRows = await db.insert(s.rooms)
    .values(ROOMS.map((rm) => ({ centerId: cid, name: rm.name, ageGroup: rm.ageGroup, color: rm.color })))
    .returning();
  const roomByName = new Map(roomRows.map((x) => [x.name, x]));

  const teacherRows = await db.insert(s.users)
    .values(TEACHERS.map((t) => ({ centerId: cid, name: t.name, email: t.email, role: "teacher" as const })))
    .returning();
  const teacherRoomPairs = TEACHERS.flatMap((t, i) =>
    t.rooms.map((rn) => ({ teacherId: teacherRows[i].id, roomId: roomByName.get(rn)!.id })));
  await db.insert(s.teacherRooms).values(teacherRoomPairs);
  const leadTeacher = new Map<number, typeof teacherRows[number]>();
  for (const [i, t] of TEACHERS.entries()) {
    const rid = roomByName.get(t.rooms[0])!.id;
    if (!leadTeacher.has(rid)) leadTeacher.set(rid, teacherRows[i]);
  }

  // ---------- children ----------
  const childValues = ROOMS.flatMap((rm, ri) =>
    rm.kids.map(([first, last], ki) => {
      const months = rm.ageMonths[0] + Math.floor(r() * (rm.ageMonths[1] - rm.ageMonths[0] + 1));
      const dob = addDays(today, -Math.round(months * 30.4) - Math.floor(r() * 20));
      const [bg, fg] = AVATARS[(ri * 3 + ki) % AVATARS.length];
      // enrolled somewhere between 6 months of age and ~3 weeks ago
      const ageDays = Math.round(months * 30.4);
      const enrolledDaysAgo = Math.max(21, Math.floor(r() * Math.max(30, ageDays - 183)));
      return {
        roomId: roomByName.get(rm.name)!.id, firstName: first, lastName: last,
        dateOfBirth: dob, photoConsent: r() > 0.6, avatarBg: bg, avatarFg: fg,
        enrolledOn: addDays(today, -enrolledDaysAgo),
      };
    }));
  const kids = await db.insert(s.children).values(childValues).returning();
  const kid = (first: string, last?: string) =>
    kids.find((k) => k.firstName === first && (!last || k.lastName === last))!;

  // ---------- parents ----------
  // Demo parent: Sarah Carter has 2 children (Emma in Sunflower, Leo in Rainbow).
  const parentValues: (typeof s.users.$inferInsert)[] = [];
  const links: { childId: number; parentKey: number; relationship?: string }[] = [];
  const addParent = (name: string) => {
    parentValues.push({
      centerId: cid, name, role: "parent",
      email: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com",
      phone: `+1 555 ${String(1000 + parentValues.length).slice(-4)}`,
    });
    return parentValues.length - 1;
  };
  const sarah = addParent("Sarah Carter");
  const david = addParent("David Carter");
  for (const c of [kid("Emma", "Carter"), kid("Leo", "Carter")]) {
    links.push({ childId: c.id, parentKey: sarah, relationship: "Mother" }, { childId: c.id, parentKey: david, relationship: "Father" });
  }
  let pi = 0;
  for (const c of kids) {
    if (c.lastName === "Carter") continue;
    const p1 = addParent(`${PARENT_FIRST[pi++ % PARENT_FIRST.length]} ${c.lastName}`);
    links.push({ childId: c.id, parentKey: p1 });
    if (r() > 0.55) {
      const p2 = addParent(`${PARENT_FIRST[pi++ % PARENT_FIRST.length]} ${c.lastName}`);
      links.push({ childId: c.id, parentKey: p2 });
    }
  }
  const parents = await db.insert(s.users).values(parentValues).returning();
  // a parent's account starts when their first child was enrolled
  for (const [i, u] of parents.entries()) {
    const firstEnrolled = links.filter((l) => l.parentKey === i)
      .map((l) => kids.find((k) => k.id === l.childId)?.enrolledOn).filter(Boolean).sort()[0];
    if (firstEnrolled) await db.update(s.users).set({ createdAt: zoned(firstEnrolled, `09:${String(10 + (i % 40)).padStart(2, "0")}`) }).where(eq(s.users.id, u.id));
  }
  await db.insert(s.childParents).values(links.map((l) => ({ childId: l.childId, parentId: parents[l.parentKey].id, relationship: l.relationship ?? null })));
  await db.update(s.children).set({ medicalNotes: "Mild dairy allergy: oat milk only. No other known conditions." }).where(eq(s.children.id, kid("Emma", "Carter").id));

  // ---------- history: last 10 weekdays ----------
  const pastDays: string[] = [];
  for (let d = 1; pastDays.length < 10; d++) {
    const day = addDays(today, -d);
    const wd = weekday(day);
    if (wd !== 0 && wd !== 6) pastDays.push(day);
  }

  const allEntries: NewEntry[] = [];
  const reportsToInsert: (typeof s.dailyReports.$inferInsert)[] = [];
  const roomOf = new Map(roomRows.map((x) => [x.id, x]));

  const dayEntries = (c: typeof kids[number], date: string): NewEntry[] => {
    const room = roomOf.get(c.roomId)!;
    const by = leadTeacher.get(c.roomId)!.id;
    const base = { childId: c.id, roomId: c.roomId, date, createdBy: by };
    const out: NewEntry[] = [];
    const add = (type: EntryType, details: string, time: string, extra: Partial<NewEntry> = {}) =>
      out.push({ ...base, type, details, time, ...extra });
    const t = (h: number, mStart = 0, mSpan = 30) =>
      `${String(h).padStart(2, "0")}:${String(mStart + Math.floor(r() * mSpan / 5) * 5).padStart(2, "0")}`;

    if (room.name === "Bluebird") {
      add("meal", `Bottle, ${pick(["finished it", "drank most of it", "drank about half"])}`, t(9), { label: "Bottle" });
      add("meal", `Puree: ${pick(["sweet potato", "carrot", "apple", "pea"])}, ${pick(["ate all of it", "ate most of it"])}`, t(11, 15), { label: "Lunch" });
      add("meal", `Bottle, ${pick(["finished it", "drank most of it"])}`, t(14), { label: "Bottle" });
      add("nap", "Nap", t(9, 30), { endTime: t(10, 30) });
      add("nap", "Nap", t(12, 30), { endTime: t(14) });
      for (const h of [8, 10, 13, 15]) add("diaper", pick(["Wet", "Wet", "Dirty", "Dry"]), t(h));
      add("activity", pick(["Tummy time on the play mat", "Looking at picture books", "Rolling a soft ball", "Music time with rattles", "Sensory bottles"]), t(10, 30));
      add("mood", pick(["Smiley and calm", "Happy and babbling", "Calm and content"]), t(15));
      return out;
    }
    const prek = room.name === "Rainbow";
    add("meal", `${pick(SNACKS)}: ${pick(AMOUNTS).toLowerCase()}`, t(9, 15), { label: "Morning snack" });
    add("meal", `${pick(LUNCHES)}: ${pick(AMOUNTS).toLowerCase()}`, t(11, 45, 15), { label: "Lunch" });
    if (!prek || r() > 0.4) add("nap", "Nap", t(12, 15), { endTime: t(13, 30) });
    const changes = prek ? 2 : 2 + Math.floor(r() * 2);
    for (let i = 0; i < changes; i++) add("diaper", prek ? "Used the toilet" : pick(["Wet", "Wet", "Dirty"]), t(9 + i * 3));
    const social = pick(ACT_SOCIAL);
    add("activity", `${pick(prek ? PREK_ACTS : ACTIVITIES)}${social ? " " + social : ""}`, t(10));
    if (r() > 0.5) add("activity", pick(prek ? PREK_ACTS : ACTIVITIES), t(15));
    add("mood", pick(MOODS), t(15, 30));
    return out;
  };

  for (const date of pastDays) {
    for (const c of kids) {
      const entries = dayEntries(c, date);
      allEntries.push(...entries);
      const room = roomOf.get(c.roomId)!;
      const teacher = leadTeacher.get(c.roomId)!;
      const content = buildReport({
        firstName: c.firstName, date, teacherName: teacher.name, roomName: room.name,
        entries: entries.map((e) => ({ type: e.type, label: e.label ?? null, details: e.details, time: e.time, endTime: e.endTime ?? null })),
      });
      reportsToInsert.push({
        childId: c.id, date, content: JSON.stringify(content), status: "sent",
        approvedBy: teacher.id, sentAt: `${date}T16:${30 + Math.floor(r() * 9)}`,
      });
    }
  }

  // ---------- today ----------
  const sara = teacherRows[0];
  const sun = roomByName.get("Sunflower")!;
  const T = (c: typeof kids[number], type: EntryType, details: string, time: string, extra: Partial<NewEntry> = {}): NewEntry =>
    ({ childId: c.id, roomId: c.roomId, date: today, createdBy: leadTeacher.get(c.roomId)!.id, type, details, time, ...extra });

  const [vn1, vn2, vn3] = await db.insert(s.voiceNotes).values([
    { teacherId: sara.id, roomId: sun.id, date: today, time: "09:42",
      transcript: "Snack time. Emma ate most of her banana and crackers, Owen had about half his, Samantha and Lily finished everything." },
    { teacherId: sara.id, roomId: sun.id, date: today, time: "13:52",
      transcript: "Lunch was pasta with veggies. Emma ate all of it, Owen ate most. Emma napped 12 to 1:30, Owen from 12:15 to 1:45. Emma and Henry did finger painting together this morning." },
    { teacherId: sara.id, roomId: sun.id, date: today, time: "14:31",
      transcript: "Owen fell off the low slide on the playground around 2:15 and scraped his right knee. We cleaned it and put ice on it, he was fine after a few minutes. Sam had half his snack." },
  ]).returning();

  const emma = kid("Emma"), owen = kid("Owen"), samuel = kid("Samuel"), samantha = kid("Samantha");
  const ivy = kid("Ivy"), noah = kid("Noah"), lily = kid("Lily"), henry = kid("Henry");
  const todayEntries: NewEntry[] = [
    T(emma, "meal", "Banana and crackers: ate most of it", "09:30", { label: "Morning snack", voiceNoteId: vn1.id }),
    T(emma, "activity", "Finger painting with a friend", "10:30", { voiceNoteId: vn2.id }),
    T(emma, "meal", "Pasta with veggies: ate all of it", "12:00", { label: "Lunch", voiceNoteId: vn2.id }),
    T(emma, "nap", "Nap", "12:00", { endTime: "13:30", voiceNoteId: vn2.id }),
    T(emma, "diaper", "Wet", "14:10"),
    T(emma, "mood", "Happy and playful", "14:20"),
    T(owen, "meal", "Banana and crackers: ate half", "09:30", { label: "Morning snack", voiceNoteId: vn1.id }),
    T(owen, "meal", "Pasta with veggies: ate most of it", "12:00", { label: "Lunch", voiceNoteId: vn2.id }),
    T(owen, "nap", "Nap", "12:15", { endTime: "13:45", voiceNoteId: vn2.id }),
    T(owen, "mood", "A little upset after his fall, then cheerful again", "14:40"),
    T(samuel, "meal", "Pasta with veggies: ate most of it", "12:00", { label: "Lunch" }),
    T(samuel, "diaper", "Dirty", "11:05"),
    T(samantha, "meal", "Banana and crackers: ate all of it", "09:30", { label: "Morning snack", voiceNoteId: vn1.id }),
    T(samantha, "meal", "Pasta with veggies: ate half", "12:00", { label: "Lunch" }),
    T(samantha, "nap", "Nap", "12:10", { endTime: "13:40" }),
    T(samantha, "diaper", "Wet", "13:50"),
    T(ivy, "mood", "Calm and cheerful", "10:15"),
    T(noah, "meal", "Banana and crackers: ate all of it", "09:30", { label: "Morning snack" }),
    T(noah, "meal", "Pasta with veggies: ate most of it", "12:00", { label: "Lunch" }),
    T(noah, "diaper", "Wet", "12:40"),
    T(lily, "meal", "Banana and crackers: ate all of it", "09:30", { label: "Morning snack", voiceNoteId: vn1.id }),
    T(lily, "meal", "Pasta with veggies: ate all of it", "12:00", { label: "Lunch" }),
    T(lily, "nap", "Nap", "12:20", { endTime: "13:50" }),
    T(henry, "activity", "Finger painting with a friend", "10:30", { voiceNoteId: vn2.id }),
    T(henry, "meal", "Pasta with veggies: ate a little", "12:00", { label: "Lunch" }),
    // Needs review: "Sam" matches Samuel and Samantha. The AI never guesses.
    { childId: null, roomId: sun.id, voiceNoteId: vn3.id, type: "meal", label: "Afternoon snack",
      details: "Afternoon snack: ate half", date: today, time: "14:31", createdBy: sara.id,
      needsReview: true, mentionedName: "Sam", candidateIds: `${samuel.id},${samantha.id}` },
  ];
  // Other rooms: a partial day so far
  for (const c of kids.filter((k) => k.roomId !== sun.id)) {
    const full = dayEntries(c, today).filter((e) => e.time < "14:30");
    const keep = Math.max(1, Math.floor(full.length * (0.35 + r() * 0.6)));
    todayEntries.push(...full.slice(0, keep));
  }
  allEntries.push(...todayEntries);

  // ---------- voice notes behind the history ----------
  // In real use every entry comes from a teacher's voice note. Rebuild those notes for past
  // days (and today's other rooms) so the Notes screen has a real history to browse.
  const nameOfKid = new Map(kids.map((k) => [k.id, k.firstName]));
  const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
  const hm = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")}`; };
  const say = (e: NewEntry) => {
    const n = nameOfKid.get(e.childId!)!;
    if (e.type === "meal") {
      const [food, amt] = e.details.includes(":") ? e.details.split(":").map((x) => x.trim()) : ["", e.details];
      return food ? `${n} had ${lower(food)} for ${(e.label ?? "a meal").toLowerCase()}, ${lower(amt)}` : `${n}: ${lower(e.details)}`;
    }
    if (e.type === "nap") return e.endTime ? `${n} napped from ${hm(e.time)} to ${hm(e.endTime)}` : `${n} went down for a nap at ${hm(e.time)}`;
    if (e.type === "diaper") return /toilet/i.test(e.details) ? `${n} used the toilet` : `${n} had a ${lower(e.details)} diaper`;
    if (e.type === "activity") return `${n} did ${lower(e.details)}`;
    if (e.type === "mood") return `${n} was ${lower(e.details)}`;
    return `${n}: ${e.details}`;
  };
  const slotOf = (t: string) => (t < "11:00" ? "a" : t < "14:00" ? "b" : "c");
  const groups = new Map<string, NewEntry[]>();
  for (const e of allEntries) {
    if (e.voiceNoteId || !e.childId || (e.date === today && e.roomId === sun.id)) continue;
    const key = `${e.roomId}|${e.date}|${slotOf(e.time)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }
  const keys = [...groups.keys()];
  const noteValues = keys.map((k) => {
    const [roomId, date] = k.split("|");
    const es = groups.get(k)!.sort((a, b) => a.time.localeCompare(b.time));
    const last = es.at(-1)!.time;
    const [h, m] = last.split(":").map(Number);
    const spoken = Math.min(h * 60 + m + 4 + Math.floor(r() * 6), 17 * 60);
    return {
      teacherId: leadTeacher.get(Number(roomId))!.id, roomId: Number(roomId), date,
      time: `${String(Math.floor(spoken / 60)).padStart(2, "0")}:${String(spoken % 60).padStart(2, "0")}`,
      transcript: es.map(say).join(". ") + ".",
    };
  });
  for (let i = 0; i < noteValues.length; i += 200) {
    const rows = await db.insert(s.voiceNotes).values(noteValues.slice(i, i + 200)).returning({ id: s.voiceNotes.id });
    rows.forEach((row, j) => { for (const e of groups.get(keys[i + j])!) e.voiceNoteId = row.id; });
  }

  for (const e of allEntries) e.createdAt = zoned(e.date, e.endTime ?? e.time);
  for (let i = 0; i < allEntries.length; i += 400) {
    await db.insert(s.logEntries).values(allEntries.slice(i, i + 400));
  }

  // Noah went home early: his report is already sent today.
  const noahEntries = todayEntries.filter((e) => e.childId === noah.id);
  reportsToInsert.push({
    childId: noah.id, date: today, status: "sent", approvedBy: sara.id, sentAt: `${today}T13:05`,
    content: JSON.stringify(buildReport({
      firstName: "Noah", date: today, teacherName: sara.name, roomName: "Sunflower",
      entries: noahEntries.map((e) => ({ type: e.type, label: e.label ?? null, details: e.details, time: e.time, endTime: e.endTime ?? null })),
    })),
  });
  for (let i = 0; i < reportsToInsert.length; i += 200) {
    await db.insert(s.dailyReports).values(reportsToInsert.slice(i, i + 200));
  }

  // ---------- incidents ----------
  const claire = teacherRows[3], grace = teacherRows[2];
  const leo = kid("Leo", "Carter"), maya = kid("Maya", "Johnson"), jack = kid("Jack"), ruby = kid("Ruby");
  const incs = await db.insert(s.incidents).values([
    { childId: owen.id, voiceNoteId: vn3.id, date: today, time: "14:15", location: "Playground",
      description: "Fell off the low slide while climbing down.", injury: "Scraped knee", bodyPart: "Right knee",
      actionTaken: "Cleaned the scrape and applied an ice pack. He was comfortable after a few minutes.",
      staffId: sara.id, callParentNow: false, isSerious: false, status: "draft" },
    { childId: maya.id, date: today, time: "13:40", location: "Rainbow Room, art table",
      description: "Stood up quickly and bumped her forehead on the edge of the art table.", injury: "Bump with small swelling",
      bodyPart: "Forehead", actionTaken: "Cold compress applied. Monitoring for drowsiness or vomiting. Resting on the reading rug.",
      staffId: claire.id, callParentNow: true, isSerious: true, status: "draft" },
    { childId: leo.id, date: pastDays[2], time: "10:20", location: "Garden path",
      description: "Tripped while running on the garden path.", injury: "Small cut on lower lip", bodyPart: "Lower lip",
      actionTaken: "Rinsed with water, cold cloth applied. Bleeding stopped within a minute.",
      staffId: claire.id, isSerious: false, status: "approved", approvedBy: director.id, decidedAt: `${pastDays[2]}T11:05` },
    { childId: emma.id, date: pastDays[5], time: "11:10", location: "Sunflower Room, block corner",
      description: "Was bitten on the forearm by a friend during a disagreement over a toy.", injury: "Bite mark, skin not broken",
      bodyPart: "Left forearm", actionTaken: "Washed the area with soap and water, cold compress applied, comforted.",
      staffId: sara.id, isSerious: false, status: "approved", approvedBy: director.id, decidedAt: `${pastDays[5]}T12:00`,
      parentAckAt: `${pastDays[5]}T17:20` },
    { childId: jack.id, date: pastDays[3], time: "15:05", location: "Playground",
      description: "Bumped into another child while running.", injury: "Red mark", bodyPart: "Right cheek",
      actionTaken: "Cold compress for 5 minutes.", staffId: grace.id, isSerious: false, status: "approved",
      approvedBy: director.id, decidedAt: `${pastDays[3]}T15:40`, parentAckAt: `${pastDays[3]}T18:02` },
    { childId: ruby.id, date: pastDays[1], time: "09:50", location: "Ladybug Room",
      description: "Duplicate of an earlier note; no injury occurred.", injury: "None", bodyPart: "None",
      actionTaken: "None needed.", staffId: grace.id, isSerious: false, status: "rejected",
      approvedBy: director.id, decidedAt: `${pastDays[1]}T10:30` },
  ]).returning();

  // ---------- notification history: every sent report and approved incident told the parents ----------
  // WhatsApp gets opened most, email least (realistic rates). The featured demo families have read everything,
  // so their phones don't start with a pile of old banners.
  const parentsOf = (childId: number) => links.filter((l) => l.childId === childId).map((l) => parents[l.parentKey]);
  const sarahUser = parents[sarah];
  const featured = new Set([emma.id, leo.id, owen.id, maya.id].flatMap((id) => parentsOf(id).map((p) => p.id)));
  const OPEN = { whatsapp: 0.88, email: 0.45, push: 0.7 } as const;
  const notif: (typeof s.notifications.$inferInsert)[] = [];
  const opened = (parentId: number, channel: keyof typeof OPEN, from: Date, minutes = 120) =>
    featured.has(parentId) || r() < OPEN[channel] ? new Date(+from + (4 + Math.floor(r() * minutes)) * 60_000) : null;
  const insertedReports = await db.select().from(s.dailyReports);
  for (const rep of insertedReports) {
    const c = kids.find((k) => k.id === rep.childId)!;
    const when = zoned(rep.date, rep.sentAt?.slice(11) ?? "16:31");
    for (const p of parentsOf(c.id)) {
      for (const n of reportNotifications(p, c.firstName, rep.id)) notif.push({ ...n, createdAt: when, readAt: opened(p.id, n.channel, when) });
    }
  }
  for (const inc of incs.filter((i) => i.status === "approved")) {
    const c = kids.find((k) => k.id === inc.childId)!;
    const when = zoned(inc.date, inc.decidedAt!.slice(11));
    for (const p of parentsOf(c.id)) {
      for (const n of incidentNotifications(p, c.firstName, inc.id)) {
        notif.push({ ...n, createdAt: when, readAt: inc.parentAckAt ? zoned(inc.date, inc.parentAckAt.slice(11)) : opened(p.id, n.channel, when, 60) });
      }
    }
  }
  for (let i = 0; i < notif.length; i += 400) await db.insert(s.notifications).values(notif.slice(i, i + 400));

  // ---------- audit log: a believable history, each event at the time it happened ----------
  const at = (stamp: string) => zoned(stamp.slice(0, 10), stamp.slice(11, 16));
  const auditRows: (typeof s.auditLog.$inferInsert)[] = [
    // every report a teacher approved and sent
    ...insertedReports.filter((x) => x.approvedBy && x.sentAt)
      .map((x) => ({ userId: x.approvedBy!, action: "approved_and_sent", tableName: "daily_reports", recordId: x.id, createdAt: at(x.sentAt!) })),
    // incidents: logged by the teacher, then approved or rejected by the director
    ...incs.map((i) => ({ userId: i.staffId, action: "created", tableName: "incidents", recordId: i.id, createdAt: zoned(i.date, i.time) })),
    ...incs.filter((i) => i.decidedAt).map((i) => ({ userId: director.id, action: i.status, tableName: "incidents", recordId: i.id, createdAt: at(i.decidedAt!) })),
    // today's voice notes
    ...[vn1, vn2, vn3].map((v) => ({ userId: v.teacherId, action: "created", tableName: "voice_notes", recordId: v.id, createdAt: zoned(v.date, v.time) })),
  ].sort((a, b) => +a.createdAt! - +b.createdAt!);
  for (let i = 0; i < auditRows.length; i += 400) await db.insert(s.auditLog).values(auditRows.slice(i, i + 400));

  // ---------- family chats (one thread per child) ----------
  const leah = teacherRows[4];
  const owenP = parentsOf(owen.id)[0], mayaP = parentsOf(maya.id)[0];
  const first = (u: { name: string }) => u.name.split(" ")[0];
  type Msg = { key: string; childId: number; senderId: number; body: string; at: Date; reply?: string };
  const y = pastDays[0];
  const script: Msg[] = [
    { key: "e1", childId: emma.id, senderId: sarahUser.id, at: zoned(y, "17:40"), body: "Hi Ms. Sara! Emma was coughing a little last night. She seems fine this morning, but could you keep an eye on her today?" },
    { key: "e2", childId: emma.id, senderId: sara.id, at: zoned(y, "17:52"), reply: "e1", body: "Thanks for letting us know, Sarah. I'll watch her closely and message you if anything changes." },
    { key: "e3", childId: emma.id, senderId: parents[david].id, at: zoned(today, "08:05"), body: "Good morning! I'll pick Emma up a bit later today, around 4:45." },
    { key: "e4", childId: emma.id, senderId: sara.id, at: zoned(today, "08:20"), reply: "e3", body: "Got it, David. See you at 4:45! 😊" },
    { key: "e5", childId: emma.id, senderId: sara.id, at: zoned(today, "11:40"), reply: "e1", body: "Quick update: no coughing at all today. Emma loved finger painting this morning!" },
    { key: "o1", childId: owen.id, senderId: owenP.id, at: zoned(today, "07:55"), body: "Hi! Owen didn't sleep well last night, so he might need his nap a little earlier today. Thank you!" },
    { key: "m1", childId: maya.id, senderId: director.id, at: zoned(today, "13:50"), body: `Hi ${first(mayaP)}, this is Maria, the director. Maya bumped her forehead on a table at 1:40. She is okay and resting with a cold compress. I'll call you in a few minutes.` },
    { key: "m2", childId: maya.id, senderId: mayaP.id, at: zoned(today, "14:02"), reply: "m1", body: "Thank you for telling me right away. I'm leaving work now and can be there in 30 minutes." },
    { key: "l1", childId: leo.id, senderId: sarahUser.id, at: zoned(pastDays[2], "18:10"), body: "Thanks for the incident report about Leo's lip. He's all better and already running around again!" },
    { key: "l2", childId: leo.id, senderId: claire.id, at: zoned(pastDays[2], "18:25"), reply: "l1", body: "So glad to hear it! We'll remind him to walk on the garden path. 🌱" },
  ].sort((a, b) => +a.at - +b.at);
  const msgId = new Map<string, number>();
  for (const m of script) {
    const [row] = await db.insert(s.messages).values({
      childId: m.childId, senderId: m.senderId, body: m.body, createdAt: m.at, replyToId: m.reply ? msgId.get(m.reply)! : null,
    }).returning();
    msgId.set(m.key, row.id);
  }
  // who has read what: everyone is caught up except a few unread messages to show the badges
  const lastIn = (childId: number) => Math.max(...script.filter((m) => m.childId === childId).map((m) => msgId.get(m.key)!));
  const reads: (typeof s.messageReads.$inferInsert)[] = [];
  const read = (userId: number, childId: number, lastReadId: number) => reads.push({ userId, childId, lastReadId });
  for (const p of parentsOf(emma.id)) read(p.id, emma.id, msgId.get("e4")!);       // parents: Ms. Sara's 11:40 update is new
  read(sara.id, emma.id, lastIn(emma.id));
  read(director.id, emma.id, lastIn(emma.id));
  read(owenP.id, owen.id, lastIn(owen.id));                                          // Ms. Sara + director: Owen's parent is new
  read(director.id, maya.id, msgId.get("m1")!);                                       // director: the parent's reply is new
  read(mayaP.id, maya.id, lastIn(maya.id));
  for (const p of parentsOf(leo.id)) read(p.id, leo.id, lastIn(leo.id));
  for (const t of [claire, leah, director]) read(t.id, leo.id, lastIn(leo.id));
  await db.insert(s.messageReads).values(reads);

  // ---------- check-in / check-out ----------
  // Own random stream, so adding attendance doesn't reshuffle the rest of the demo.
  const ra = rng(4242);
  const pickA = <T,>(arr: T[]) => arr[Math.floor(ra() * arr.length)];
  const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const INS = ["07:30", "08:00", "08:00", "08:30", "08:30", "09:00"], OUTS = ["15:30", "16:00", "16:30", "16:30", "17:00", "17:30"];
  const usual = new Map<number, { in: string; out: string }>();
  for (const k of kids) {
    const u = { in: pickA(INS), out: pickA(OUTS) };
    usual.set(k.id, u);
    await db.update(s.children).set({ expectedIn: u.in, expectedOut: u.out }).where(eq(s.children.id, k.id));
  }
  // a few extra adults allowed to pick up
  const extra: { child: typeof kids[number]; name: string; relationship: string; phone: string }[] = [
    { child: emma, name: "Linda Carter", relationship: "Grandmother", phone: "+1 555 2201" },
    { child: leo, name: "Linda Carter", relationship: "Grandmother", phone: "+1 555 2201" },
    { child: owen, name: "Maria Lopez", relationship: "Nanny", phone: "+1 555 2202" },
    { child: maya, name: "George Johnson", relationship: "Grandfather", phone: "+1 555 2203" },
    { child: kid("Lily"), name: "Grace Chen", relationship: "Aunt", phone: "+1 555 2204" },
  ];
  const pickRows = await db.insert(s.pickups).values(extra.map((x) => ({ childId: x.child.id, name: x.name, relationship: x.relationship, phone: x.phone }))).returning();
  const whoCanPick = (childId: number) => [
    ...parentsOf(childId).map((p) => `${p.name} (${links.find((l) => l.childId === childId && parents[l.parentKey].id === p.id)?.relationship ?? "Parent"})`),
    ...pickRows.filter((x) => x.childId === childId).map((x) => `${x.name} (${x.relationship})`),
  ];
  const lead = (c: typeof kids[number]) => leadTeacher.get(c.roomId)!.id;
  // today two children aren't in: Hana is home sick, Theo hasn't arrived yet (so they have no notes today)
  const hana = kid("Hana"), theo = kid("Theo");
  await db.delete(s.logEntries).where(and(inArray(s.logEntries.childId, [hana.id, theo.id]), eq(s.logEntries.date, today)));
  // which children have notes on which days (a day with notes = the child was there)
  const present = new Set((await db.selectDistinct({ c: s.logEntries.childId, d: s.logEntries.date }).from(s.logEntries)).map((x) => `${x.c}|${x.d}`));
  const attRows: (typeof s.attendance.$inferInsert)[] = [];
  let lateLeft = 2;
  for (const d of pastDays) {
    for (const c of kids) {
      const u = usual.get(c.id)!;
      if (!present.has(`${c.id}|${d}`)) {
        attRows.push({ childId: c.id, date: d, absent: true, absentReason: pickA(["Sick", "Sick", "Family day", "Appointment"]), absentBy: parentsOf(c.id)[0]?.id ?? lead(c) });
        continue;
      }
      const inAt = hhmm(toMin(u.in) - 15 + Math.floor(ra() * 35));
      let outAt = hhmm(toMin(u.out) - 20 + Math.floor(ra() * 45));
      if (lateLeft > 0 && ra() < 0.012) { outAt = hhmm(18 * 60 + 4 + Math.floor(ra() * 12)); lateLeft--; }
      const opts = whoCanPick(c.id);
      attRows.push({ childId: c.id, date: d, checkInAt: inAt, checkInBy: lead(c), checkOutAt: outAt, checkOutBy: lead(c), pickedUpBy: ra() < 0.85 ? opts[0] : pickA(opts) });
    }
  }
  // today: everyone with notes is here (arrived before their first note); Noah went home early;
  // children without notes are either absent (told by a parent) or not here yet
  const firstNote = new Map<number, string>();
  for (const e of (await db.select({ c: s.logEntries.childId, t: s.logEntries.time }).from(s.logEntries).where(eq(s.logEntries.date, today)))) {
    if (e.c && (!firstNote.has(e.c) || e.t < firstNote.get(e.c)!)) firstNote.set(e.c, e.t);
  }
  let absentToday = 0;
  for (const c of kids) {
    const u = usual.get(c.id)!;
    const fn = firstNote.get(c.id);
    if (!fn) {
      if (c.id === hana.id || (c.id !== theo.id && absentToday++ % 2 === 0)) attRows.push({ childId: c.id, date: today, absent: true, absentReason: "Sick", absentBy: parentsOf(c.id)[0]?.id ?? lead(c) });
      continue; // the others: not arrived yet
    }
    const inAt = hhmm(Math.min(toMin(u.in) - 10 + Math.floor(ra() * 25), toMin(fn) - 5));
    if (c.id === noah.id) attRows.push({ childId: c.id, date: today, checkInAt: inAt, checkInBy: lead(c), checkOutAt: "13:10", checkOutBy: lead(c), pickedUpBy: whoCanPick(c.id)[0] });
    else attRows.push({ childId: c.id, date: today, checkInAt: inAt, checkInBy: lead(c) });
  }
  for (let i = 0; i < attRows.length; i += 400) await db.insert(s.attendance).values(attRows.slice(i, i + 400));

  // ---------- the director's bell ----------
  await db.insert(s.staffAlerts).values([
    { centerId: cid, kind: "report_sent", title: `${grace.name} sent 8 reports`, body: "Ladybug Room", href: "/director/reports?status=sent", createdAt: zoned(y, "16:28"), readAt: zoned(y, "17:00") },
    { centerId: cid, kind: "report_sent", title: `${sara.name} sent 8 reports`, body: "Sunflower Room", href: "/director/reports?status=sent", createdAt: zoned(y, "16:31"), readAt: zoned(y, "17:00") },
    { centerId: cid, kind: "message", title: `New message from ${owenP.name}`, body: `Owen Hayes · Sunflower Room`, href: `/director/messages?child=${owen.id}`, createdAt: zoned(today, "07:55") },
    { centerId: cid, kind: "report_sent", title: `${sara.name} sent Noah's report`, body: "Noah Reed · Sunflower Room", href: "/director/reports?status=sent", createdAt: zoned(today, "13:05"), readAt: zoned(today, "13:30") },
    { centerId: cid, kind: "incident", title: `Serious incident: Maya Johnson`, body: `Logged by ${claire.name}. Parents see it only after you approve it.`, href: `/director/incidents/${incs[1].id}`, createdAt: zoned(today, "13:42") },
    { centerId: cid, kind: "message", title: `New message from ${mayaP.name}`, body: `Maya Johnson · Rainbow Room`, href: `/director/messages?child=${maya.id}`, createdAt: zoned(today, "14:02") },
    { centerId: cid, kind: "incident", title: `Incident to approve: Owen Hayes`, body: `Logged by ${sara.name}. Parents see it only after you approve it.`, href: `/director/incidents/${incs[0].id}`, createdAt: zoned(today, "14:31") },
  ]);

}
