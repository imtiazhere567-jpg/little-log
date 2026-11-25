import "server-only";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { fmtTime } from "./time";

type Row = { a: typeof s.auditLog.$inferSelect; u: typeof s.users.$inferSelect };
export type AuditLine = { what: string; detail: string | null; href: string | null; tone: "good" | "bad" | "neutral" };

const ids = (rows: Row[], table: string) => [...new Set(rows.filter((r) => r.a.tableName === table).map((r) => r.a.recordId))];

/**
 * Turns raw audit rows ("rejected · incidents #6") into plain sentences
 * ("rejected Ruby Evans's incident report" + why), so the director can tell what happened.
 */
export async function describeAudit(rows: Row[]): Promise<Map<number, AuditLine>> {
  const db = await getDb();
  const none = [-1];
  const pick = (t: string) => (ids(rows, t).length ? ids(rows, t) : none);
  const [kids, incs, reports, entries, notes, users, atts] = await Promise.all([
    db.select().from(s.children),
    db.select().from(s.incidents).where(inArray(s.incidents.id, pick("incidents"))),
    db.select().from(s.dailyReports).where(inArray(s.dailyReports.id, pick("daily_reports"))),
    db.select().from(s.logEntries).where(inArray(s.logEntries.id, pick("log_entries"))),
    db.select({ v: s.voiceNotes, room: s.rooms.name }).from(s.voiceNotes).innerJoin(s.rooms, eq(s.rooms.id, s.voiceNotes.roomId))
      .where(inArray(s.voiceNotes.id, pick("voice_notes"))),
    db.select().from(s.users).where(inArray(s.users.id, pick("users"))),
    db.select().from(s.attendance).where(inArray(s.attendance.id, pick("attendance"))),
  ]);
  const kid = (id: number | null | undefined) => kids.find((k) => k.id === id);
  const name = (id: number | null | undefined) => { const k = kid(id); return k ? `${k.firstName} ${k.lastName}` : "a child"; };
  const out = new Map<number, AuditLine>();

  for (const { a } of rows) {
    let line: AuditLine = { what: `${a.action.replace(/_/g, " ")} ${a.tableName.replace(/_/g, " ").replace(/s$/, "")}`, detail: null, href: null, tone: "neutral" };
    if (a.tableName === "incidents") {
      const i = incs.find((x) => x.id === a.recordId);
      const who = name(i?.childId);
      const href = `/director/incidents/${a.recordId}`;
      if (a.action === "approved") line = { what: `approved ${who}'s incident report`, detail: `${i?.injury ?? "Incident"} · parents were notified`, href, tone: "good" };
      else if (a.action === "rejected") line = { what: `rejected ${who}'s incident report`, detail: `Not sent to parents · ${i?.description ?? "no reason given"}`, href, tone: "bad" };
      else if (a.action === "created") line = { what: `logged an incident for ${who}`, detail: `${i?.injury ?? ""}${i?.isSerious ? " · serious" : ""} · waiting for the director`, href, tone: "neutral" };
    } else if (a.tableName === "daily_reports") {
      const r = reports.find((x) => x.id === a.recordId);
      line = { what: `sent ${name(r?.childId)}'s daily report`, detail: "Parents got WhatsApp, email and app notifications", href: r ? `/director/children/${r.childId}` : null, tone: "good" };
    } else if (a.tableName === "log_entries") {
      const e = entries.find((x) => x.id === a.recordId);
      const who = e?.childId ? name(e.childId) : null;
      const verbs: Record<string, string> = { created: "added an entry", edited: "edited an entry", deleted: "deleted an entry", resolved_name: "matched an unclear note" };
      line = { what: `${verbs[a.action] ?? a.action.replace(/_/g, " ")}${who ? ` ${a.action === "resolved_name" ? "to" : "for"} ${who}` : ""}`, detail: e ? `${e.label ?? e.type}: ${e.details}` : null, href: e?.childId ? `/director/children/${e.childId}` : null, tone: "neutral" };
    } else if (a.tableName === "voice_notes") {
      const n = notes.find((x) => x.v.id === a.recordId);
      line = { what: `recorded a voice note${n ? ` · ${n.room} Room` : ""}`, detail: n ? `“${n.v.transcript.length > 90 ? n.v.transcript.slice(0, 90) + "…" : n.v.transcript}”` : null, href: null, tone: "neutral" };
    } else if (a.tableName === "attendance") {
      const r = atts.find((x) => x.id === a.recordId);
      const who = name(r?.childId);
      const href = "/director/attendance";
      if (a.action === "checked_in") line = { what: `checked ${who} in`, detail: r?.checkInAt ? `Arrived at ${fmtTime(r.checkInAt)}` : null, href, tone: "neutral" };
      else if (a.action === "checked_out") line = { what: `checked ${who} out`, detail: r?.pickedUpBy ? `Picked up by ${r.pickedUpBy}` : null, href, tone: "good" };
      else if (a.action === "marked_absent") line = { what: `marked ${who} absent`, detail: r?.absentReason ?? null, href, tone: "neutral" };
    } else if (a.tableName === "children" && a.action === "undid_attendance") {
      line = { what: `undid a check-in/out for ${name(a.recordId)}`, detail: "Fixed a mistake", href: "/director/attendance", tone: "neutral" };
    } else if (a.tableName === "children") {
      const who = name(a.recordId);
      const verbs: Record<string, string> = { created: `added ${who}`, enrolled: `enrolled ${who}`, edited: `updated ${who}'s details`, exported: `exported ${who}'s records` };
      line = { what: verbs[a.action] ?? `${a.action} ${who}`, detail: null, href: `/director/children/${a.recordId}`, tone: "neutral" };
    } else if (a.tableName === "users" && (a.action === "signed_in" || a.action === "signed_out")) {
      line = { what: a.action === "signed_in" ? "signed in" : "signed out", detail: null, href: null, tone: "neutral" };
    } else if (a.tableName === "users") {
      const u = users.find((x) => x.id === a.recordId);
      line = { what: a.action === "created" ? `added ${u?.name ?? "an account"}${u ? ` (${u.role})` : ""}` : `updated ${u?.name ?? "an account"}'s details`, detail: null, href: null, tone: "neutral" };
    } else if (a.tableName === "centers" && a.action.startsWith("edited_settings_")) {
      line = { what: `changed the ${a.action.slice("edited_settings_".length).replace(/_/g, " ")} settings`, detail: null, href: "/director/settings", tone: "neutral" };
    }
    out.set(a.id, line);
  }
  return out;
}
