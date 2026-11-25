"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage, ChatRole } from "@/lib/chat";
import { ROLE_TAG, RoleTag } from "./chat-tags";

const QUICK: Record<ChatRole, (first: string) => string[]> = {
  teacher: (f) => ["Thanks for letting us know!", `${f} is doing great today 😊`, "Noted, I'll keep an eye on it."],
  parent: (f) => ["Thank you! 🙏", `${f} will be picked up early today`, "Running 10 minutes late"],
  director: () => ["Thanks, I'll look into this.", "Please stop by the front desk at pickup.", "I've let the room team know."],
};

function dayLabel(iso: string, tz: string) {
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const day = fmt(new Date(iso));
  const today = fmt(new Date());
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (day === today) return "Today";
  if (day === fmt(y)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
}
const timeOf = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export default function ChatThread({ role, childId, childFirst, meId, initial, tz, variant = "phone" }: {
  role: ChatRole; childId: number; childFirst: string; meId: number; initial: ChatMessage[]; tz: string;
  variant?: "phone" | "desktop";
}) {
  const router = useRouter();
  const [msgs, setMsgs] = useState(initial);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastId = msgs.at(-1)?.id ?? 0;

  const scrollToEnd = useCallback((smooth = true) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
  }, []);

  const pull = useCallback(async () => {
    try {
      const r = await fetch(`/api/chat?role=${role}&child=${childId}&after=${lastId}`, { cache: "no-store" });
      if (!r.ok) return;
      const { messages } = (await r.json()) as { messages: ChatMessage[] };
      if (messages.length) {
        setMsgs((xs) => [...xs, ...messages.filter((m) => !xs.some((x) => x.id === m.id))]);
        router.refresh(); // unread badges elsewhere on the screen
      }
    } catch { /* offline: next poll */ }
  }, [role, childId, lastId, router]);

  useEffect(() => { scrollToEnd(false); }, [scrollToEnd]);
  useEffect(() => { scrollToEnd(); }, [msgs.length, scrollToEnd]);
  useEffect(() => {
    const t = setInterval(pull, 3000);
    return () => clearInterval(t);
  }, [pull]);

  async function send(body = text) {
    if (!body.trim() || sending) return;
    setSending(true); setError("");
    try {
      const r = await fetch("/api/chat", { method: "POST", body: JSON.stringify({ role, child: childId, body, replyToId: replyTo?.id ?? null }) });
      if (!r.ok) throw new Error();
      setText(""); setReplyTo(null);
      await pull();
    } catch {
      setError("Couldn't send. Check your connection and try again.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function jumpTo(id: number) {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(id);
    setTimeout(() => setFlash(null), 1400);
  }

  const desktop = variant === "desktop";
  const days = msgs.map((m) => dayLabel(m.createdAt, tz));

  return (
    <div className={desktop ? "flex min-h-0 flex-1 flex-col" : ""}>
      <div ref={listRef} className={desktop ? "min-h-0 flex-1 overflow-y-auto px-6 py-4" : "px-[14px] pb-[150px] pt-2"} aria-live="polite">
        {msgs.length === 0 && (
          <div className="mx-auto mt-10 max-w-[300px] text-center">
            <div className="text-[34px]">💬</div>
            <p className="mt-2 text-[15px] font-bold">No messages yet</p>
            <p className="mt-1 text-[13px] leading-5 text-ink-3">Start the conversation about {childFirst}. Everyone in this chat sees every message.</p>
          </div>
        )}
        {msgs.map((m, i) => {
          const mine = m.senderId === meId;
          const day = days[i];
          const sep = i === 0 || day !== days[i - 1];
          return (
            <div key={m.id}>
              {sep && (
                <div className="my-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.08em] text-ink-3">
                  <span className="h-px flex-1 bg-line" />{day}<span className="h-px flex-1 bg-line" />
                </div>
              )}
              <div id={`msg-${m.id}`} className={`mb-3 flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <div className={`mb-1 flex items-center gap-1.5 px-1 text-[11.5px] ${mine ? "flex-row-reverse" : ""}`}>
                  <RoleTag role={m.role} />
                  <b className="text-ink-2">{mine ? "You" : m.senderName}</b>
                  <span className="text-ink-3">{timeOf(m.createdAt, tz)}</span>
                </div>
                <div className={`max-w-[82%] rounded-[18px] px-3.5 py-2.5 text-[14.5px] leading-[20px] transition
                  ${mine ? "rounded-tr-md bg-primary text-white" : "rounded-tl-md border border-line bg-surface text-ink shadow-[var(--shadow-1)]"}
                  ${flash === m.id ? "ring-4 ring-accent/50" : ""}`}>
                  {m.replyTo && (
                    <button type="button" onClick={() => jumpTo(m.replyTo!.id)}
                      className={`mb-1.5 block w-full rounded-[10px] border-l-[3px] px-2.5 py-1.5 text-left text-[12.5px] leading-[17px]
                        ${mine ? "bg-white/15 text-white/90" : "bg-surface-2 text-ink-2"}`}
                      style={{ borderColor: ROLE_TAG[m.replyTo.role].dot }}>
                      <b className="block text-[11.5px]">{m.replyTo.senderName}</b>
                      <span className="line-clamp-2">{m.replyTo.body}</span>
                    </button>
                  )}
                  <span className="whitespace-pre-wrap break-words">{m.body}</span>
                </div>
                <button type="button" onClick={() => { setReplyTo(m); inputRef.current?.focus(); }}
                  className="mt-0.5 px-1.5 py-0.5 text-[11.5px] font-bold text-ink-3 hover:text-primary">
                  ↩ Reply
                </button>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className={desktop ? "border-t border-line bg-surface px-5 py-3" : "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[rgba(251,247,240,.96)] px-3 pb-[26px] pt-2 backdrop-blur"}>
        {!text && !replyTo && (
          <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
            {QUICK[role](childFirst).map((q) => (
              <button key={q} type="button" onClick={() => { setText(q); inputRef.current?.focus(); }}
                className="flex-none rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:border-primary hover:text-primary">
                {q}
              </button>
            ))}
          </div>
        )}
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border-l-[3px] bg-surface-2 px-3 py-2" style={{ borderColor: ROLE_TAG[replyTo.role].dot }}>
            <span className="min-w-0 flex-1 text-[12.5px] leading-[17px]">
              <span className="flex items-center gap-1.5"><b>Replying to {replyTo.senderId === meId ? "yourself" : replyTo.senderName}</b><RoleTag role={replyTo.role} small /></span>
              <span className="line-clamp-1 text-ink-2">{replyTo.body}</span>
            </span>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="grid h-7 w-7 place-items-center rounded-full text-ink-3 hover:bg-surface">✕</button>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2">
          <textarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Message about ${childFirst}…`} aria-label="Message"
            className="max-h-28 min-h-11 flex-1 resize-none rounded-[22px] border border-line bg-surface px-4 py-2.5 text-[14.5px] leading-5 outline-none focus:border-primary"
            style={{ height: Math.min(112, 44 + Math.max(0, text.split("\n").length - 1) * 20) }} />
          <button disabled={!text.trim() || sending} aria-label="Send"
            className="grid h-11 w-11 flex-none place-items-center rounded-full bg-primary text-white shadow-[0_4px_12px_rgba(47,111,98,.35)] transition active:scale-95 disabled:opacity-40">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l16-8-6 16-2.5-6.5z" /><path d="M11.5 13.5 20 4" /></svg>
          </button>
        </form>
        {error && <p className="mt-1.5 text-[12px] font-semibold text-danger">{error}</p>}
      </div>
    </div>
  );
}
