"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resetDemoData } from "@/db";

export async function resetDemoFromSettings() {
  await resetDemoData();
  revalidatePath("/", "layout");
  redirect("/director/settings?section=demo&saved=reset");
}

export async function resetDemo() {
  await resetDemoData();
  revalidatePath("/", "layout");
}
