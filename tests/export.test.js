import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb } from "./helpers/db.js";
import { createExamFromPack, getExam, setExamOutcome } from "../lib/db/exams.js";
import { commitImport, existingForImport, getPool, toggleMark, setNote, getNote } from "../lib/db/questions.js";
import { createSession, finishSession, recordResponse, listSessions } from "../lib/db/sessions.js";
import { exportUserData, importUserData } from "../lib/db/export.js";
import { validateImport } from "../lib/content/validate-questions.js";

let t;
let a;
let b;
const pack = JSON.parse(readFileSync("content/clf-c02/blueprint.json", "utf8"));
const fixture = JSON.parse(readFileSync("tests/fixtures/valid-small.json", "utf8"));

beforeAll(async () => {
  t = await setupTestDb();
  a = await t.createUser("exporter");
  b = await t.createUser("importer");
  // A has an exam (marked passed), questions, a flag, a note and a finished session.
  await t.withUser(a, async (db) => {
    const examId = await createExamFromPack(db, a, pack);
    await setExamOutcome(db, examId, { outcome: "passed", date: "2026-11-09", score: 812 });
    const exam = await getExam(db, examId);
    const v = validateImport(fixture, { ...exam, existing: await existingForImport(db, examId) });
    await commitImport(db, a, exam, v.questions.map((q) => q.normalized));
    const pool = await getPool(db, examId);
    await toggleMark(db, a, pool[0].id, "flag");
    await setNote(db, a, pool[0].id, "remember this");
    const s = await createSession(db, a, { examId, mode: "practice", questionIds: pool.map((q) => q.id) });
    const q = (await db.query("SELECT id, options FROM question WHERE id = $1", [pool[0].id])).rows[0];
    await recordResponse(db, a, s.id, q.id, q.options.filter((o) => o.isCorrect).map((o) => o.id));
    await finishSession(db, s.id);
  });
});
afterAll(async () => t?.close());

describe("export and import", () => {
  it("export contains no ids and round-trips through import for a different user", async () => {
    const data = await t.withUser(a, (db) => exportUserData(db));
    expect(JSON.stringify(data)).not.toMatch(/"id"\s*:\s*"[0-9a-f]{8}-/);
    expect(data.exams[0]).toMatchObject({ code: "CLF-C02", outcome: "passed", outcomeDate: "2026-11-09", outcomeScore: 812 });
    expect(data.exams[0].questions).toHaveLength(5);
    expect(data.exams[0].sessions[0].responses).toHaveLength(1);

    const counts = await t.withUser(b, (db) => importUserData(db, b, JSON.parse(JSON.stringify(data))));
    expect(counts).toEqual({ exams: 1, questions: 5, sessions: 1, responses: 1 });

    // B now owns an independent copy; A's data is untouched.
    const again = await t.withUser(b, (db) => exportUserData(db));
    const strip = (d) => ({ ...d, exportedAt: undefined });
    expect(strip(again)).toEqual(strip(data));
    const poolB = await t.withUser(b, async (db) => getPool(db, (await db.query("SELECT id FROM exam")).rows[0].id));
    expect(poolB).toHaveLength(5);
    expect(await t.withUser(a, (db) => db.query("SELECT count(*)::int AS n FROM exam"))).toMatchObject({ rows: [{ n: 1 }] });
    const note = await t.withUser(b, async (db) => getNote(db, poolB[0].id));
    expect(["remember this", ""]).toContain(note);
  });

  it("import replaces existing data", async () => {
    const data = await t.withUser(a, (db) => exportUserData(db));
    await t.withUser(b, (db) => importUserData(db, b, data));
    await t.withUser(b, (db) => importUserData(db, b, data));
    const exams = await t.withUser(b, (db) => db.query("SELECT count(*)::int AS n FROM exam"));
    expect(exams.rows[0].n).toBe(1);
  });

  it("a malformed file leaves existing data untouched", async () => {
    await expect(t.withUser(b, (db) => importUserData(db, b, { formatVersion: 1, exams: [{ code: "X" }] }))).rejects.toThrow();
    const sessions = await t.withUser(b, (db) => db.query("SELECT id FROM exam").then((r) => listSessions(db, r.rows[0].id)));
    expect(sessions).toHaveLength(1);
  });

  it("a file that fails halfway rolls back", async () => {
    const data = await t.withUser(a, (db) => exportUserData(db));
    data.exams[0].questions[0].objectiveCode = "9.9"; // unknown objective, discovered after the delete
    await expect(t.withUser(b, (db) => importUserData(db, b, data))).rejects.toThrow(/unknown domain or objective/);
    const n = await t.withUser(b, (db) => db.query("SELECT count(*)::int AS n FROM question"));
    expect(n.rows[0].n).toBe(5);
  });
});
