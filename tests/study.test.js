import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb } from "./helpers/db.js";
import { enrollInPack, getExam } from "../lib/db/exams.js";
import { commitImport, existingForImport, listQuestions, reviewList, toggleMark } from "../lib/db/questions.js";
import { createSession, finishSession, getResponses, questionAttempts, recordResponse } from "../lib/db/sessions.js";
import { getPrefs, setPrefs } from "../lib/db/prefs.js";
import { syncPackBank } from "../lib/db/bank.js";
import { validateImport } from "../lib/content/validate-questions.js";

/** Study-screen data: preferences, confidence, the mistakes list, question history and library filters. */
let t;
let user;
let other;
let examId;
let qs;
const clf = JSON.parse(readFileSync("content/clf-c02/blueprint.json", "utf8"));

const question = (n, extra = {}) => ({
  id: `own-${n}`,
  domain: "d2",
  objective: "2.1",
  type: "single",
  stem: `Own question ${n} about the shared responsibility model?`,
  options: [
    { text: `Right ${n}`, correct: true },
    { text: `Wrong A ${n}`, correct: false },
    { text: `Wrong B ${n}`, correct: false },
    { text: `Wrong C ${n}`, correct: false },
  ],
  source: "own",
  ...extra,
});

beforeAll(async () => {
  t = await setupTestDb();
  user = await t.createUser("learner");
  other = await t.createUser("other");
  examId = await t.withUser(user, (db) => enrollInPack(db, user, clf));
  await t.withUser(user, async (db) => {
    const exam = await getExam(db, examId);
    const file = { formatVersion: 1, questions: [1, 2, 3, 4].map((n) => question(n)) };
    const v = validateImport(file, { ...exam, existing: await existingForImport(db, examId) });
    await commitImport(db, user, exam, v.questions.map((r) => r.normalized));
  });
  qs = await t.withUser(user, (db) => listQuestions(db, examId, { limit: 50 }));
});
afterAll(async () => t?.close());

const byExt = (ext) => qs.find((q) => q.externalId === ext);

describe("preferences", () => {
  it("defaults when nothing is saved, and saves only what is given", async () => {
    expect(await t.withUser(user, getPrefs)).toEqual({ theme: null, showConfidence: true });
    await t.withUser(user, (db) => setPrefs(db, user, { theme: "control-room" }));
    await t.withUser(user, (db) => setPrefs(db, user, { showConfidence: false }));
    expect(await t.withUser(user, getPrefs)).toEqual({ theme: "control-room", showConfidence: false });
  });

  it("are private to each user", async () => {
    expect(await t.withUser(other, getPrefs)).toEqual({ theme: null, showConfidence: true });
  });
});

describe("answers, mistakes and history", () => {
  let sessionId;

  beforeAll(async () => {
    const ids = ["own-1", "own-2", "own-3", "own-4"].map((e) => byExt(e).id);
    sessionId = await t.withUser(user, async (db) => {
      const s = await createSession(db, user, { examId, mode: "practice", config: {}, questionIds: ids });
      const right = (q) => q.options.find((o) => o.isCorrect).id;
      const wrong = (q) => q.options.find((o) => !o.isCorrect).id;
      await recordResponse(db, user, s.id, byExt("own-1").id, [wrong(byExt("own-1"))], 41_000, "sure");
      await recordResponse(db, user, s.id, byExt("own-2").id, [right(byExt("own-2"))], 12_000, "guess");
      await recordResponse(db, user, s.id, byExt("own-3").id, [right(byExt("own-3"))], 8_000, null);
      await toggleMark(db, user, byExt("own-4").id, "bookmark");
      await toggleMark(db, user, byExt("own-3").id, "flag");
      await finishSession(db, s.id, "completed");
      return s.id;
    });
  });

  it("stores confidence with the answer", async () => {
    const rs = await t.withUser(user, (db) => getResponses(db, sessionId));
    expect(Object.fromEntries(rs.map((r) => [qs.find((q) => q.id === r.questionId).externalId, r.confidence]))).toEqual({
      "own-1": "sure",
      "own-2": "guess",
      "own-3": null,
    });
  });

  it("lists missed, guessed, flagged and bookmarked questions", async () => {
    const list = await t.withUser(user, (db) => reviewList(db, examId));
    const row = (ext) => list.find((r) => r.id === byExt(ext).id);
    expect(list).toHaveLength(4);
    expect(row("own-1")).toMatchObject({ missed: true, guessed: false, misses: 1 });
    expect(row("own-2")).toMatchObject({ missed: false, guessed: true });
    expect(row("own-3")).toMatchObject({ flagged: true, missed: false, guessed: false });
    expect(row("own-4")).toMatchObject({ bookmarked: true, lastAt: null });
    expect(await t.withUser(other, (db) => reviewList(db, examId))).toEqual([]);
  });

  it("returns every attempt on a question", async () => {
    const attempts = await t.withUser(user, (db) => questionAttempts(db, byExt("own-1").id));
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ sessionId, mode: "practice", isCorrect: false, timeMs: 41_000, confidence: "sure" });
    expect(await t.withUser(other, (db) => questionAttempts(db, byExt("own-1").id))).toEqual([]);
  });
});

describe("library filters", () => {
  it("filters by origin, type and flag", async () => {
    await t.withUser(user, (db) =>
      syncPackBank(db, user, examId, {
        version: "v1",
        questions: [question(9, { id: "bank-9", source: "ai-draft", generator: "m", generatedAt: "2026-11-01", lastVerified: "2026-11-01", refs: ["https://aws.amazon.com/"], reviewStatus: "approved" })],
      }),
    );
    const ext = async (f) => (await t.withUser(user, (db) => listQuestions(db, examId, f))).map((q) => q.externalId).sort();
    expect(await ext({ origin: "bank" })).toEqual(["bank-9"]);
    expect(await ext({ origin: "mine" })).toEqual(["own-1", "own-2", "own-3", "own-4"]);
    expect(await ext({ flagged: true })).toEqual(["own-3"]);
    expect(await ext({ type: "multi" })).toEqual([]);
  });
});
