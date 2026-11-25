import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser, audit } from "@/lib/session";
import { markReadServer } from "@/lib/notify-read";
import { parentChildren, parseReport } from "@/lib/data";
import ReportCard from "@/components/ReportCard";

export default async function ParentReport({ params }: PageProps<"/app/parent/report/[id]">) {
  const parent = await requireUser("parent");
  const { id } = await params;
  const db = await getDb();
  const [report] = await db.select().from(s.dailyReports).where(eq(s.dailyReports.id, Number(id)));
  const kids = await parentChildren(parent.id);
  const mine = kids.find((k) => k.child.id === report?.childId);
  // Privacy: a report for someone else's child looks exactly like a missing one.
  if (!report || !mine || report.status !== "sent") notFound();
  await audit(parent.id, "viewed", "daily_reports", report.id);
  await markReadServer(parent.id, { channel: "push", recordId: report.id, kind: "daily_report" });

  return (
    <div className="px-[18px]">
      <div className="eyebrow mb-2 mt-1">{mine.child.firstName} · {mine.room.name} Room</div>
      <ReportCard content={parseReport(report.content)} date={report.date} />
    </div>
  );
}
