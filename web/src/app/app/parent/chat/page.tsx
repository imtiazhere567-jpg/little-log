import { requireUser } from "@/lib/session";
import { threadsFor } from "@/lib/chat";
import ChatList from "@/components/ChatList";

export default async function ParentChats() {
  const parent = await requireUser("parent", "/app/parent/chat");
  const threads = await threadsFor(parent);
  return (
    <div className="px-[18px]">
      <h1 className="font-display mt-1 text-[30px] font-semibold leading-[35px]">Messages</h1>
      <p className="mt-1 text-sm text-ink-2">Talk to your child&apos;s teachers. The director can read and reply too.</p>
      <ChatList threads={threads} base="/app/parent/chat" empty="No children linked to your account yet."
        subtitle={(t) => `${t.room.name} Room`} />
    </div>
  );
}
