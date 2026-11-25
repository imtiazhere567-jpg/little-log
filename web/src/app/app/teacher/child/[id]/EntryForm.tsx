"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import TimePicker from "@/components/TimePicker";
import { TYPE_STYLE } from "@/components/ui";
import { addEntry, updateEntry } from "../../actions";

type EntryType = "meal" | "nap" | "diaper" | "activity" | "mood" | "note";
export type EditableEntry = { id: number; type: EntryType; label: string | null; details: string; time: string; endTime: string | null };

const TYPES: EntryType[] = ["meal", "nap", "diaper", "activity", "mood", "note"];
const MEALS = ["Breakfast", "Morning snack", "Lunch", "Afternoon snack", "Bottle"];
const AMOUNTS = ["Ate all of it", "Ate most of it", "Ate half", "Ate a little", "Didn't eat"];
const DIAPERS = ["Wet", "Dirty", "Dry", "Used the toilet"];
const MOODS = ["Happy", "Calm", "Playful", "Curious", "Tired", "Upset"];
const ACTIVITY_IDEAS = ["Story time", "Finger painting", "Outdoor play", "Building blocks", "Music & singing", "Sensory play"];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`h-10 rounded-full border px-3.5 text-[13.5px] font-semibold transition ${on ? "border-primary bg-primary text-white" : "border-line bg-surface-2 text-ink-2 hover:border-primary"}`}>
      {children}
    </button>
  );
}

