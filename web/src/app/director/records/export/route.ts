import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { audit, currentUser } from "@/lib/session";
import { childRecords, type ChildRecords } from "@/lib/records";
import { fmtDate, fmtTime, todayStr } from "@/lib/time";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const director = await currentUser("director");
  if (!director) return NextResponse.json({ error: "Director login required" }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const childId = Number(p.get("child"));
  const from = p.get("from") ?? "", to = p.get("to") ?? "";
  if (!childId || !ISO.test(from) || !ISO.test(to)) return NextResponse.json({ error: "child, from and to are required" }, { status: 400 });
  const rec = await childRecords(childId, from, to, director.centerId);
  if (!rec) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await audit(director.id, "exported", "children", childId);

  const slug = `${rec.child.firstName}-${rec.child.lastName}-${from}-to-${to}`.toLowerCase();
  if (p.get("format") === "csv") {
    return new NextResponse(toCsv(rec), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}.csv"` },
    });
  }
  const bytes = await toPdf(rec, from, to, director.name);
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${slug}.pdf"` },
  });
}

// ---------------- CSV ----------------
function toCsv(rec: ChildRecords) {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["date", "time", "end_time", "record", "type", "label", "details", "status", "recorded_by", "approved_by"];
  const rows: unknown[][] = [];
  for (const e of rec.entries) rows.push([e.date, e.time, e.endTime, "log_entry", e.type, e.label, e.details, "", rec.nameOf(e.createdBy), ""]);
  for (const r of rec.reports) rows.push([r.date, r.sentAt?.slice(11) ?? "", "", "daily_report", "", "", "", r.status, "", rec.nameOf(r.approvedBy)]);
  for (const i of rec.incidents) {
    rows.push([i.date, i.time, "", "incident", i.isSerious ? "serious" : "minor", i.location,
      `${i.description} Injury: ${i.injury} (${i.bodyPart}). Action: ${i.actionTaken}`, i.status, rec.nameOf(i.staffId), rec.nameOf(i.approvedBy)]);
  }
  rows.sort((a, b) => (String(a[0]) + a[1]).localeCompare(String(b[0]) + b[1]));
  const BOM = String.fromCharCode(0xfeff); // lets Excel open the file as UTF-8
  return BOM + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

// ---------------- PDF ----------------
// Standard PDF fonts only cover basic Latin, so strip emoji and other symbols.
const clean = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•]/g, "").trim();

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont, private footer: string) { this.newPage(); }
  newPage() {
    this.page = this.doc.addPage([612, 792]);
    this.y = 750;
    const n = this.doc.getPageCount();
    this.page.drawText(clean(`${this.footer} · page ${n}`), { x: 50, y: 30, size: 8, font: this.font, color: rgb(0.55, 0.5, 0.47) });
  }
  space(h: number) { if (this.y - h < 60) this.newPage(); }
  text(t: string, o: { size?: number; bold?: boolean; x?: number; width?: number; color?: [number, number, number]; gap?: number } = {}) {
    const size = o.size ?? 10, f = o.bold ? this.bold : this.font, x = o.x ?? 50, width = o.width ?? 512;
    const words = clean(t).split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > width && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    for (const l of lines) {
      this.space(size + 4);
      this.y -= size;
      this.page.drawText(l, { x, y: this.y, size, font: f, color: rgb(...(o.color ?? [0.16, 0.15, 0.13])) });
      this.y -= 4;
    }
    this.y -= o.gap ?? 0;
  }
  /** A time in a fixed column, then wrapped text beside it. */
  row(time: string, t: string) {
    this.space(14);
    this.page.drawText(clean(time), { x: 60, y: this.y - 9.5, size: 9.5, font: this.font, color: rgb(0.42, 0.38, 0.36) });
    this.text(t, { x: 118, width: 444, size: 9.5 });
  }
  rule() {
    this.space(10);
    this.page.drawLine({ start: { x: 50, y: this.y + 4 }, end: { x: 562, y: this.y + 4 }, thickness: 0.5, color: rgb(0.9, 0.87, 0.82) });
    this.y -= 8;
  }
}

