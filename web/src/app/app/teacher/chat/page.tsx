import { requireUser } from "@/lib/session";
import { joinNames, threadsFor } from "@/lib/chat";
import ChatList from "@/components/ChatList";
import ChatSearch from "./ChatSearch";

export default async function TeacherChats({ searchParams }: PageProps<"/app/teacher/chat">) {
  const teacher = await requireUser("teacher", "/app/teacher/chat");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const unreadOnly = sp.show === "unread";
  const all = await threadsFor(teacher);
  const threads = all.filter((t) =>
    (!unreadOnly || t.unread > 0) &&
    (!q || `${t.child.firstName} ${t.child.lastName} ${t.parents.map((p) => p.name).join(" ")}`.toLowerCase().includes(q)));
  const unread = all.reduce((n, t) => n + t.unread, 0);
  return (
    <div className="px-[18px]">
      <h1 className="font-display mt-1.5 text-[30px] font-semibold leading-[35px]">Messages</h1>
      <p className="mt-1 text-sm text-ink-2">One chat per child with their parents. The director can read and reply too.</p>
      <ChatSearch q={q} unreadOnly={unreadOnly} unread={unread} />
      <ChatList threads={threads} base="/app/teacher/chat"
        empty={q || unreadOnly ? "No chats match." : "No children in your rooms yet."}
        subtitle={(t) => `${joinNames(t.parents.map((p) => p.name)) || "No parent linked"} · ${t.room.name}`} />
    </div>
  );
}