/** Preset chips plus "+ Other" for anything not in the list (the typed text becomes the value). */
function ChoiceChips({ options, value, onChange, placeholder, display = (x: string) => x, grid }: {
  options: string[]; value: string; onChange: (v: string) => void; placeholder: string;
  display?: (x: string) => string; grid?: boolean;
}) {
  const custom = value !== "" && !options.includes(value);
  const [other, setOther] = useState(custom);
  return (
    <div>
      <div className={grid ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-1.5"}>
        {options.map((x) => <Chip key={x} on={!other && value === x} onClick={() => { setOther(false); onChange(x); }}>{display(x)}</Chip>)}
        <Chip on={other} onClick={() => { setOther(true); if (!custom) onChange(""); }}>＋ Other</Chip>
      </div>
      {other && (
        <input autoFocus value={custom ? value : ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={60}
          className="mt-2 h-11 w-full rounded-xl border border-primary bg-surface px-3 text-[15px] outline-none focus:shadow-[0_0_0_3px_rgba(47,111,98,.12)]" />
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-3">{children}</div>;
}

/** Split saved meal details "Pasta: ate most of it" back into food + amount for editing. */
function parseMeal(details: string) {
  const i = details.lastIndexOf(":");
  const food = i > 0 ? details.slice(0, i).trim() : "";
  const amt = (i > 0 ? details.slice(i + 1) : details).trim().toLowerCase();
  const known = AMOUNTS.find((a) => a.toLowerCase() === amt);
  return { food, amount: known ?? (amt ? amt.charAt(0).toUpperCase() + amt.slice(1) : "") };
}

export default function EntryForm({ childId, firstName, tz, entry }: { childId: number; firstName: string; tz: string; entry?: EditableEntry }) {
  const now = () => new Date().toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
  const meal = entry?.type === "meal" ? parseMeal(entry.details) : { food: "", amount: "" };
  const [type, setType] = useState<EntryType>(entry?.type ?? "meal");
  const [time, setTime] = useState(entry?.time ?? now());
  const [endTime, setEndTime] = useState(entry?.endTime ?? "");
  const [label, setLabel] = useState(entry?.label ?? "Lunch");
  const [food, setFood] = useState(meal.food);
  const [amount, setAmount] = useState(meal.amount);
  const [choice, setChoice] = useState(entry && (entry.type === "diaper" || entry.type === "mood") ? entry.details.split(",")[0] : "");
  const [text, setText] = useState(entry && ["activity", "note"].includes(entry.type) ? entry.details
    : entry?.type === "mood" ? entry.details.split(",").slice(1).join(",").trim() : "");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // the sentence saved for this entry (what the AI would have written)
  const details = type === "meal" ? (amount ? (food.trim() ? `${food.trim()}: ${amount.toLowerCase()}` : amount) : "")
    : type === "nap" ? "Nap"
    : type === "diaper" ? choice
    : type === "mood" ? (choice ? (text.trim() ? `${choice}, ${text.trim()}` : choice) : "")
    : text.trim();
  const missing = type === "meal" && !label.trim() ? "Choose or type which meal"
    : !details ? (type === "meal" ? "Choose how much was eaten"
    : type === "diaper" ? "Choose wet, dirty, dry or toilet" : type === "mood" ? "Choose a mood" : "Write what happened") : "";
  const napBad = type === "nap" && endTime && endTime <= time ? "The nap must end after it starts" : "";

  function reset() {
    setFood(""); setAmount(""); setChoice(""); setText(""); setEndTime(""); setTime(now());
  }

  function submit(fd: FormData) {
    if (missing || napBad) { setError(missing || napBad); return; }
    setError("");
    start(async () => {
      try {
        if (entry) await updateEntry(fd);
        else { await addEntry(fd); reset(); setDone(`Added ${TYPE_STYLE[type].label.toLowerCase()} for ${firstName}`); setTimeout(() => setDone(""), 2500); }
      } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save"); }
    });
  }

  return (
    <form ref={formRef} action={submit} className="card grid gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="eyebrow">{entry ? "Edit entry" : "Add an entry"}</div>
        {entry && <Link href={`/app/teacher/child/${childId}`} className="text-[13px] font-bold text-ink-3">Cancel</Link>}
      </div>
      <input type="hidden" name="childId" value={childId} />
      {entry && <input type="hidden" name="entryId" value={entry.id} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="details" value={details} />
      {type === "meal" && <input type="hidden" name="label" value={label} />}

      {/* type */}
      <div className="grid grid-cols-3 gap-2">
        {TYPES.map((t) => {
          const st = TYPE_STYLE[t], on = t === type;
          return (
            <button key={t} type="button" onClick={() => { if (t !== type) setChoice(""); setType(t); setError(""); }} aria-pressed={on}
              className={`flex h-[62px] flex-col items-center justify-center gap-0.5 rounded-2xl border text-[12.5px] font-bold transition
                ${on ? `border-transparent ${st.bg} ${st.fg} ring-2 ring-current` : "border-line bg-surface text-ink-2 hover:bg-surface-2"}`}>
              <span className="text-[20px] leading-none">{st.icon}</span>{t === "diaper" ? "Diaper" : st.label}
            </button>
          );
        })}
      </div>

      {/* time(s) */}
      {type === "nap" ? (
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Fell asleep</Label><TimePicker name="time" value={time} onChange={setTime} now={now} /></div>
          <div><Label>Woke up</Label><TimePicker name="endTime" value={endTime} onChange={setEndTime} now={now} placeholder="Still sleeping" optional /></div>
        </div>
      ) : (
        <div><Label>Time</Label><TimePicker name="time" value={time} onChange={setTime} now={now} /></div>
      )}

      {/* type-specific fields */}
      {type === "meal" && (
        <>
          <div><Label>Which meal</Label>
            <ChoiceChips options={MEALS} value={label} onChange={setLabel} placeholder="e.g. Dinner, Late snack" />
          </div>
          <div><Label>What was served (optional)</Label>
            <input value={food} onChange={(e) => setFood(e.target.value)} placeholder="e.g. Pasta with veggies"
              className="h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-[15px] outline-none focus:border-primary" />
          </div>
          <div><Label>How much</Label>
            <ChoiceChips options={AMOUNTS} value={amount} onChange={setAmount} placeholder="e.g. Tried a few bites" display={(x) => x.replace("Ate ", "")} />
          </div>
        </>
      )}
      {type === "diaper" && (
        <div><Label>Diaper / toilet</Label>
          <ChoiceChips options={DIAPERS} value={choice} onChange={setChoice} placeholder="e.g. Wet, cream applied" grid />
        </div>
      )}
      {type === "mood" && (
        <>
          <div><Label>Mood</Label>
            <ChoiceChips options={MOODS} value={choice} onChange={setChoice} placeholder="e.g. Sleepy but happy" />
          </div>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Anything to add? (optional)"
            className="h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-[15px] outline-none focus:border-primary" />
        </>
      )}
      {(type === "activity" || type === "note") && (
        <div>
          <Label>{type === "activity" ? "What did they do" : "Note"}</Label>
          {type === "activity" && (
            <div className="mb-2 flex flex-wrap gap-1.5">{ACTIVITY_IDEAS.map((x) => <Chip key={x} on={text === x} onClick={() => setText(x)}>{x}</Chip>)}</div>
          )}
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={type === "activity" ? "e.g. Built a tower with a friend" : "e.g. Brought a new teddy from home"}
            className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[15px] leading-6 outline-none focus:border-primary" />
          <p className="mt-1 text-xs text-ink-3">Write other children as “a friend”: parents never see other names.</p>
        </div>
      )}

      {details && !error && <p className="rounded-xl bg-primary-soft/60 px-3 py-2 text-[13px] text-ink-2">Will save: <b className="text-ink">{TYPE_STYLE[type].icon} {type === "meal" ? `${label} · ` : ""}{details}</b></p>}
      {(error || napBad) && <p className="text-[13px] font-semibold text-danger">{error || napBad}</p>}
      {done && <p className="drop-in rounded-xl bg-success-soft px-3 py-2 text-[13px] font-semibold text-[#2C6B42]">✓ {done}</p>}

      <button disabled={pending} className="btn btn-primary">{pending ? "Saving…" : entry ? "Save changes" : "Add entry"}</button>
    </form>
  );
}
