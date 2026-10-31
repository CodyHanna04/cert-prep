#!/usr/bin/env node
// Creates a local development account (password login) with the CLF-C02 pack and the sample questions.
// Refuses to run unless everything points at localhost. Usage: npm run db:seed-dev
import pg from "pg";
import { readFileSync } from "node:fs";
import { betterAuth } from "better-auth";
import { loadEnv } from "./load-env.mjs";
import { buildAuthOptions } from "../lib/auth/config.js";
import { makeWithUser } from "../lib/db/with-user.js";
import { createExamFromPack, getExam } from "../lib/db/exams.js";
import { commitImport, existingForImport } from "../lib/db/questions.js";
import { validateImport } from "../lib/content/validate-questions.js";

loadEnv();
process.env.ALLOW_DEV_PASSWORD_LOGIN ??= "true";

const isLocal = (u) => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(u).hostname);
const fail = (m) => {
  console.error(`seed-dev: ${m}`);
  process.exit(1);
};
if (process.env.NODE_ENV === "production") fail("refusing to run with NODE_ENV=production");
for (const k of ["DATABASE_URL_APP", "DATABASE_URL_AUTH", "APP_ORIGIN"]) {
  if (!process.env[k]) fail(`${k} is not set`);
  if (!isLocal(process.env[k])) fail(`${k} does not point at localhost; refusing to seed a non-local database`);
}

const email = process.env.DEV_USER_EMAIL ?? "dev@users.invalid";
const password = process.env.DEV_USER_PASSWORD ?? "dev-password-123";

const authPool = new pg.Pool({ connectionString: process.env.DATABASE_URL_AUTH });
const appPool = new pg.Pool({ connectionString: process.env.DATABASE_URL_APP });
const auth = betterAuth(buildAuthOptions(process.env, authPool));

let userId;
const existing = await authPool.query('SELECT id FROM auth."user" WHERE email = $1', [email]);
if (existing.rowCount > 0) {
  userId = existing.rows[0].id;
  console.log(`Dev user exists (${email}).`);
} else {
  const res = await auth.api.signUpEmail({ body: { email, password, name: "Dev User" } });
  userId = res.user.id;
  console.log(`Created dev user ${email} / ${password}`);
}

const withUser = makeWithUser(appPool);
const pack = JSON.parse(readFileSync("content/clf-c02/blueprint.json", "utf8"));
const sample = JSON.parse(readFileSync("tests/fixtures/valid-small.json", "utf8"));

await withUser(userId, async (db) => {
  const have = await db.query("SELECT id FROM exam WHERE code = $1", [pack.exam.code]);
  const examId = have.rowCount ? have.rows[0].id : await createExamFromPack(db, userId, pack);
  const exam = await getExam(db, examId);
  const v = validateImport(sample, { ...exam, existing: await existingForImport(db, examId) });
  const fresh = v.questions.filter((q) => q.ok && !q.duplicate).map((q) => q.normalized);
  const counts = await commitImport(db, userId, exam, fresh);
  console.log(`CLF-C02 ready. Sample questions: ${JSON.stringify(counts)}`);
});

await Promise.all([authPool.end(), appPool.end()]);
