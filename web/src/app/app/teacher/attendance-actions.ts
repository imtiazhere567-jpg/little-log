"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertUser, audit } from "@/lib/session";
import { teacherCanSeeChild } from "@/lib/data";
import { checkIn, checkOut, markAbsent, undoAttendance } from "@/lib/attendance";

const back = (fd: FormData, extra = "") => {
  const b = String(fd.get("back") ?? "/app/teacher/attendance");
  const safe = b.startsWith("/app/teacher") ? b : "/app/teacher/attendance";
  return safe + (extra ? `${safe.includes("?") ? "&" : "?"}${extra}` : "");
};

async function child(fd: FormData) {
  const t = await assertUser("teacher");
  const c = await teacherCanSeeChild(t.id, Number(fd.get("childId")));
  if (!c) throw new Error("Not your child");
  return { t, c };
}

export async function checkInAction(fd: FormData) {
  const { t, c } = await child(fd);
  const row = await checkIn(t, c);
  await audit(t.id, "checked_in", "attendance", row.id);
  revalidatePath("/", "layout");
  redirect(back(fd, `done=in-${c.id}`));
}

export async function checkOutAction(fd: FormData) {
  const { t, c } = await child(fd);
  const row = await checkOut(t, c, String(fd.get("pickup") ?? ""));
  await audit(t.id, "checked_out", "attendance", row.id);
  revalidatePath("/", "layout");
  redirect(back(fd, `done=out-${c.id}`));
}

export async function absentAction(fd: FormData) {
  const { t, c } = await child(fd);
  const row = await markAbsent(t, c, String(fd.get("reason") ?? "Other"));
  await audit(t.id, "marked_absent", "attendance", row.id);
  revalidatePath("/", "layout");
  redirect(back(fd));
}

export async function undoAction(fd: FormData) {
  const { t, c } = await child(fd);
  await undoAttendance(c);
  await audit(t.id, "undid_attendance", "children", c.id);
  revalidatePath("/", "layout");
  redirect(back(fd));
}
