import TabBar from "@/components/TabBar";
import { requireUser } from "@/lib/session";
import { roomDay, teacherRooms } from "@/lib/data";
import { todayStr } from "@/lib/time";
import { unreadTotal } from "@/lib/chat";

export default async function TeacherLayout({ children }: LayoutProps<"/app/teacher">) {
  const teacher = await requireUser("teacher");
  const rooms = await teacherRooms(teacher.id);
  const day = rooms[0] ? await roomDay(rooms[0].id, todayStr()) : null;
  const ready = day?.children.filter((c) => c.status === "ready").length ?? 0;
  const chatUnread = await unreadTotal(teacher);

  return (
    <div className="min-h-screen bg-bg pb-[140px] pt-[50px]">
      {children}
      <TabBar
        hideOn={["/app/teacher/chat/"]}
        center={{ href: "/app/teacher/record", label: "Hold to record" }}
        tabs={[
          { href: "/app/teacher", label: "Today", icon: "home", exact: true },
          { href: "/app/teacher/notes", label: "Notes", icon: "list" },
          { href: "/app/teacher/reports", label: "Reports", icon: "doc", badge: ready },
          { href: "/app/teacher/chat", label: "Chat", icon: "chat", badge: chatUnread },
        ]}
      />
    </div>
  );
}
