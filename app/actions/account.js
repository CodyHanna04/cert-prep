"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { getAuth, requireUser, deleteAccount } from "@/lib/auth/index.js";
import { withUser } from "@/lib/db/index.js";
import { importUserData } from "@/lib/db/export.js";

const MAX_CHARS = 25_000_000;

/** Replaces all of the signed-in user's data with an export file. All or nothing. */
export async function importDataAction(text, confirmed) {
  const user = await requireUser();
  if (confirmed !== true) return { error: "Confirm that this replaces your current data." };
  if (typeof text !== "string" || text.length === 0 || text.length > MAX_CHARS) return { error: "That file is empty or too large." };
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { error: "That file is not valid JSON." };
  }
  try {
    const counts = await withUser(user.id, (db) => importUserData(db, user.id, json));
    revalidatePath("/", "layout");
    return { counts };
  } catch (e) {
    if (e instanceof z.ZodError) return { error: `That is not a CertPrep export (${e.issues[0]?.path.join(".") || "file"}: ${e.issues[0]?.message}).` };
    return { error: e.message };
  }
}

/** Deletes the account and everything in it. The user must type their own name. */
export async function deleteAccountAction(formData) {
  const user = await requireUser();
  if (String(formData.get("confirm") ?? "").trim() !== user.name) redirect("/account?error=confirm");
  await deleteAccount(user.id);
  // Sign-out clears the session cookie; the session row is already gone with the user.
  await getAuth().api.signOut({ headers: new Headers({ cookie: (await cookies()).toString() }) }).catch(() => {});
  redirect("/sign-in");
}
