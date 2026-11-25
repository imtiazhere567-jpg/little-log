import type { Child, Room } from "@/lib/data";
import { saveChild } from "./manage-actions";
import { BrandField } from "@/components/BrandPicker";
import DateField from "@/components/DateField";
import { todayStr } from "@/lib/time";
import { CheckRow, Field, FieldGroup, Toggle, inputCls } from "./ui";

export default function ChildForm({ child, rooms, parents, linked }: {
  child?: Child;
  rooms: Room[];
  parents: { id: number; name: string; email: string }[];
  linked: number[];
}) {
  return (
    <form action={saveChild} className="grid gap-4">
      {child && <input type="hidden" name="id" value={child.id} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name"><input name="firstName" required defaultValue={child?.firstName} className={inputCls} /></Field>
        <Field label="Last name"><input name="lastName" required defaultValue={child?.lastName} className={inputCls} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Date of birth</span>
          <DateField name="dateOfBirth" required value={child?.dateOfBirth ?? ""} max={todayStr()} ariaLabel="Date of birth" placeholder="Pick the birthday" /></div>
        <Field label="Room">
          <BrandField name="roomId" defaultValue={String(child?.roomId ?? rooms[0]?.id ?? "")} ariaLabel="Room"
            options={rooms.map((r) => ({ value: String(r.id), label: `${r.name} · ${r.ageGroup}` }))} />
        </Field>
      </div>
      <Field label="Allergies & medical notes"><textarea name="medicalNotes" rows={3} defaultValue={child?.medicalNotes ?? ""}
        placeholder="e.g. Peanut allergy, carries an EpiPen" className={`${inputCls} h-auto py-2.5 leading-6`} /></Field>
      <Toggle name="photoConsent" checked={child?.photoConsent ?? false} label="Photo consent"
        hint="Off by default. Only turn on when a parent has signed consent." />
      <FieldGroup label="Parents (up to 2)" hint="Parents only ever see their own children.">
        <div className="grid max-h-[260px] gap-1.5 overflow-y-auto pr-1">
          {[...parents].sort((a, b) => Number(linked.includes(b.id)) - Number(linked.includes(a.id)) || a.name.localeCompare(b.name)).map((p) => (
            <CheckRow key={p.id} name="parentIds" value={p.id} checked={linked.includes(p.id)}>
              <b>{p.name}</b><span className="truncate text-ink-3">{p.email}</span>
            </CheckRow>
          ))}
        </div>
      </FieldGroup>
      <button className="btn btn-primary mt-2">{child ? "Save changes" : "Add child"}</button>
    </form>
  );
}
