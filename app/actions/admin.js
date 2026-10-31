"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminDb, publicLink, requireAdmin } from "@/lib/admin/server.js";
import { deleteUser, inviteUser, resetPasskeys, revokeSessions } from "@/lib/admin/store.js";

const id = z.uuid();
const wrap = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    if (e?.digest?.startsWith?.("NEXT_")) throw e; // notFound/redirect
    return { error: e.message };
  }
};

export async function inviteUserAction(name) {
  const actor = await requireAdmin();
  return wrap(async () => {
    const { token } = await inviteUser(adminDb(), actor, z.string().parse(name));
    revalidatePath("/admin");
    return { link: publicLink(token) };
  });
}

export async function resetPasskeysAction(userId, typedName) {
  const actor = await requireAdmin();
  return wrap(async () => {
    const { token } = await resetPasskeys(adminDb(), actor, id.parse(userId), z.string().parse(typedName));
    revalidatePath("/admin");
    return { link: publicLink(token) };
  });
}

export async function revokeSessionsAction(userId) {
  const actor = await requireAdmin();
  return wrap(async () => {
    await revokeSessions(adminDb(), actor, id.parse(userId));
    revalidatePath("/admin");
    return { ok: true };
  });
}

export async function deleteUserAction(userId, typedName) {
  const actor = await requireAdmin();
  return wrap(async () => {
    await deleteUser(adminDb(), actor, id.parse(userId), z.string().parse(typedName));
    revalidatePath("/admin");
    return { ok: true };
  });
}
