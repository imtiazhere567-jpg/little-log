"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { analyzeSample, saveSample, type AnalyzedGroup } from "../actions";
import { TYPE_STYLE, TypeIcon, WarnIcon } from "@/components/ui";

type Sample = { id: string; title: string; hint: string; transcript: string };
type Phase = "idle" | "recording" | "thinking" | "results" | "saved";

const fmt = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")}`;
};

export default function Recorder({ roomId, roomName, samples }: { roomId: number; roomName: string; samples: Sample[] }) {
  const router = useRouter();
  const [sample, setSample] = useState(samples[0]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [shown, setShown] = useState(0); // words of transcript revealed
  const [secs, setSecs] = useState(0);
  const [groups, setGroups] = useState<AnalyzedGroup[]>([]);
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [result, setResult] = useState<{ entries: number; incidents: number; reviews: number } | null>(null);
  const [pending, start] = useTransition();
  const [tapLabel, setTapLabel] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const downAt = useRef(0);
  const tapMode = useRef(false);
  const stopRef = useRef<() => void>(() => {});
  const words = sample.transcript.split(" ");

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  // Simulated live transcription: reveal the sample note word by word.
  function startRecording() {
    if (phase !== "idle") return;
    setPhase("recording"); setShown(0); setSecs(0);
    let w = 0, ticks = 0;
    timer.current = setInterval(() => {
      w = Math.min(words.length, w + 1); ticks++;
      setShown(w);
      if (ticks % 4 === 0) setSecs((s) => s + 1);
      // the demo note has finished: stop on its own shortly after
      if (w === words.length && ticks > words.length + 6) stopRef.current();
    }, 110);
  }

  function stopRecording() {
    if (!timer.current) return; // already stopped
    clearInterval(timer.current);
    timer.current = null;
    setShown(words.length);
    setPhase("thinking");
    start(async () => {
      const g = await analyzeSample(sample.id, roomId);
      await new Promise((r) => setTimeout(r, 900)); // let the "AI is sorting" moment breathe
      setGroups(g); setChoices({}); setPhase("results");
    });
  }

  function save() {
    start(async () => {
      const r = await saveSample(sample.id, roomId, choices);
      setResult(r); setPhase("saved");
      router.refresh();
    });
  }

  useEffect(() => {
    stopRef.current = () => { if (phase === "recording") stopRecording(); };
  });

  function onDown() {
    if (phase === "idle") { downAt.current = Date.now(); tapMode.current = false; setTapLabel(false); startRecording(); }
    else if (phase === "recording" && tapMode.current) stopRecording();
  }
  function onUp() {
    if (phase !== "recording" || tapMode.current) return;
    if (Date.now() - downAt.current < 400) { tapMode.current = true; setTapLabel(true); } // a quick tap: keep recording
    else stopRecording();
  }

  const unresolved = groups.filter((g) => !g.childId && !choices[g.name]);

  // ---------------- results (T4) ----------------
  if (phase === "results" || phase === "saved") {
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    return (
      <div className="px-[18px]">
        <button onClick={() => setPhase("idle")} className="mt-1 text-sm font-bold text-primary">← Record again</button>
        <div className="eyebrow mt-3">AI results · {roomName} Room</div>
        <h1 className="font-display mt-0.5 text-[28px] font-semibold leading-[33px]">
          Found {total} {total === 1 ? "entry" : "entries"} for {groups.length} {groups.length === 1 ? "child" : "children"}
        </h1>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-3.5 text-sm leading-[21px] text-ink-2">
          <div className="eyebrow mb-1">Transcript</div>“{sample.transcript}”
        </div>

        <div className="mt-4 grid gap-3">
          {groups.map((g) => {
            const picked = choices[g.name];
            const pickedName = g.candidates.find((c) => c.id === picked)?.name;
            const needsPick = !g.childId;
            return (
              <div key={g.name} className={`rounded-[20px] border bg-surface p-3.5 shadow-[var(--shadow-1)] ${needsPick && !picked ? "border-l-4 border-line border-l-warning" : "border-line"}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">
                    {g.childName ?? pickedName ?? <>“{g.name}”?</>}
                  </h3>
                  {needsPick && !picked && <span className="badge bg-warning-soft text-[#8A5E0F]">Needs review</span>}
                  {needsPick && picked && <span className="badge bg-success-soft text-[#2C6B42]">✓ You picked</span>}
                </div>
                {needsPick && phase === "results" && (
                  <div className="mt-2">
                    <p className="text-[13px] text-ink-2">
                      {g.candidates.length ? `“${g.name}” matches ${g.candidates.length} children. Which one did you mean?` : `No child called “${g.name}” in this room.`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {g.candidates.map((c) => (
                        <button key={c.id} onClick={() => setChoices((x) => ({ ...x, [g.name]: c.id }))}
                          className={`h-10 rounded-full border px-3.5 text-sm font-semibold ${picked === c.id ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface-2"}`}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-1">
                  {g.items.map((it, i) => it.type === "incident" ? (
                    <div key={i} className="mt-2 flex gap-3 rounded-2xl bg-danger-soft p-3">
                      <span className="grid h-8 w-8 flex-none place-items-center rounded-[10px] bg-danger"><WarnIcon size={16} /></span>
                      <div className="text-sm leading-5">
                        <b>Incident draft · {fmt(it.time)}</b>
                        <div className="text-ink-2">{it.description} {it.injury}. {it.actionTaken}</div>
                        <div className="mt-1 text-xs font-bold text-danger">Goes to the director first, never straight to the parent</div>
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="grid grid-cols-[32px_1fr_auto] items-center gap-3 border-b border-dashed border-line py-2.5 last:border-0">
                      <TypeIcon type={it.type} />
                      <div>
                        <div className={`text-xs font-bold ${TYPE_STYLE[it.type].fg}`}>{("label" in it && it.label) || TYPE_STYLE[it.type].label}</div>
                        <div className="text-sm">{it.type === "nap" && "endTime" in it && it.endTime ? `${fmt(it.time)} – ${fmt(it.endTime)}` : it.details}</div>
                      </div>
                      <span className="tabular text-[13px] font-semibold text-ink-3">{fmt(it.time)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {phase === "results" ? (
          <div className="mt-4">
            {unresolved.length > 0 && (
              <p className="mb-2 text-center text-[13px] text-ink-2">
                Unclear names can be saved as “needs review” and fixed later on the Today screen.
              </p>
            )}
            <button onClick={save} disabled={pending} className="btn btn-lg btn-primary w-full">
              {pending ? "Saving…" : "Save entries"}
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-[20px] bg-primary-soft p-4 text-center">
            <div className="font-display text-xl font-semibold text-primary">Saved ✓</div>
            <p className="mt-1 text-sm text-ink-2">
              {result?.entries} entries saved
              {result?.incidents ? `, ${result.incidents} incident sent to the director` : ""}
              {result?.reviews ? `, ${result.reviews} waiting for review` : ""}.
            </p>
            <div className="mt-3 flex gap-2">
              <Link href="/app/teacher" className="btn btn-sm btn-primary flex-1">Back to Today</Link>
              <button onClick={() => setPhase("idle")} className="btn btn-sm btn-secondary flex-1">Record another</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------- recording (T3) ----------------
  const recording = phase === "recording";
  return (
    <div className="flex min-h-[calc(100vh-190px)] flex-col px-[18px]">
      <div className="mt-1 flex items-center justify-between">
        <Link href="/app/teacher/record" className="text-sm font-bold text-primary">← One child</Link>
        <span className="eyebrow">{roomName} Room</span>
      </div>
      <h1 className="font-display mt-3 text-[28px] font-semibold leading-[33px]">
        {recording ? "Listening…" : phase === "thinking" ? "Sorting by child…" : "New voice note"}
      </h1>
      <p className="mt-1 text-sm text-ink-2">
        {recording ? "Speak naturally. Release when you're done." : phase === "thinking"
          ? "The AI is matching names to children in your room."
          : "Hold the button and speak. Mention each child by name."}
      </p>

      {phase === "idle" && (
        <div className="mt-4">
          <div className="eyebrow mb-2">Demo note to play</div>
          <div className="grid gap-2">
            {samples.map((s) => (
              <button key={s.id} onClick={() => setSample(s)}
                className={`flex items-center justify-between rounded-2xl border px-3.5 py-3 text-left ${s.id === sample.id ? "border-primary bg-primary-soft" : "border-line bg-surface"}`}>
                <span>
                  <b className="block text-[15px]">{s.title}</b>
                  <span className="text-[13px] text-ink-2">{s.hint}</span>
                </span>
                <span className={`h-5 w-5 rounded-full border-2 ${s.id === sample.id ? "border-[6px] border-primary" : "border-line"}`} />
              </button>
            ))}
          </div>
        </div>
      )}

      {(recording || phase === "thinking") && (
        <div className="mt-5 min-h-[120px] rounded-2xl border border-line bg-surface p-4 text-[15px] leading-[23px]">
          {words.slice(0, shown).join(" ")}
          {recording && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-accent align-middle" />}
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
        {phase === "thinking" ? (
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-3 w-3 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        ) : (
          <>
            <button
              aria-label={recording ? "Stop recording" : "Hold to record"}
              onPointerDown={onDown}
              onPointerUp={onUp}
              onPointerLeave={() => recording && !tapMode.current && stopRecording()}
              className={`relative grid h-[112px] w-[112px] select-none place-items-center rounded-full shadow-[0_10px_30px_rgba(232,149,90,.45)] transition ${recording ? "pulse-ring bg-[#D0663A]" : "bg-accent"}`}
              style={{ touchAction: "none" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" className="h-[42px] w-[42px]">
                <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" />
              </svg>
            </button>
            {recording ? (
              <>
                <div className="mt-6 flex h-8 items-center gap-1">
                  {Array.from({ length: 11 }).map((_, i) => (
                    <i key={i} className="wave-bar block w-1 rounded bg-accent" style={{ height: 8 + ((i * 7) % 24), animationDelay: `${(i % 5) * 0.12}s` }} />
                  ))}
                </div>
                <div className="tabular mt-2 text-[28px] font-bold">0:{String(secs).padStart(2, "0")}</div>
                <div className="text-sm text-ink-2">{tapLabel ? "Tap to stop" : "Release to stop"}</div>
              </>
            ) : (
              <div className="mt-4 text-sm font-bold text-accent-ink">Hold to record · or tap to start</div>
            )}
          </>
        )}
      </div>
      <p className="pb-2 text-center text-[11.5px] text-ink-3">
        Demo mode: plays the selected sample note instead of your microphone.
      </p>
    </div>
  );
}
