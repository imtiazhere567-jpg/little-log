"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BrandPicker from "@/components/BrandPicker";
import DateField from "@/components/DateField";
import { enrollFamily, type EnrollParent } from "../manage-actions";

type Room = { id: number; name: string; ageGroup: string; color: string; months: [number, number]; count: number };
type ExistingParent = { id: number; name: string; email: string; phone: string; children: string[] };
type ParentDraft = {
  mode: "new" | "existing";
  existingId: number | null;
  name: string; email: string; phone: string; relationship: string; whatsapp: boolean;
};

const RELATIONSHIPS = ["Mother", "Father", "Guardian", "Grandparent", "Other"];
const STEPS = [
  { key: "child", title: "Child", hint: "Name, age and room" },
  { key: "parents", title: "Parents", hint: "Who gets the reports" },
  { key: "review", title: "Consent & review", hint: "Check and enroll" },
] as const;

const blankParent = (relationship: string): ParentDraft => ({ mode: "new", existingId: null, name: "", email: "", phone: "", relationship, whatsapp: true });
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());
const inputCls = "h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(47,111,98,.12)]";

function monthsBetween(dob: string, today: string) {
  if (!dob) return null;
  const a = new Date(dob + "T12:00:00Z"), b = new Date(today + "T12:00:00Z");
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m--;
  return m;
}
const ageText = (m: number) => (m < 24 ? `${m} months old` : `${Math.floor(m / 12)} years old`);

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between">
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">{children}</span>
      {hint && <span className="text-[11px] text-ink-3">{hint}</span>}
    </span>
  );
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left">
      <span className="min-w-0 flex-1"><b className="block text-[15px]">{label}</b>{hint && <span className="text-[13px] text-ink-2">{hint}</span>}</span>
      <span className={`flex h-7 w-12 flex-none items-center rounded-full p-0.5 transition ${on ? "bg-primary" : "bg-line"}`}>
        <span className={`h-6 w-6 rounded-full bg-white shadow transition ${on ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

// half-hour steps for the usual drop-off / pick-up times
const TIMES = Array.from({ length: 27 }, (_, i) => {
  const m = 6 * 60 + 30 + i * 30, h = Math.floor(m / 60), mm = m % 60;
  return { value: `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, label: `${h % 12 || 12}:${String(mm).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}` };
});
const timeLabel = (v: string) => TIMES.find((t) => t.value === v)?.label ?? v;
const PICKUP_RELATIONS = ["Grandmother", "Grandfather", "Aunt", "Uncle", "Nanny", "Family friend", "Other"];
type PickupDraft = { name: string; relationship: string; phone: string };

