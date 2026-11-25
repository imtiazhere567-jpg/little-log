import { and, eq, inArray, isNull } from "drizzle-orm";
import TabBar from "@/components/TabBar";
import NotificationBanners from "@/components/NotificationBanners";
import AppTopBar from "@/components/AppTopBar";
import { requireUser } from "@/lib/session";
import { parentChildren } from "@/lib/data";
import { getDb, schema as s } from "@/db";
import { unreadTotal } from "@/lib/chat";

export default async function ParentLayout({ children }: LayoutProps<"/app/parent">) {
  const parent = await requireUser("parent");
  const kids = await parentChildren(parent.id);
  const db = await getDb();
  const unread = kids.length
    ? await db.select({ id: s.incidents.id }).from(s.incidents).where(and(
        inArray(s.incidents.childId, kids.map((k) => k.child.id)),
        eq(s.incidents.status, "approved"), isNull(s.incidents.parentAckAt)))
    : [];
  const chatUnread = await unreadTotal(parent);

  return (
    <div className="min-h-screen bg-bg pb-[130px] pt-[46px]">
      <NotificationBanners />
      <AppTopBar />
      {children}
      <TabBar
        hideOn={["/app/parent/chat/"]}
        tabs={[
          { href: "/app/parent", label: "Today", icon: "home", exact: true },
          { href: "/app/parent/history", label: "History", icon: "cal" },
          { href: "/app/parent/chat", label: "Chat", icon: "chat", badge: chatUnread },
          { href: "/app/parent/incidents", label: "Incidents", icon: "warn", badge: unread.length },
          { href: "/app/parent/settings", label: "Settings", icon: "gear" },
        ]}
      />
    </div>
  );
}
