"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertUser, audit } from "@/lib/session";
import { parentChildren } from "@/lib/data";
import { childAttendance, markAbsent, statusOf } from "@/lib/attendance";
import { todayStr } from "@/lib/time";

/** A parent says their child is staying home today (only before check-in). */
export async function parentAbsentAction(fd: FormData) {
  const p = await assertUser("parent");
  const id = Number(fd.get("childId"));
  const mine = (await parentChildren(p.id)).find((k) => k.child.id === id);
  if (!mine) throw new Error("Not your child");
  if (statusOf(await childAttendance(id, todayStr())) !== "not_arrived") throw new Error("Already checked in today");
  const row = await markAbsent(p, mine.child, String(fd.get("reason") ?? "Other"));
  await audit(p.id, "marked_absent", "attendance", row.id);
  revalidatePath("/", "layout");
  redirect(`/app/parent?child=${id}`);
}