export default function EnrollWizard({ rooms, parents, today }: { rooms: Room[]; parents: ExistingParent[]; today: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState<Record<number, boolean>>({});
  const [child, setChild] = useState({ firstName: "", lastName: "", dateOfBirth: "", roomId: 0, medicalNotes: "", expectedIn: "08:00", expectedOut: "17:00" });
  const [pickups, setPickups] = useState<PickupDraft[]>([]);
  const [roomTouched, setRoomTouched] = useState(false);
  const [ps, setPs] = useState<ParentDraft[]>([blankParent("Mother")]);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const months = monthsBetween(child.dateOfBirth, today);
  const suggested = months === null ? null : rooms.find((r) => months >= r.months[0] && months <= r.months[1]) ?? null;
  const roomId = roomTouched ? child.roomId : suggested?.id ?? child.roomId;
  const room = rooms.find((r) => r.id === roomId);

  // ---------------- validation per step
  const childErrors = {
    firstName: !child.firstName.trim() && "Required",
    lastName: !child.lastName.trim() && "Required",
    dateOfBirth: !child.dateOfBirth ? "Required" : months !== null && (months < 0 || months > 72) ? "Check the date: the center takes 6 months to 5 years" : "",
    room: !roomId && "Choose a room",
    hours: child.expectedOut <= child.expectedIn && "Pick-up must be after drop-off",
  };
  const parentErrors = ps.map((p): Record<string, string | false> => p.mode === "existing"
    ? { pick: !p.existingId && "Choose a parent" }
    : { name: !p.name.trim() && "Required", email: !emailOk(p.email) && "Enter a valid email" });
  const dupExisting = (() => {
    const ids = ps.filter((p) => p.mode === "existing" && p.existingId).map((p) => p.existingId);
    return ids.length !== new Set(ids).size;
  })();
  const valid = [
    !Object.values(childErrors).some(Boolean),
    !parentErrors.some((e) => Object.values(e).some(Boolean)) && !dupExisting && pickups.every((p) => p.name.trim()),
    true,
  ];
  const show = (i: number) => tried[i];

  function go(to: number) {
    if (to > step) {
      for (let i = step; i < to; i++) {
        if (!valid[i]) { setTried((t) => ({ ...t, [i]: true })); setStep(i); return; }
      }
    }
    setError("");
    setStep(to);
  }

  function submit() {
    if (!valid[0] || !valid[1]) { setTried({ 0: true, 1: true }); setStep(valid[0] ? 1 : 0); return; }
    const payload: EnrollParent[] = ps.map((p) => p.mode === "existing"
      ? { mode: "existing", id: p.existingId!, relationship: p.relationship }
      : { mode: "new", name: p.name, email: p.email, phone: p.phone, relationship: p.relationship, whatsapp: p.whatsapp });
    start(async () => {
      const r = await enrollFamily({ child: { ...child, roomId: roomId! }, parents: payload, photoConsent, pickups });
      if (!r.ok) { setError(r.error); return; }
      router.push(`/director/children/${r.childId}?saved=enrolled`);
    });
  }

  const setParent = (i: number, patch: Partial<ParentDraft>) => setPs((xs) => xs.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const initials = `${child.firstName[0] ?? ""}${child.lastName[0] ?? ""}`.toUpperCase() || "?";
  const parentLabel = (p: ParentDraft) => p.mode === "existing" ? parents.find((x) => x.id === p.existingId)?.name ?? "" : p.name;

  return (
    <div className="w-full max-w-[1760px]">
      <Link href="/director/children" className="text-sm font-bold text-primary">← Children</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">New enrollment</div>
          <h1 className="font-display text-[34px] font-semibold leading-10">Enroll a child</h1>
          <p className="mt-1 text-ink-2">Register the child and their parents together. Parents can only ever see the children linked to them here.</p>
        </div>
      </div>

      {/* step tabs */}
      <ol className="mt-6 grid gap-2 sm:grid-cols-3" role="tablist">
        {STEPS.map((s, i) => {
          const on = i === step, done = i < step && valid[i];
          return (
            <li key={s.key}>
              <button type="button" role="tab" aria-selected={on} onClick={() => go(i)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition
                  ${on ? "border-primary bg-surface shadow-[var(--shadow-2)]" : "border-line bg-surface/60 hover:bg-surface"}`}>
                <span className={`grid h-9 w-9 flex-none place-items-center rounded-full text-sm font-extrabold
                  ${done ? "bg-success text-white" : on ? "bg-primary text-white" : "bg-surface-2 text-ink-3"}`}>
                  {done ? "✓" : i + 1}
                </span>
                <span className="min-w-0">
                  <b className={`block text-[15px] ${on ? "" : "text-ink-2"}`}>{s.title}</b>
                  <span className="block truncate text-xs text-ink-3">{s.hint}</span>
                </span>
                {show(i) && !valid[i] && <span className="ml-auto h-2.5 w-2.5 rounded-full bg-danger" title="Needs attention" />}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 grid items-start gap-6 xl:grid-cols-[1fr_360px]">
        <section className="card p-6 md:p-7">
          {/* ---------------- step 1: child */}
          {step === 0 && (
            <div className="grid gap-5">
              <h2 className="font-display text-[22px] font-semibold">About the child</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label><Label>First name</Label>
                  <input autoFocus value={child.firstName} onChange={(e) => setChild({ ...child, firstName: e.target.value })} className={inputCls} placeholder="e.g. Olivia" />
                  {show(0) && childErrors.firstName && <Err>{childErrors.firstName}</Err>}
                </label>
                <label><Label>Last name</Label>
                  <input value={child.lastName} onChange={(e) => setChild({ ...child, lastName: e.target.value })} className={inputCls} placeholder="e.g. Harper" />
                  {show(0) && childErrors.lastName && <Err>{childErrors.lastName}</Err>}
                </label>
                <div><Label hint={months !== null && months >= 0 ? ageText(months) : undefined}>Date of birth</Label>
                  <DateField value={child.dateOfBirth} max={today} ariaLabel="Date of birth" placeholder="Pick the birthday"
                    initialView={`${Number(today.slice(0, 4)) - 1}${today.slice(4)}`} onChange={(v) => setChild({ ...child, dateOfBirth: v })} />
                  {show(0) && childErrors.dateOfBirth && <Err>{childErrors.dateOfBirth}</Err>}
                </div>
              </div>

              <div>
                <Label hint={suggested && !roomTouched ? `Suggested from age: ${suggested.name}` : undefined}>Room</Label>
                <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
                  {rooms.map((r) => {
                    const on = r.id === roomId;
                    return (
                      <button key={r.id} type="button" onClick={() => { setRoomTouched(true); setChild({ ...child, roomId: r.id }); }}
                        className={`relative rounded-2xl border p-4 text-left transition ${on ? "border-primary bg-primary-soft/60 shadow-[var(--shadow-1)]" : "border-line bg-surface hover:bg-surface-2/60"}`}>
                        <span className="flex items-center gap-2 font-bold"><span className="h-3 w-3 rounded-full" style={{ background: r.color }} />{r.name}</span>
                        <span className="mt-0.5 block text-xs text-ink-3">{r.ageGroup} · {r.count} children</span>
                        {suggested?.id === r.id && <span className="badge mt-2 bg-accent-soft text-accent-ink">Fits age</span>}
                        {on && <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] font-black text-white">✓</span>}
                      </button>
                    );
                  })}
                </div>
                {show(0) && childErrors.room && <Err>{childErrors.room}</Err>}
              </div>

              <div>
                <Label hint="Used for check-in reminders: parents get a message 30 minutes after this time if the child hasn't arrived">Usual hours</Label>
                <div className="grid max-w-[460px] grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <BrandPicker ariaLabel="Usual drop-off time" value={child.expectedIn} options={TIMES} onChange={(v) => setChild({ ...child, expectedIn: v })} />
                  <span className="text-sm font-semibold text-ink-3">to</span>
                  <BrandPicker ariaLabel="Usual pick-up time" value={child.expectedOut} options={TIMES} onChange={(v) => setChild({ ...child, expectedOut: v })} />
                </div>
                {childErrors.hours && <Err>{childErrors.hours}</Err>}
              </div>

              <label><Label hint="Teachers see this on the child's page">Allergies & medical notes (optional)</Label>
                <textarea rows={3} value={child.medicalNotes} onChange={(e) => setChild({ ...child, medicalNotes: e.target.value })}
                  placeholder="e.g. Peanut allergy, carries an EpiPen" className={`${inputCls} h-auto py-2.5 leading-6`} />
              </label>
            </div>
          )}

          {/* ---------------- step 2: parents */}
          {step === 1 && (
            <div className="grid gap-5">
              <div>
                <h2 className="font-display text-[22px] font-semibold">Parents & guardians</h2>
                <p className="mt-1 text-sm text-ink-2">Add up to two. Already have a sibling here? Choose “Existing parent” so the family shares one account.</p>
              </div>
              {ps.map((p, i) => {
                const e = parentErrors[i];
                return (
                  <div key={i} className="rounded-2xl border border-line bg-bg p-5">
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-bold text-white">{i + 1}</span>
                      <b className="text-[16px]">Parent {i + 1}{i === 0 ? "" : " (optional)"}</b>
                      <div className="ml-auto flex rounded-xl border border-line bg-surface p-1">
                        {(["new", "existing"] as const).map((m) => (
                          <button key={m} type="button" onClick={() => setParent(i, { mode: m })}
                            className={`rounded-lg px-3 py-1.5 text-[13px] font-bold ${p.mode === m ? "bg-primary text-white" : "text-ink-2 hover:bg-surface-2"}`}>
                            {m === "new" ? "New parent" : "Existing parent"}
                          </button>
                        ))}
                      </div>
                      {i > 0 && <button type="button" onClick={() => setPs((xs) => xs.filter((_, j) => j !== i))} className="text-[13px] font-bold text-danger">Remove</button>}
                    </div>

                    {p.mode === "new" ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <label><Label>Full name</Label>
                          <input value={p.name} onChange={(ev) => setParent(i, { name: ev.target.value })} className={inputCls} placeholder="e.g. Jessica Harper" />
                          {show(1) && e.name && <Err>{e.name}</Err>}
                        </label>
                        <label><Label>Relationship</Label>
                          <BrandPicker ariaLabel="Relationship" value={p.relationship} onChange={(v) => setParent(i, { relationship: v })}
                            options={RELATIONSHIPS.map((r) => ({ value: r, label: r }))} />
                        </label>
                        <label><Label hint="Login + report emails">Email</Label>
                          <input type="email" value={p.email} onChange={(ev) => setParent(i, { email: ev.target.value })} className={inputCls} placeholder="name@example.com" />
                          {show(1) && e.email && <Err>{e.email}</Err>}
                        </label>
                        <label><Label hint="WhatsApp / SMS">Phone</Label>
                          <input value={p.phone} onChange={(ev) => setParent(i, { phone: ev.target.value })} className={inputCls} placeholder="+1 555 0123" />
                        </label>
                        <div className="md:col-span-2">
                          <Toggle on={p.whatsapp} onChange={(v) => setParent(i, { whatsapp: v })} label="Send WhatsApp notifications"
                            hint="The parent agreed to get “report is ready” messages on WhatsApp" />
                        </div>
                      </div>
                    ) : (
                      <ExistingPicker parents={parents} value={p.existingId} onPick={(id) => setParent(i, { existingId: id })}
                        relationship={p.relationship} onRelationship={(r) => setParent(i, { relationship: r })} error={show(1) ? (e.pick || "") : ""} />
                    )}
                  </div>
                );
              })}
              {dupExisting && <Err>The same parent is chosen twice.</Err>}
              {/* other adults allowed to pick up */}
              <div className="rounded-2xl border border-line bg-bg p-5">
                <b className="text-[16px]">Who else may pick up {child.firstName || "the child"}?</b>
                <p className="mt-0.5 text-[13px] text-ink-2">Parents can always pick up. Add grandparents, a nanny or a friend. Teachers can only check the child out to people on this list.</p>
                <div className="mt-3 grid gap-2">
                  {pickups.map((p, i) => (
                    <div key={i} className="grid items-start gap-2 md:grid-cols-[1.4fr_1fr_1fr_auto]">
                      <div>
                        <input value={p.name} onChange={(ev) => setPickups((xs) => xs.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))}
                          placeholder="Full name" aria-label="Pickup person name" className={inputCls} />
                        {show(1) && !p.name.trim() && <Err>Required</Err>}
                      </div>
                      <BrandPicker ariaLabel="Relationship" value={p.relationship} options={PICKUP_RELATIONS.map((r) => ({ value: r, label: r }))}
                        onChange={(v) => setPickups((xs) => xs.map((x, j) => (j === i ? { ...x, relationship: v } : x)))} />
                      <input value={p.phone} onChange={(ev) => setPickups((xs) => xs.map((x, j) => (j === i ? { ...x, phone: ev.target.value } : x)))}
                        placeholder="Phone" aria-label="Pickup person phone" className={inputCls} />
                      <button type="button" onClick={() => setPickups((xs) => xs.filter((_, j) => j !== i))} aria-label="Remove"
                        className="grid h-11 w-11 place-items-center rounded-xl border border-line text-ink-3 hover:border-danger hover:text-danger">✕</button>
                    </div>
                  ))}
                </div>
                {pickups.length < 4 && (
                  <button type="button" onClick={() => setPickups((xs) => [...xs, { name: "", relationship: "Grandmother", phone: "" }])}
                    className="mt-3 text-sm font-bold text-primary hover:underline">＋ Add a person</button>
                )}
              </div>

              {ps.length < 2 && (
                <button type="button" onClick={() => setPs((xs) => [...xs, blankParent(xs[0]?.relationship === "Mother" ? "Father" : "Mother")])}
                  className="flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-sm font-bold text-ink-2 hover:border-primary hover:text-primary">
                  ＋ Add a second parent or guardian
                </button>
              )}
            </div>
          )}

          {/* ---------------- step 3: consent + review */}
          {step === 2 && (
            <div className="grid gap-5">
              <h2 className="font-display text-[22px] font-semibold">Consent & review</h2>
              <Toggle on={photoConsent} onChange={setPhotoConsent} label="Photo consent"
                hint="Off by default. Turn on only if a parent signed the photo consent form." />
              <div className="grid gap-3 md:grid-cols-2">
                <Review title="Child" onEdit={() => go(0)} rows={[
                  ["Name", `${child.firstName} ${child.lastName}`],
                  ["Date of birth", child.dateOfBirth ? `${child.dateOfBirth} (${ageText(months ?? 0)})` : "–"],
                  ["Room", room ? `${room.name} · ${room.ageGroup}` : "–"],
                  ["Medical notes", child.medicalNotes || "None"],
                  ["Usual hours", `${timeLabel(child.expectedIn)} – ${timeLabel(child.expectedOut)}`],
                ]} />
                <Review title="Parents" onEdit={() => go(1)} rows={ps.map((p) => [
                  `${p.relationship}`,
                  p.mode === "existing" ? `${parentLabel(p)} (existing account)` : `${p.name} · ${p.email}${p.whatsapp ? " · WhatsApp ✓" : ""}`,
                ] as [string, string]).concat(pickups.length ? [["May also pick up", pickups.map((p) => `${p.name} (${p.relationship})`).join(", ")]] : [])} />
              </div>
              <div className="rounded-2xl bg-primary-soft/60 px-4 py-3 text-sm leading-6 text-ink-2">
                <b className="text-ink">What happens next:</b> {child.firstName || "The child"} appears in the {room?.name ?? "chosen"} Room for the teachers today.
                New parents get an invite to set up their Littlelog account. In this demo you can open their app straight away with “View as parent”.
              </div>
              {error && <Err>{error}</Err>}
            </div>
          )}

          {/* footer buttons */}
          <div className="mt-7 flex items-center justify-between border-t border-line pt-5">
            {step > 0 ? <button type="button" onClick={() => go(step - 1)} className="btn btn-secondary">← Back</button> : <span />}
            {step < 2 ? (
              <button type="button" onClick={() => go(step + 1)} className="btn btn-primary">Continue →</button>
            ) : (
              <button type="button" onClick={submit} disabled={pending} className="btn btn-lg btn-primary">
                {pending ? "Enrolling…" : `Enroll ${child.firstName || "child"}`}
              </button>
            )}
          </div>
        </section>

        {/* live summary */}
        <aside className="card sticky top-6 overflow-hidden">
          <div className="h-2" style={{ background: room?.color ?? "#E7DFD2" }} />
          <div className="p-6">
            <div className="eyebrow">Enrollment summary</div>
            <div className="mt-4 flex items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-lg font-bold text-accent-ink">{initials}</span>
              <span className="min-w-0">
                <b className="font-display block truncate text-[20px] leading-6">{`${child.firstName} ${child.lastName}`.trim() || "New child"}</b>
                <span className="text-sm text-ink-2">{months !== null && months >= 0 ? ageText(months) : "Age not set"}</span>
              </span>
            </div>
            <dl className="mt-5 grid gap-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Room</dt>
                <dd className="flex items-center gap-1.5 font-semibold">{room ? <><span className="h-2.5 w-2.5 rounded-full" style={{ background: room.color }} />{room.name}</> : "–"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Photo consent</dt><dd className="font-semibold">{photoConsent ? "Yes" : "No"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Medical notes</dt><dd className="truncate font-semibold">{child.medicalNotes ? "Yes" : "None"}</dd></div>
            </dl>
            <div className="eyebrow mb-2 mt-5">Parents</div>
            <div className="grid gap-2">
              {ps.map((p, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl bg-surface-2/70 px-3 py-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-white">
                    {(parentLabel(p) || "?").split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 text-sm"><b className="block truncate">{parentLabel(p) || `Parent ${i + 1}`}</b>
                    <span className="text-xs text-ink-3">{p.relationship}{p.mode === "existing" ? " · existing account" : p.whatsapp ? " · WhatsApp" : ""}</span></span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-1">
              {STEPS.map((s, i) => <span key={s.key} className={`h-1.5 rounded-full ${i < step || (i === step && i === 2) ? "bg-success" : i === step ? "bg-primary" : "bg-surface-2"}`} />)}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Err({ children }: { children: React.ReactNode }) {
  return <span className="mt-1.5 block text-[12.5px] font-semibold text-danger">{children}</span>;
}

function Review({ title, rows, onEdit }: { title: string; rows: [string, string][]; onEdit: () => void }) {
  return (
    <div className="rounded-2xl border border-line bg-bg p-4">
      <div className="mb-2 flex items-center justify-between"><b>{title}</b><button type="button" onClick={onEdit} className="text-[13px] font-bold text-primary">Edit</button></div>
      <dl className="grid gap-1.5 text-sm">
        {rows.map(([k, v], i) => <div key={i} className="grid grid-cols-[110px_1fr] gap-2"><dt className="text-ink-3">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
      </dl>
    </div>
  );
}

function ExistingPicker({ parents, value, onPick, relationship, onRelationship, error }: {
  parents: ExistingParent[]; value: number | null; onPick: (id: number) => void;
  relationship: string; onRelationship: (r: string) => void; error: string;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return parents.filter((p) => !t || p.name.toLowerCase().includes(t) || p.email.toLowerCase().includes(t)).slice(0, 6);
  }, [q, parents]);
  const chosen = parents.find((p) => p.id === value);
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_200px]">
      <div>
        <Label>Find the parent</Label>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email…" className={inputCls} />
        <div className="mt-2 grid gap-1.5">
          {list.map((p) => (
            <button key={p.id} type="button" onClick={() => onPick(p.id)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left ${p.id === value ? "border-primary bg-primary-soft/60" : "border-line bg-surface hover:bg-surface-2/60"}`}>
              <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-surface-2 text-xs font-bold">{p.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</span>
              <span className="min-w-0 flex-1 text-sm"><b className="block truncate">{p.name}</b><span className="block truncate text-xs text-ink-3">{p.email}</span></span>
              {p.children.length > 0 && <span className="badge bg-surface-2 text-ink-2">{p.children.join(" & ")}</span>}
              {p.id === value && <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] font-black text-white">✓</span>}
            </button>
          ))}
          {list.length === 0 && <p className="py-3 text-center text-sm text-ink-3">No parent matches. Use “New parent” instead.</p>}
        </div>
        {error && !chosen && <Err>{error}</Err>}
      </div>
      <label><Label>Relationship</Label>
        <BrandPicker ariaLabel="Relationship" value={relationship} onChange={onRelationship}
          options={RELATIONSHIPS.map((r) => ({ value: r, label: r }))} />
      </label>
    </div>
  );
}