async function toPdf(rec: ChildRecords, from: string, to: string, exportedBy: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Records: ${rec.child.firstName} ${rec.child.lastName}`);
  doc.setProducer("Littlelog");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const c = rec.child;
  const w = new Writer(doc, font, bold, `Sunny Days Childcare · ${c.firstName} ${c.lastName} · exported ${todayStr()} by ${exportedBy}`);
  const muted: [number, number, number] = [0.42, 0.38, 0.36];

  w.text("SUNNY DAYS CHILDCARE · CHILD RECORDS", { size: 8, bold: true, color: muted, gap: 6 });
  w.text(`${c.firstName} ${c.lastName}`, { size: 22, bold: true, gap: 2 });
  w.text(`${rec.room.name} Room · Date of birth ${fmtDate(c.dateOfBirth, { weekday: false, year: true })} · Photo consent: ${c.photoConsent ? "yes" : "no"}`, { color: muted });
  w.text(`Period: ${fmtDate(from, { weekday: false, year: true })} – ${fmtDate(to, { weekday: false, year: true })}`, { color: muted });
  w.text(`Parents: ${rec.parents.map((p) => `${p.name} (${p.phone ?? p.email})`).join(", ") || "none on file"}`, { color: muted, gap: 6 });
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  w.text([
    plural(rec.entries.length, "log entry", "log entries"),
    plural(rec.reports.filter((r) => r.status === "sent").length, "daily report sent", "daily reports sent"),
    plural(rec.incidents.length, "incident", "incidents"),
  ].join(" · "), { bold: true, gap: 8 });
  w.rule();

  w.text("Incidents", { size: 14, bold: true, gap: 4 });
  if (!rec.incidents.length) w.text("No incidents in this period.", { color: muted, gap: 6 });
  for (const i of rec.incidents) {
    w.space(70);
    w.text(`${fmtDate(i.date, { year: true })}, ${fmtTime(i.time)} · ${i.location} · ${i.status.toUpperCase()}${i.isSerious ? " · SERIOUS" : ""}`, { bold: true });
    w.text(`What happened: ${i.description}`, { x: 60, width: 500 });
    w.text(`Injury: ${i.injury} (${i.bodyPart})`, { x: 60, width: 500 });
    w.text(`Action taken: ${i.actionTaken}`, { x: 60, width: 500 });
    w.text(`Staff present: ${rec.nameOf(i.staffId)} · Decided by: ${rec.nameOf(i.approvedBy) || "pending"}${i.parentAckAt ? " · Parent acknowledged" : ""}`, { x: 60, width: 500, color: muted, gap: 6 });
  }
  w.rule();

  w.text("Daily logs", { size: 14, bold: true, gap: 4 });
  const days = [...new Set(rec.entries.map((e) => e.date))].sort();
  if (!days.length) w.text("No log entries in this period.", { color: muted });
  for (const d of days) {
    const rep = rec.reports.find((r) => r.date === d);
    w.space(40);
    w.text(fmtDate(d, { year: true }), { bold: true, size: 11 });
    w.text(rep?.sentAt ? `Daily report sent ${fmtTime(rep.sentAt.slice(11))}, approved by ${rec.nameOf(rep.approvedBy)}` : "No daily report sent", { color: muted, size: 8.5 });
    for (const e of rec.entries.filter((x) => x.date === d)) {
      const what = e.type === "nap" && e.endTime ? `Nap ${fmtTime(e.time)} – ${fmtTime(e.endTime)}` : `${e.label ?? e.type[0].toUpperCase() + e.type.slice(1)}: ${e.details}`;
      w.row(fmtTime(e.time), what);
    }
    w.y -= 6;
  }
  return doc.save();
}
