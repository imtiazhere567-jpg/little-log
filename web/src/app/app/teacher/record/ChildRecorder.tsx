"use client";
import BrandPicker from "@/components/BrandPicker";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseNote, type Draft } from "@/lib/parse-note";
import { saveChildNote } from "../actions";
import TimePicker, { fmt12 } from "@/components/TimePicker";
import { Avatar, TYPE_STYLE, TypeIcon, WarnIcon } from "@/components/ui";

type Kid = { id: number; firstName: string; lastName: string; avatarBg: string; avatarFg: string; entries: number; status: string };
type Step = "pick" | "capture" | "review" | "saved";

// The browser's free built-in speech recognition (Chrome, Edge, Safari).
type Recognition = {
  continuous: boolean; interimResults: boolean; lang: string;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
};
const getRecognition = (): (new () => Recognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const STATUS_DOT: Record<string, string> = { sent: "#2F6F62", ready: "#3E8E5A", review: "#C98A1B", few: "#D9CFBF" };

export default function ChildRecorder({ kids, roomName, tz, preselect }: { kids: Kid[]; roomName: string; tz: string; preselect?: number }) {
  const router = useRouter();
  const now = () => new Date().toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
  const [kid, setKid] = useState<Kid | null>(kids.find((k) => k.id === preselect) ?? null);
  const [step, setStep] = useState<Step>(preselect && kids.some((k) => k.id === preselect) ? "capture" : "pick");
  const [mode, setMode] = useState<"speak" | "type">("speak");
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState("");
  const [supported, setSupported] = useState(true);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [result, setResult] = useState<{ entries: number; incidents: number } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const rec = useRef<Recognition | null>(null);

  // stop listening if the teacher leaves the screen
  useEffect(() => () => rec.current?.abort(), []);

  function listen() {
    if (listening) { rec.current?.stop(); return; }
    const R = getRecognition();
    if (!R) { setSupported(false); setMode("type"); return; }
    const r = new R();
    r.continuous = true; r.interimResults = true; r.lang = "en-US";
    r.onresult = (e) => {
      let fin = "", mid = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript; else mid += res[0].transcript;
      }
      if (fin) setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${fin.trim()}${/[.!?]$/.test(fin.trim()) ? "" : "."}`);
      setInterim(mid);
    };
    r.onerror = (e) => {
      setMicError(e.error === "not-allowed" ? "Microphone blocked. Allow the microphone for this site, or type instead."
        : e.error === "no-speech" ? "Didn't hear anything. Try again a little closer to the mic." : "Voice typing stopped. You can type instead.");
    };
    r.onend = () => { setListening(false); setInterim(""); };
    rec.current = r;
    setMicError("");
    r.start();
    setListening(true);
  }

  function toReview() {
    rec.current?.stop();
    if (!kid) return;
    const others = kids.filter((k) => k.id !== kid.id).map((k) => k.firstName);
    const d = parseNote(text, { firstName: kid.firstName, others, now: now() });
    setDrafts(d);
    setStep("review");
  }

  function save() {
    if (!kid) return;
    setError("");
    start(async () => {
      try {
        const r = await saveChildNote({ childId: kid.id, transcript: text, drafts });
        setResult(r); setStep("saved"); router.refresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save"); }
    });
  }

  const reset = (k: Kid | null, s: Step) => { setKid(k); setStep(s); setText(""); setInterim(""); setDrafts([]); setResult(null); setMicError(""); setMode(supported ? "speak" : "type"); };
  const update = (i: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d, j) => (j === i ? ({ ...d, ...patch } as Draft) : d)));
  const at = fmt12(now()).replace(" ", " ");
  const TEMPLATES: { key: string; icon: string; label: string; text: string }[] = kid ? [
    { key: "meal", icon: "🍎", label: "Meal", text: `${kid.firstName} had pasta with veggies for lunch and ate all of it.` },
    { key: "nap", icon: "🌙", label: "Nap", text: `${kid.firstName} napped from 12:00 to 1:30.` },
    { key: "diaper", icon: "💧", label: "Diaper", text: `${kid.firstName} had a wet diaper at ${at}.` },
    { key: "activity", icon: "🎨", label: "Activity", text: `${kid.firstName} did finger painting with a friend.` },
    { key: "mood", icon: "🙂", label: "Mood", text: `${kid.firstName} was happy and playful.` },
    { key: "note", icon: "📝", label: "Note", text: `${kid.firstName} brought a new teddy from home.` },
    { key: "incident", icon: "⚠️", label: "Incident", text: `${kid.firstName} fell on the playground at ${at} and scraped a knee. We cleaned it and put on an ice pack.` },
  ] : [];
  const demoNote = kid ? `${kid.firstName} had pasta for lunch and ate most of it. ${kid.firstName} napped from 12:15 to 1:45. Had a wet diaper at 2:30. ${kid.firstName} played in the sandbox with a friend and was really happy.` : "";
  const [demo, setDemo] = useState(false);
  const demoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (demoTimer.current) clearInterval(demoTimer.current); }, []);

  // Demo voice note: "speaks" a sample note word by word, then goes to the check screen.
  function playDemo() {
    if (!kid || demo) return;
    rec.current?.stop();
    const words = demoNote.split(" ");
    let i = 0;
    setText(""); setDemo(true);
    demoTimer.current = setInterval(() => {
      i++;
      setText(words.slice(0, i).join(" "));
      if (i >= words.length) {
        if (demoTimer.current) clearInterval(demoTimer.current);
        setTimeout(() => {
          setDemo(false);
          const others = kids.filter((k) => k.id !== kid.id).map((k) => k.firstName);
          setDrafts(parseNote(demoNote, { firstName: kid.firstName, others, now: now() }));
          setStep("review");
        }, 600);
      }
    }, 140);
  }

  // ======================================================== 1. pick a child
  if (step === "pick" || !kid) {
    return (
      <div className="px-[18px]">
        <div className="mt-1 flex items-center justify-between">
          <Link href="/app/teacher" className="text-sm font-bold text-primary">← Today</Link>
          <span className="eyebrow">{roomName} Room</span>
        </div>
        <h1 className="font-display mt-3 text-[28px] font-semibold leading-[33px]">Who is this note about?</h1>
        <p className="mt-1 text-sm text-ink-2">Pick the child, then speak or type. Everything you say goes to that child.</p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {kids.map((k) => (
            <button key={k.id} type="button" onClick={() => reset(k, "capture")}
              className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-3 text-left shadow-[var(--shadow-1)] transition active:scale-[.98] hover:border-primary">
              <Avatar first={k.firstName} last={k.lastName} bg={k.avatarBg} fg={k.avatarFg} size={40}
                dot={STATUS_DOT[k.status] ? { color: STATUS_DOT[k.status], symbol: "" } : undefined} />
              <span className="min-w-0">
                <b className="font-display block truncate text-[16px]">{k.firstName}</b>
                <span className="text-[12px] text-ink-3">{k.entries} today</span>
              </span>
            </button>
          ))}
        </div>
        <Link href="/app/teacher/record?mode=group" className="mt-5 block rounded-2xl border border-dashed border-line p-3.5 text-center text-[13px] text-ink-2">
          <b className="text-ink">Group note</b> about several children? Try the demo samples →
        </Link>
      </div>
    );
  }

  // ======================================================== 4. saved
  if (step === "saved" && result) {
    return (
      <div className="px-[18px] pt-6 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-success-soft text-4xl">✓</div>
        <h1 className="font-display mt-4 text-[26px] font-semibold">Saved for {kid.firstName}</h1>
        <p className="mt-1 text-sm text-ink-2">
          {result.entries} {result.entries === 1 ? "entry" : "entries"} added
          {result.incidents ? `, and ${result.incidents} incident sent to the director` : ""}.
        </p>
        <div className="mt-6 grid gap-2">
          <button type="button" onClick={() => reset(kid, "capture")} className="btn btn-primary">🎙 Another note for {kid.firstName}</button>
          <button type="button" onClick={() => reset(null, "pick")} className="btn btn-secondary">Choose another child</button>
          <Link href={`/app/teacher/child/${kid.id}`} className="btn btn-ghost">See {kid.firstName}&apos;s day →</Link>
        </div>
      </div>
    );
  }

  const header = (
    <ChildSelect kids={kids} current={kid} disabled={listening || demo}
      onPick={(k) => { setKid(k); setDrafts([]); setResult(null); if (step === "review") setStep("capture"); }} />
  );

  // ======================================================== 3. review drafts
  if (step === "review") {
    return (
      <div className="px-[18px]">
        <button type="button" onClick={() => setStep("capture")} className="mt-1 text-sm font-bold text-primary">← Back to the note</button>
        <div className="mt-3">{header}</div>
        <h1 className="font-display mt-4 text-[24px] font-semibold leading-7">
          {drafts.length ? `Found ${drafts.length} ${drafts.length === 1 ? "thing" : "things"} to save` : "Nothing recognised yet"}
        </h1>
        <p className="mt-1 text-[13px] text-ink-2">Check each one. Fix the words or time, or remove what&apos;s wrong.</p>

        <div className="mt-3 grid gap-2.5">
          {drafts.map((d, i) => d.kind === "incident" ? (
            <div key={i} className="rounded-2xl border-l-4 border-danger bg-danger-soft p-3.5">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-danger"><WarnIcon size={15} /></span>
                <b className="flex-1 text-[14px]">Incident draft {d.serious && <span className="badge ml-1 bg-danger text-white">Serious</span>}</b>
                <button type="button" onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))} aria-label="Remove" className="text-ink-3">✕</button>
              </div>
              <input value={d.injury} onChange={(e) => update(i, { injury: e.target.value })} className="mt-2 h-10 w-full rounded-lg border border-danger/30 bg-white/80 px-2.5 text-[14px] font-semibold" />
              <textarea rows={2} value={d.description} onChange={(e) => update(i, { description: e.target.value })} className="mt-1.5 w-full rounded-lg border border-danger/30 bg-white/80 px-2.5 py-1.5 text-[13.5px]" />
              <input value={d.actionTaken} onChange={(e) => update(i, { actionTaken: e.target.value })} placeholder="First aid given" className="mt-1.5 h-10 w-full rounded-lg border border-danger/30 bg-white/80 px-2.5 text-[13.5px]" />
              <p className="mt-1.5 text-[12px] font-semibold text-danger">Goes to the director first, never straight to the parent · {fmt12(d.time)}</p>
            </div>
          ) : (
            <div key={i} className="rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-1)]">
              <div className="flex items-center gap-2.5">
                <TypeIcon type={d.type} size={32} />
                <div className="min-w-0 flex-1">
                  <BrandPicker ariaLabel="Entry type" value={d.type} onChange={(v) => update(i, { type: v as typeof d.type })}
                    options={(["meal", "nap", "diaper", "activity", "mood", "note"] as const).map((t) => ({ value: t, label: `${TYPE_STYLE[t].icon} ${TYPE_STYLE[t].label}` }))} />
                </div>
                <button type="button" onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))} aria-label="Remove" className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-danger-soft hover:text-danger">✕</button>
              </div>
              {d.type === "meal" && <input value={d.label ?? ""} onChange={(e) => update(i, { label: e.target.value })} placeholder="Which meal" className="mt-2 h-10 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-[13.5px] font-semibold" />}
              {d.type !== "nap" && <input value={d.details} onChange={(e) => update(i, { details: e.target.value })} className="mt-2 h-10 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-[14px]" />}
              <div className={`mt-2 grid gap-2 ${d.type === "nap" ? "grid-cols-2" : ""}`}>
                <TimePicker name={`t${i}`} value={d.time} onChange={(v) => update(i, { time: v })} now={now} />
                {d.type === "nap" && <TimePicker name={`e${i}`} value={d.endTime ?? ""} onChange={(v) => update(i, { endTime: v || undefined })} now={now} placeholder="Woke up?" optional />}
              </div>
            </div>
          ))}
          {drafts.length === 0 && (
            <div className="card p-4 text-center text-sm text-ink-2">
              Try mentioning meals, naps, diapers, moods or activities. Or add an entry by hand.
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-[13px] font-semibold text-danger">{error}</p>}
        <div className="mt-4 grid gap-2">
          <button type="button" onClick={save} disabled={pending || drafts.length === 0} className="btn btn-lg btn-primary">
            {pending ? "Saving…" : `Save for ${kid.firstName}`}
          </button>
          <Link href={`/app/teacher/child/${kid.id}`} className="btn btn-sm btn-ghost">✎ Add an entry by hand instead</Link>
        </div>
      </div>
    );
  }

  // ======================================================== 2. speak or type
  return (
    <div className="px-[18px]">
      <button type="button" onClick={() => reset(null, "pick")} className="mt-1 text-sm font-bold text-primary">← Choose child</button>
      <div className="mt-3">{header}</div>

      <div className="mt-4 flex rounded-2xl bg-surface-2 p-1">
        {(["speak", "type"] as const).map((m) => (
          <button key={m} type="button" onClick={() => { if (listening) rec.current?.stop(); setMode(m); }}
            className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-[14px] font-bold transition ${mode === m ? "bg-surface text-primary shadow-[var(--shadow-1)]" : "text-ink-3"}`}>
            {m === "speak" ? "🎙 Speak" : "⌨️ Type"}
          </button>
        ))}
      </div>

      {mode === "speak" ? (
        <div className="mt-4 text-center">
          {!supported ? (
            <p className="rounded-2xl bg-warning-soft p-3 text-[13px] text-[#6B4A0C]">Voice typing isn&apos;t available in this browser. Please use Chrome or Edge, or type instead.</p>
          ) : (
            <>
              <button type="button" onClick={listen} aria-label={listening ? "Stop listening" : "Start speaking"}
                className={`relative mx-auto grid h-[104px] w-[104px] place-items-center rounded-full shadow-[0_10px_30px_rgba(232,149,90,.45)] transition active:scale-95 ${listening ? "pulse-ring bg-[#D0663A]" : "bg-accent"}`}>
                {listening
                  ? <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="6" width="12" height="12" rx="2.5" /></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" className="h-10 w-10"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>}
              </button>
              <p className="mt-3 text-[13.5px] font-bold text-accent-ink">{demo ? "Playing a demo voice note…" : listening ? "Listening… tap to stop" : text ? "Tap to add more" : `Tap and talk about ${kid.firstName}`}</p>

              {micError && <p className="mt-2 rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-[#6B4A0C]">{micError}</p>}
            </>
          )}
        </div>
      ) : null}
      {mode === "speak" && !listening && !demo && (
        <button type="button" onClick={playDemo}
          className="mx-auto mt-3 flex items-center gap-2 rounded-full border border-accent/40 bg-accent-soft px-4 py-2 text-[13px] font-bold text-accent-ink">
          ▶ Play a demo voice note
        </button>
      )}

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">{mode === "speak" ? "What you said" : "Write the note"}</span>
          {text && <button type="button" onClick={() => setText("")} className="text-[12px] font-semibold text-ink-3">Clear</button>}
        </div>
        {mode === "speak" && !listening && !demo ? (
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Your words appear here. You can correct them."
            className="w-full rounded-2xl border border-line bg-surface px-3.5 py-3 text-[15px] leading-[23px] outline-none focus:border-primary" />
        ) : mode === "speak" ? (
          <div className="min-h-[104px] rounded-2xl border border-accent/40 bg-surface px-3.5 py-3 text-[15px] leading-[23px]">
            {text}{interim && <span className="text-ink-3"> {interim}</span>}
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-accent align-middle" />
          </div>
        ) : (
          <textarea autoFocus rows={5} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={`e.g. ${kid.firstName} ate most of her lunch and napped from 12 to 1:30.`}
            className="w-full rounded-2xl border border-line bg-surface px-3.5 py-3 text-[15px] leading-[23px] outline-none focus:border-primary" />
        )}
      </div>

      <div className="mt-3">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-3">{mode === "type" ? "Add a ready sentence, then edit it" : "Or add a ready sentence"}</div>
        <div className="grid grid-cols-4 gap-1.5">
          {TEMPLATES.map((x) => (
            <button key={x.key} type="button" disabled={demo}
              onClick={() => setText((t) => `${t.trim()}${t.trim() ? " " : ""}${x.text}`)}
              className={`flex h-14 flex-col items-center justify-center rounded-xl border text-[11.5px] font-bold transition active:scale-95
                ${x.key === "incident" ? "border-danger/30 bg-danger-soft text-danger" : "border-line bg-surface text-ink-2 hover:border-primary"}`}>
              <span className="text-[17px] leading-none">{x.icon}</span>{x.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11.5px] text-ink-3">Change any words, like the food, the times or how much was eaten.</p>
      </div>

      <button type="button" onClick={toReview} disabled={!text.trim() || listening || demo} className="btn btn-lg btn-primary mt-5 w-full">
        Continue → check entries
      </button>
      <p className="mt-2 text-center text-[11.5px] text-ink-3">Free voice typing built into the browser. Other children you mention are saved as “a friend”.</p>
    </div>
  );
}

/** Branded child picker: tap the card to switch child, with search. */
function ChildSelect({ kids, current, onPick, disabled }: { kids: Kid[]; current: Kid; onPick: (k: Kid) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  const list = kids.filter((k) => `${k.firstName} ${k.lastName}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div ref={box} className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-2xl border bg-surface p-3 text-left shadow-[var(--shadow-1)] transition disabled:opacity-60 ${open ? "border-primary" : "border-transparent"}`}>
        <Avatar first={current.firstName} last={current.lastName} bg={current.avatarBg} fg={current.avatarFg} size={44} />
        <span className="min-w-0 flex-1">
          <span className="eyebrow block">Note about</span>
          <b className="font-display block truncate text-[19px] leading-6">{current.firstName} {current.lastName}</b>
        </span>
        <span className="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] font-bold text-ink-2">
          Switch
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={`transition ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
        </span>
      </button>
      {open && (
        <div role="listbox" aria-label="Choose a child"
          className="drop-in absolute inset-x-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-3)]">
          <div className="border-b border-line p-2">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a child…"
              className="h-10 w-full rounded-xl bg-surface-2 px-3 text-[14px] outline-none" />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1.5">
            {list.map((k) => {
              const on = k.id === current.id;
              return (
                <button key={k.id} type="button" role="option" aria-selected={on}
                  onClick={() => { onPick(k); setOpen(false); setQ(""); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left ${on ? "bg-primary-soft" : "hover:bg-surface-2"}`}>
                  <Avatar first={k.firstName} last={k.lastName} bg={k.avatarBg} fg={k.avatarFg} size={34}
                    dot={STATUS_DOT[k.status] ? { color: STATUS_DOT[k.status], symbol: "" } : undefined} />
                  <span className="min-w-0 flex-1">
                    <b className={`block truncate text-[14.5px] ${on ? "text-primary" : ""}`}>{k.firstName} {k.lastName}</b>
                    <span className="text-[12px] text-ink-3">{k.entries} {k.entries === 1 ? "entry" : "entries"} today</span>
                  </span>
                  {on && <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] font-black text-white">✓</span>}
                </button>
              );
            })}
            {list.length === 0 && <p className="p-3 text-center text-[13px] text-ink-3">No child matches.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
