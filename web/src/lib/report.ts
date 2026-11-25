import { durationLabel, fmtShort } from "./time";
import type { EntryType } from "@/db/schema";

export type ReportLine = { type: EntryType | "incident"; label: string; text: string };
export type ReportContent = { greeting: string; lines: ReportLine[]; signoff: string };

type EntryLike = {
  type: EntryType;
  label: string | null;
  details: string;
  time: string;
  endTime: string | null;
};

const ADJ = ["great", "lovely", "happy", "busy", "wonderful", "fun"];

function pick<T>(arr: T[], seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return arr[h % arr.length];
}

/**
 * Demo-mode "AI" report writer. It only uses facts from the entries:
 * nothing is invented, and it never names other children.
 */
export function buildReport(opts: {
  firstName: string;
  date: string;
  entries: EntryLike[];
  teacherName: string;
  roomName: string;
  emojis?: boolean;
}): ReportContent {
  const { firstName, entries } = opts;
  const sorted = [...entries].sort((a, b) => a.time.localeCompare(b.time));
  const lines: ReportLine[] = [];

  for (const e of sorted.filter((e) => e.type === "meal")) {
    lines.push({ type: "meal", label: e.label ?? "Meal", text: e.details });
  }
  for (const e of sorted.filter((e) => e.type === "nap")) {
    const span = e.endTime
      ? `${fmtShort(e.time)} – ${fmtShort(e.endTime)} (${durationLabel(e.time, e.endTime)})`
      : `from ${fmtShort(e.time)}`;
    lines.push({ type: "nap", label: "Nap", text: span });
  }
  const diapers = sorted.filter((e) => e.type === "diaper");
  if (diapers.length) {
    const toilet = diapers.filter((d) => /toilet|potty/i.test(d.details)).length;
    if (toilet === diapers.length) {
      lines.push({ type: "diaper", label: "Toilet", text: `Used the potty ${toilet} ${toilet === 1 ? "time" : "times"}` });
    } else {
      lines.push({ type: "diaper", label: "Diapers", text: `${diapers.length} ${diapers.length === 1 ? "change" : "changes"}` });
    }
  }
  const acts = sorted.filter((e) => e.type === "activity").map((e) => e.details);
  if (acts.length) lines.push({ type: "activity", label: "Activity", text: joinNice(acts) });
  const moods = sorted.filter((e) => e.type === "mood").map((e) => e.details);
  if (moods.length) lines.push({ type: "mood", label: "Mood", text: capitalize(joinNice(moods)) });
  for (const e of sorted.filter((e) => e.type === "note")) {
    lines.push({ type: "note", label: "Note", text: e.details });
  }

  const lowMood = moods.some((m) => /upset|cranky|sad|unwell|fuss/i.test(m));
  const greeting = lowMood
    ? `Hi! Here's how ${firstName}'s day went`
    : `Hi! ${firstName} had a ${pick(ADJ, firstName + opts.date)} day today${opts.emojis === false ? "" : " 😊"}`;

  return { greeting, lines, signoff: `With love, ${opts.teacherName} · ${opts.roomName} Room` };
}

function joinNice(items: string[]) {
  const lower = items.map((s, i) => (i === 0 ? s : s.charAt(0).toLowerCase() + s.slice(1)));
  if (lower.length <= 1) return lower.join("");
  return lower.slice(0, -1).join(", ") + " and " + lower[lower.length - 1];
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
