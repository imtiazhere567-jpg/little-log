import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canChat, joinNames, markThreadRead, threadMembers, threadMessages, threadsFor } from "@/lib/chat";
import { centerTz } from "@/lib/time";
import { Avatar } from "@/components/ui";
import { RoleTag, ROLE_TAG } from "@/components/chat-tags";
import { lastWhen } from "@/components/ChatList";
import ChatThread from "@/components/ChatThread";
import BrandSelect from "@/components/BrandSelect";
import { PageHead } from "../ui";

const SHOW = [["active", "Active chats"], ["unread", "Unread"], ["all", "All families"]] as const;

export default async function DirectorMessages({ searchParams }: PageProps<"/director/messages">) {
  const director = await requireUser("director", "/director/messages");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const show = SHOW.find(([k]) => k === sp.show)?.[0] ?? "active";
  const roomId = typeof sp.room === "string" ? Number(sp.room) : null;
  const all = await threadsFor(director);
  const rooms = [...new Map(all.map((t) => [t.room.id, t.room])).values()].sort((a, b) => a.id - b.id);
  const list = all.filter((t) =>
    (show === "all" || (show === "unread" ? t.unread > 0 : !!t.last)) &&
    (!roomId || t.room.id === roomId) &&
    (!q || `${t.child.firstName} ${t.child.lastName} ${t.parents.map((p) => p.name).join(" ")}`.toLowerCase().includes(q)));
  const openId = Number(sp.child) || null;
  const selected = openId && (await canChat(director, openId)) ? openId : null;
  const [members, messages] = selected ? await Promise.all([threadMembers(selected), threadMessages(selected)]) : [null, []];
  if (selected) await markThreadRead(director.id, selected);
  const unread = all.reduce((n, t) => n + t.unread, 0);

  const href = (extra: Record<string, string | number | null>) => {
    const p = new URLSearchParams();
    const merged = { show: show === "active" ? null : show, room: roomId, q: q || null, child: selected, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `/director/messages${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="w-full max-w-[1760px]">
      <PageHead title="Messages" sub={`Family chats with teachers · ${unread ? `${unread} unread` : "all read"} · you can read every chat and reply in any of them`} />

      <div className="card mt-5 flex h-[calc(100vh-170px)] min-h-[520px] overflow-hidden">
        {/* thread list */}
        <aside className="flex w-[400px] flex-none flex-col border-r border-line">
          <div className="border-b border-line p-3">
            <form>
              {show !== "active" && <input type="hidden" name="show" value={show} />}
              {roomId && <input type="hidden" name="room" value={roomId} />}
              <input name="q" defaultValue={q} placeholder="Search child or parent…" aria-label="Search chats"
                className="h-10 w-full rounded-full border border-line bg-bg px-4 text-sm outline-none focus:border-primary" />
            </form>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <BrandSelect full label="Show" value={show} width={230}
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M4 5h16v11H9l-5 4z" /></svg>}
                options={SHOW.map(([k, label]) => ({
                  key: k, label, href: href({ show: k === "active" ? null : k }),
                  hint: k === "unread" ? `${unread} unread message${unread === 1 ? "" : "s"}` : k === "active" ? "Chats that have started" : `All ${all.length} children`,
                }))} />
              <BrandSelect full label="Room" value={roomId ? String(roomId) : "all"} width={230}
                icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1H4a1 1 0 01-1-1z" /></svg>}
                options={[{ key: "all", label: "All rooms", href: href({ room: null }) },
                  ...rooms.map((r) => ({ key: String(r.id), label: r.name, color: r.color, hint: r.ageGroup, href: href({ room: r.id }) }))]} />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.map((t) => (
              <Link key={t.child.id} href={href({ child: t.child.id })} scroll={false}
                className={`flex items-center gap-3 border-b border-line/70 px-4 py-3 transition ${selected === t.child.id ? "bg-primary-soft/60" : "hover:bg-surface-2/60"}`}>
                <Avatar first={t.child.firstName} last={t.child.lastName} bg={t.child.avatarBg} fg={t.child.avatarFg} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <b className="truncate text-[14px]">{t.child.firstName} {t.child.lastName}</b>
                    {t.last && <span className={`flex-none text-[11.5px] ${t.unread ? "font-bold text-primary" : "text-ink-3"}`}>{lastWhen(t.last.createdAt)}</span>}
                  </span>
                  <span className="block truncate text-[12px] text-ink-3">{joinNames(t.parents.map((p) => p.name)) || "No parent linked"} · {t.room.name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    {t.last ? <><RoleTag role={t.last.role} small /><span className={`min-w-0 flex-1 truncate text-[12.5px] ${t.unread ? "font-semibold" : "text-ink-2"}`}>{t.last.body}</span></>
                      : <span className="text-[12.5px] text-ink-3">No messages yet</span>}
                    {t.unread > 0 && <span className="grid h-5 min-w-5 flex-none place-items-center rounded-full bg-primary px-1.5 text-[11px] font-extrabold text-white">{t.unread}</span>}
                  </span>
                </span>
              </Link>
            ))}
            {!list.length && <p className="p-8 text-center text-sm text-ink-3">No chats match. Try “All families” to start a new one.</p>}
          </div>
        </aside>

        {/* open thread */}
        <section className="flex min-w-0 flex-1 flex-col bg-bg">
          {members ? (
            <>
              <header className="flex flex-wrap items-center gap-4 border-b border-line bg-surface px-6 py-3.5">
                <Avatar first={members.child.firstName} last={members.child.lastName} bg={members.child.avatarBg} fg={members.child.avatarFg} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[21px] font-semibold leading-7">{members.child.firstName} {members.child.lastName}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1.5 text-[12px]">
                    {[
                      { role: "parent" as const, names: members.parents.map((p) => `${p.name}${p.phone ? ` (${p.phone})` : ""}`).join(", ") },
                      { role: "teacher" as const, names: members.teachers.map((t) => t.name).join(", ") },
                    ].filter((g) => g.names).map((g) => (
                      <span key={g.role} className={`rounded-full px-2 py-0.5 font-semibold ${ROLE_TAG[g.role].cls}`}>
                        <b className="text-[9.5px] uppercase tracking-[.06em]">{ROLE_TAG[g.role].label}</b> {g.names}
                      </span>
                    ))}
                  </div>
                </div>
                <Link href={`/director/children/${members.child.id}`} className="btn btn-sm btn-secondary">Child profile →</Link>
              </header>
              <p className="border-b border-line bg-activity-soft/50 px-6 py-1.5 text-[12px] text-activity">
                You&apos;re writing as <b>Director</b>. The parents and the {members.room.name} Room teachers see your messages with a “Director” tag.
              </p>
              <ChatThread key={members.child.id} role="director" variant="desktop" childId={members.child.id} childFirst={members.child.firstName}
                meId={director.id} initial={messages} tz={centerTz()} />
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-10 text-center">
              <div>
                <div className="text-[44px]">💬</div>
                <p className="mt-2 text-lg font-bold">Pick a family chat</p>
                <p className="mx-auto mt-1 max-w-[380px] text-sm text-ink-3">Every child has one chat with their parents and room teachers. You can read all of them and step in when needed.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
