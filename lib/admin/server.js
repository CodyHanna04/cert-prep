import "server-only";
import pg from "pg";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { adminFromHeaders, assertAdminEnv } from "./identity.js";

const g = globalThis;

/** The admin database pool (admin_app role). Only exists in admin mode. */
export function adminDb() {
  assertAdminEnv(process.env);
  if (!g.__certprepAdminPool) g.__certprepAdminPool = new pg.Pool({ connectionString: process.env.DATABASE_URL_ADMIN, max: 4 });
  return g.__certprepAdminPool;
}

/** The allowed admin's Tailscale login, or a 404 (the admin site does not reveal itself to anyone else). */
export async function requireAdmin() {
  const login = adminFromHeaders(await headers(), process.env);
  if (!login) notFound();
  return login;
}

export const publicLink = (token) => `${process.env.PUBLIC_ORIGIN.replace(/\/$/, "")}/join/${token}`;
