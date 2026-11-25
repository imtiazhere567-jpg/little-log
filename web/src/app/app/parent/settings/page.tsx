import { requireUser } from "@/lib/session";
import { parentChildren } from "@/lib/data";
import { ageLabel, todayStr } from "@/lib/time";
import { Avatar } from "@/components/ui";

export default async function ParentSettings() {
  const parent = await requireUser("parent");
  const kids = await parentChildren(parent.id);
  const today = todayStr();
  const channels = [
    { k: "WhatsApp", d: parent.phone ?? "", on: parent.whatsappOptIn, note: parent.whatsappOptIn ? "Opted in" : "Not opted in" },
    { k: "Email", d: parent.email, on: true, note: "Backup and record" },
    { k: "App notifications", d: "This phone", on: true, note: "" },
    { k: "SMS", d: parent.phone ?? "", on: false, note: "" },
  ];

  return (
    <div className="px-[18px]">
      <h1 className="font-display mt-3 text-[30px] font-semibold">Settings</h1>

      <div className="eyebrow mb-2 mt-5">My children</div>
      <div className="grid gap-2">
        {kids.map(({ child: c, room }) => (
          <div key={c.id} className="card flex items-center gap-3 p-3.5">
            <Avatar first={c.firstName} last={c.lastName} bg={c.avatarBg} fg={c.avatarFg} size={44} />
            <div className="min-w-0">
              <b className="block">{c.firstName} {c.lastName}</b>
              <span className="text-[13px] text-ink-2">{ageLabel(c.dateOfBirth, today)} · {room.name} Room</span>
            </div>
            <span className={`badge ml-auto ${c.photoConsent ? "bg-success-soft text-[#2C6B42]" : "bg-surface-2 text-ink-3"}`}>
              Photos {c.photoConsent ? "on" : "off"}
            </span>
          </div>
        ))}
      </div>

      <div className="eyebrow mb-2 mt-6">Tell me when a report is ready</div>
      <div className="card divide-y divide-line">
        {channels.map((c) => (
          <div key={c.k} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0">
              <b className="block text-[15px]">{c.k}</b>
              <span className="text-[13px] text-ink-2">{c.d}{c.note ? ` · ${c.note}` : ""}</span>
            </div>
            <span className={`ml-auto flex h-7 w-12 items-center rounded-full p-0.5 ${c.on ? "justify-end bg-primary" : "bg-line"}`}>
              <span className="h-6 w-6 rounded-full bg-white shadow" />
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-[18px] text-ink-3">
        Messages only say a report is ready. The report itself stays in this app, behind your login.
      </p>
    </div>
  );
}
