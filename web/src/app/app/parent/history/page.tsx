import Link from "next/link";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { parentChildren, parseReport } from "@/lib/data";
import { addDays, fmtDate, todayStr, weekday } from "@/lib/time";
import ChildSwitcher from "../ChildSwitcher";

export default async function History({ searchParams }: PageProps<"/app/parent/history">) {
  const parent = await requireUser("parent");
  const { child: childParam } = await searchParams;
  const kids = await parentChildren(parent.id);
  const sel = kids.find((k) => String(k.child.id) === childParam) ?? kids[0];
  if (!sel) return null;
  const today = todayStr();
  // 4 calendar weeks ending this week (Mon–Fri columns)
  const monday = addDays(today, -((weekday(today) + 6) % 7));
  const start = addDays(monday, -21);
  const db = await getDb();
  const reports = await db.select().from(s.dailyReports)
    .where(and(eq(s.dailyReports.childId, sel.child.id), eq(s.dailyReports.status, "sent"), gte(s.dailyReports.date, start)))
    .orderBy(desc(s.dailyReports.date));
  const byDate = new Map(reports.map((r) => [r.date, r]));
  const weeks = [0, 1, 2, 3].map((w) => [0, 1, 2, 3, 4].map((d) => addDays(start, w * 7 + d)));

  return (
    <div className="px-[18px]">
      <h1 className="font-display mt-3 text-[30px] font-semibold leading-[35px]">Past reports</h1>
      <ChildSwitcher kids={kids} current={sel.child.id} base="/app/parent/history" />

      <div className="card mt-4 p-4">
        <div className="mb-2 grid grid-cols-5 text-center text-[11px] font-bold uppercase tracking-wider text-ink-3">
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="grid gap-1.5">
          {weeks.map((wk, i) => (
            <div key={i} className="grid grid-cols-5 gap-1.5">
              {wk.map((d) => {
                const r = byDate.get(d);
                const isToday = d === today;
                const future = d > today;
                const cls = `grid h-12 place-items-center rounded-xl text-sm font-bold ${isToday ? "ring-2 ring-accent" : ""}`;
                const inner = (
                  <>
                    <span className={future ? "text-ink-3/50" : ""}>{Number(d.slice(8))}</span>
                    <span className={`-mt-2 h-1.5 w-1.5 rounded-full ${r ? "bg-accent" : "bg-transparent"}`} />
                  </>
                );
                return r ? (
                  <Link key={d} href={`/app/parent/report/${r.id}`} className={`${cls} bg-accent-soft`}>{inner}</Link>
                ) : (
                  <span key={d} className={`${cls} bg-surface-2/60`}>{inner}</span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {reports.map((r) => (
          <Link key={r.id} href={`/app/parent/report/${r.id}`} className="card flex items-center justify-between px-4 py-3">
            <span>
              <b className="block text-[15px]">{fmtDate(r.date)}</b>
              <span className="line-clamp-1 text-[13px] text-ink-2">{parseReport(r.content).greeting}</span>
            </span>
            <span className="text-ink-3">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
