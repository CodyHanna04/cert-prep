import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb } from "./helpers/db.js";
import { createExamFromPack, getExam } from "../lib/db/exams.js";
import { commitImport, existingForImport, getPool, setReviewStatus, listQuestions } from "../lib/db/questions.js";
import { clearResponse, createSession, finishSession, getOpenSession, mockHistory, recordResponse, sessionScore } from "../lib/db/sessions.js";
import { getExamProgress } from "../lib/db/progress.js";
import { validateImport } from "../lib/content/validate-questions.js";
import { selectQuestions } from "../lib/domain/selection.js";

/** Load pack -> import -> approve -> practice -> results -> progress, all through the real data layer. */
let t;
let user;
let other;
let examId;

const pack = JSON.parse(readFileSync("content/clf-c02/blueprint.json", "utf8"));
const fixture = JSON.parse(readFileSync("tests/fixtures/valid-small.json", "utf8"));

beforeAll(async () => {
  t = await setupTestDb();
  user = await t.createUser("learner");
  other = await t.createUser("other");
});
afterAll(async () => t?.close());

describe("golden path", () => {
  it("loads an exam pack for one user only", async () => {
    examId = await t.withUser(user, (db) => createExamFromPack(db, user, pack));
    const exam = await t.withUser(user, (db) => getExam(db, examId));
    expect(exam.domains).toHaveLength(4);
    expect(exam.domains.flatMap((d) => d.objectives)).toHaveLength(19);
    expect(exam.readinessTargetPct).toBe(80);
    expect(await t.withUser(other, (db) => getExam(db, examId))).toBeNull();
  });

  it("refuses to load the same pack twice", async () => {
    await expect(t.withUser(user, (db) => createExamFromPack(db, user, pack))).rejects.toThrow(/already added/);
  });

  it("imports validated questions, all-or-nothing", async () => {
    const result = await t.withUser(user, async (db) => {
      const exam = await getExam(db, examId);
      const v = validateImport(fixture, { ...exam, existing: await existingForImport(db, examId) });
      expect(v.summary.valid).toBe(5);
      return commitImport(db, user, exam, v.questions.map((q) => q.normalized));
    });
    expect(result).toEqual({ inserted: 5, updated: 0, skipped: 0 });

    // Re-importing the same file detects every question as a duplicate.
    await t.withUser(user, async (db) => {
      const exam = await getExam(db, examId);
      const v = validateImport(fixture, { ...exam, existing: await existingForImport(db, examId) });
      expect(v.summary.duplicates).toBe(5);
    });
  });

  it("rolls back the whole import when one write fails", async () => {
    const before = await t.withUser(user, (db) => listQuestions(db, examId, { limit: 100 }));
    const good = validateImport({ formatVersion: 1, questions: [{ ...fixture.questions[0], id: "new-1", stem: "A brand new stem about elasticity?", options: fixture.questions[0].options.map((o) => ({ ...o, text: o.text + " x" })) }] }, {
      domains: pack.exam.domains, profile: pack.exam.profile,
    }).questions[0].normalized;
    const broken = { ...good, externalId: "new-2", contentHash: "other-hash", objectiveCode: "9.9" };
    await expect(
      t.withUser(user, async (db) => {
        const exam = await getExam(db, examId);
        return commitImport(db, user, exam, [good, broken]);
      }),
    ).rejects.toThrow(/Unknown domain/);
    const after = await t.withUser(user, (db) => listQuestions(db, examId, { limit: 100 }));
    expect(after).toHaveLength(before.length);
  });

  it("keeps drafts out of the pool until approved", async () => {
    const drafts = await t.withUser(user, async (db) => {
      const exam = await getExam(db, examId);
      const draft = validateImport(
        { formatVersion: 1, questions: [{ ...fixture.questions[2], id: "d-1", stem: "Draft stem about IAM users?", source: "ai-draft", generator: "claude-sonnet-5-5", generatedAt: "2026-10-31", lastVerified: "2026-10-31", refs: ["https://docs.aws.amazon.com/iam/"] }] },
        exam,
      ).questions[0].normalized;
      await commitImport(db, user, exam, [draft]);
      return listQuestions(db, examId, { reviewStatus: "draft" });
    });
    expect(drafts).toHaveLength(1);
    expect(await t.withUser(user, (db) => getPool(db, examId))).toHaveLength(5);
    await t.withUser(user, (db) => setReviewStatus(db, drafts[0].id, "approved"));
    expect(await t.withUser(user, (db) => getPool(db, examId))).toHaveLength(6);
    await expect(t.withUser(user, (db) => setReviewStatus(db, drafts[0].id, "rejected", ""))).rejects.toThrow(/reason/);
  });

  it("runs a practice session, scores it, and updates progress", async () => {
    const pool = await t.withUser(user, (db) => getPool(db, examId));
    const ids = selectQuestions({ pool, scope: { type: "exam" }, count: 6 });
    const session = await t.withUser(user, (db) => createSession(db, user, { examId, mode: "practice", questionIds: ids }));

    // One open session per exam.
    await expect(t.withUser(user, (db) => createSession(db, user, { examId, mode: "practice", questionIds: ids }))).rejects.toThrow(/open session/);

    // Answer every question correctly except one.
    const questions = await t.withUser(user, (db) => db.query("SELECT id, options FROM question WHERE id = ANY($1::uuid[])", [ids]));
    let wrongOne = true;
    for (const q of questions.rows) {
      const correct = q.options.filter((o) => o.isCorrect).map((o) => o.id);
      const pick = wrongOne ? [q.options.find((o) => !o.isCorrect).id] : correct;
      const r = await t.withUser(user, (db) => recordResponse(db, user, session.id, q.id, pick, 1000));
      expect(r.isCorrect).toBe(!wrongOne);
      wrongOne = false;
    }

    // First answer sticks in practice.
    const again = await t.withUser(user, (db) => recordResponse(db, user, session.id, questions.rows[0].id, questions.rows[0].options.filter((o) => o.isCorrect).map((o) => o.id)));
    expect(again.accepted).toBe(false);

    await t.withUser(user, (db) => finishSession(db, session.id));
    expect(await t.withUser(user, (db) => getOpenSession(db, examId))).toBeNull();

    const exam = await t.withUser(user, (db) => getExam(db, examId));
    const score = await t.withUser(user, (db) => sessionScore(db, session, exam));
    expect(score).toMatchObject({ total: 6, correct: 5 });
    expect(score.pct).toBeCloseTo(83.33, 1);

    const { progress } = await t.withUser(user, (db) => getExamProgress(db, examId));
    const answered = progress.objectives.filter((o) => o.sample > 0);
    expect(answered.length).toBeGreaterThan(0);
    expect(progress.readiness.available).toBe(false); // far too few answers per domain
    // Objectives with zero questions are reported as such, not as zero accuracy.
    expect(progress.objectives.filter((o) => o.status === "no-questions").length).toBeGreaterThan(10);
  });

  it("another user sees none of it", async () => {
    expect(await t.withUser(other, (db) => getPool(db, examId))).toEqual([]);
    expect(await t.withUser(other, (db) => getExamProgress(db, examId))).toBeNull();
  });

  it("runs a timed mock: answers can change and be cleared, and the server enforces the deadline", async () => {
    // The earlier test left a practice session open; close it first (one open session per exam).
    await t.withUser(user, (db) => db.query("UPDATE session SET status = 'abandoned' WHERE status = 'in-progress'"));
    const pool = await t.withUser(user, (db) => getPool(db, examId));
    const ids = pool.slice(0, 3).map((q) => q.id);
    const mock = await t.withUser(user, (db) => createSession(db, user, { examId, mode: "mock", questionIds: ids, timeLimitSec: 600 }));

    const q = (await t.withUser(user, (db) => db.query("SELECT id, options FROM question WHERE id = $1", [ids[0]]))).rows[0];
    const wrong = q.options.find((o) => !o.isCorrect).id;
    const right = q.options.filter((o) => o.isCorrect).map((o) => o.id);
    await t.withUser(user, (db) => recordResponse(db, user, mock.id, q.id, [wrong]));
    await t.withUser(user, (db) => recordResponse(db, user, mock.id, q.id, right)); // changed their mind
    let responses = await t.withUser(user, (db) => db.query("SELECT is_correct FROM response WHERE session_id = $1", [mock.id]));
    expect(responses.rows).toEqual([{ is_correct: true }]);

    await t.withUser(user, (db) => clearResponse(db, mock.id, q.id));
    responses = await t.withUser(user, (db) => db.query("SELECT 1 FROM response WHERE session_id = $1", [mock.id]));
    expect(responses.rowCount).toBe(0);

    // Past the deadline (plus grace): answers are refused.
    await t.withUser(user, (db) => db.query("UPDATE session SET started_at = now() - interval '2 hours' WHERE id = $1", [mock.id]));
    await expect(t.withUser(user, (db) => recordResponse(db, user, mock.id, q.id, right))).rejects.toThrow(/Time is up/);

    await t.withUser(user, (db) => finishSession(db, mock.id));
    const history = await t.withUser(user, (db) => mockHistory(db, examId));
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ total: 3, correct: 0 });
  });

  it("rejects an answer for a question outside the session or with unknown options", async () => {
    const pool = await t.withUser(user, (db) => getPool(db, examId));
    const session = await t.withUser(user, (db) => createSession(db, user, { examId, mode: "practice", questionIds: [pool[0].id] }));
    await expect(t.withUser(user, (db) => recordResponse(db, user, session.id, pool[1].id, ["a"]))).rejects.toThrow(/not part of/);
    await expect(t.withUser(user, (db) => recordResponse(db, user, session.id, pool[0].id, ["zz"]))).rejects.toThrow(/Unknown option/);
  });
});
