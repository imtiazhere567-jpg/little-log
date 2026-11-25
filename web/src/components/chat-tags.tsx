import type { ChatRole } from "@/lib/chat";

// Who sent it is always shown as a tag above the bubble, so nobody mistakes
// a director's message for a teacher's (or a parent's).
export const ROLE_TAG: Record<ChatRole, { label: string; cls: string; dot: string }> = {
  parent: { label: "Parent", cls: "bg-accent-soft text-accent-ink", dot: "#E8955A" },
  teacher: { label: "Teacher", cls: "bg-primary-soft text-primary", dot: "#2F6F62" },
  director: { label: "Director", cls: "bg-activity-soft text-activity", dot: "#8A5FB0" },
};

export function RoleTag({ role, small }: { role: ChatRole; small?: boolean }) {
  const t = ROLE_TAG[role];
  return (
    <span className={`inline-flex items-center rounded-full font-extrabold uppercase tracking-[.06em] ${t.cls} ${small ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[9.5px]"}`}>
      {t.label}
    </span>
  );
}

