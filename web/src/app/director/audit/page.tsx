import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema as s } from "@/db";
import { requireUser } from "@/lib/session";
import { fmtStamp } from "@/lib/time";
import { describeAudit } from "@/lib/audit-text";
import { BrandField } from "@/components/BrandPicker";

const ACTION_LABEL: Record<string, string> = {
  approved: "Approved an incident", rejected: "Rejected an incident", created: "Created (notes, incidents…)", approved_and_sent: "Sent a daily report",
  edited: "Edited", deleted: "Deleted an entry", resolved_name: "Matched an unclear name", enrolled: "Enrolled a child", exported: "Exported records",
  checked_in: "Checked a child in", checked_out: "Checked a child out", marked_absent: "Marked absent", undid_attendance: "Undid a check-in/out", viewed: "Viewed", signed_in: "Signed in", signed_out: "Signed out",
};
import { PageHead } from "../ui";
import { Pagination } from "../Modal";

const ROLES = [["all", "Everyone"], ["director", "Director"], ["teacher", "Teachers"], ["parent", "Parents"]] as const;
const ROLE_DOT: Record<string, string> = { director: "bg-primary", teacher: "bg-accent", parent: "bg-[#4A7FD4]" };

export default async function AuditLog({ searchParams }: PageProps<"/director/audit">) {
  await requireUser("director");
  const sp = await searchParams;
  const role = ROLES.find(([k]) => k === sp.role)?.[0] ?? "all";
  const action = typeof sp.action === "string" ? sp.action : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const PAGE = 15;
  const db = await getDb();
  const all = await db.select({ a: s.auditLog, u: s.users }).from(s.auditLog)
    .innerJoin(s.users, eq(s.users.id, s.auditLog.userId)).orderBy(desc(s.auditLog.createdAt), desc(s.auditLog.id));
  const actions = [...new Set(all.map(({ a }) => a.action))].sort();
  const rows = all.filter(({ a, u }) => (role === "all" || u.role === role) && (action === "all" || a.action === action));
  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE);
  const lines = await describeAudit(pageRows);
  const href = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ role, action, ...extra });
    if (p.get("role") === "all") p.delete("role");
    if (p.get("action") === "all") p.delete("action");
    return `/director/audit${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="w-full max-w-[1760px]">
      <PageHead title="Audit log" sub="Who viewed, created, edited, approved or exported each record. Required for licensing." />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {ROLES.map(([k, l]) => (
          <Link key={k} href={href({ role: k })}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${role === k ? "border-ink bg-ink text-bg" : "border-line bg-surface text-ink-2 hover:bg-surface-2"}`}>
            {l} <span className="opacity-60">{k === "all" ? all.length : all.filter(({ u }) => u.role === k).length}</span>
          </Link>
        ))}
        <form className="ml-auto flex items-center gap-2">
          {role !== "all" && <input type="hidden" name="role" value={role} />}
          <BrandField key={action} name="action" defaultValue={action} autoSubmit ariaLabel="Filter by action" className="w-[250px]"
            options={[{ value: "all", label: "All actions" }, ...actions.map((a) => ({ value: a, label: ACTION_LABEL[a] ?? a.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase()) }))]} />
        </form>
      </div>

      <div className="card mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wider text-ink-3">
            <tr><th className="px-5 py-3">When</th><th>Who</th><th>Role</th><th>What happened</th><th className="px-5">Record</th></tr>
          </thead>
          <tbody>
            {pageRows.map(({ a, u }) => { const l = lines.get(a.id)!; return (
              <tr key={a.id} className="border-t border-line hover:bg-surface-2/40">
                <td className="tabular px-5 py-2.5 text-ink-2">{fmtStamp(a.createdAt)}</td>
                <td className="font-semibold">{u.name}</td>
                <td><span className="flex items-center gap-2 capitalize text-ink-2"><span className={`h-2 w-2 rounded-full ${ROLE_DOT[u.role]}`} />{u.role}</span></td>
                <td className="py-2.5 pr-4">
                  {l.href ? <Link href={l.href} className={`font-semibold hover:underline ${l.tone === "bad" ? "text-danger" : ""}`}>{l.what}</Link> : <span className="font-semibold">{l.what}</span>}
                  {l.detail && <span className="block max-w-[560px] truncate text-xs text-ink-3">{l.detail}</span>}
                </td>
                <td className="px-5 font-mono text-xs text-ink-3">{a.tableName} #{a.recordId}</td>
              </tr>
            ); })}
            {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-ink-3">No events match.</td></tr>}
          </tbody>
        </table>
        {rows.length > 0 && (
          <div className="border-t border-line px-5 py-3">
            <Pagination page={page} pageSize={PAGE} total={rows.length} hrefFor={(n) => href({ page: String(n) })} />
          </div>
        )}
      </div>
    </div>
  );
}
