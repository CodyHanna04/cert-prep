import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb } from "./helpers/db.js";
import {
  archiveExam,
  enrollInPack,
  getExam,
  listExams,
  listPausedExams,
  setExamOutcome,
} from "../lib/db/exams.js";
import { listPacks } from "../lib/content/packs.js";
import { readPackBank } from "../lib/content/bank.js";

/** Starting, pausing and resuming courses: the paths behind the Courses page. */
let t;
let user;
let other;
const clf = JSON.parse(readFileSync("content/clf-c02/blueprint.json", "utf8"));
const dva = JSON.parse(readFileSync("content/dva-c03/blueprint.json", "utf8"));

beforeAll(async () => {
  t = await setupTestDb();
  user = await t.createUser("learner");
  other = await t.createUser("other");
});
afterAll(async () => t?.close());

describe("enrollInPack", () => {
  it("copies a pack in once and is a no-op the second time", async () => {
    const first = await t.withUser(user, (db) => enrollInPack(db, user, clf));
    const again = await t.withUser(user, (db) => enrollInPack(db, user, clf));
    expect(again).toBe(first);
    expect(await t.withUser(user, (db) => listExams(db))).toHaveLength(1);
  });

  it("keeps two courses side by side and each stays reachable", async () => {
    const a = await t.withUser(user, (db) => enrollInPack(db, user, clf));
    const b = await t.withUser(user, (db) => enrollInPack(db, user, dva));
    expect(b).not.toBe(a);
    const codes = (await t.withUser(user, (db) => listExams(db))).map((e) => e.code);
    expect(codes).toEqual(["CLF-C02", "DVA-C03"]);
    expect((await t.withUser(user, (db) => getExam(db, a))).code).toBe("CLF-C02");
    expect((await t.withUser(user, (db) => getExam(db, b))).code).toBe("DVA-C03");
  });

  it("a paused course comes back with the same id and its settings", async () => {
    const id = await t.withUser(user, (db) => enrollInPack(db, user, dva));
    await t.withUser(user, (db) =>
      db.query("UPDATE exam SET readiness_target_pct = 90 WHERE id = $1", [id]),
    );
    await t.withUser(user, (db) => archiveExam(db, id, true));
    expect((await t.withUser(user, (db) => listExams(db))).map((e) => e.code)).toEqual(["CLF-C02"]);
    expect((await t.withUser(user, (db) => listPausedExams(db))).map((e) => e.code)).toEqual([
      "DVA-C03",
    ]);

    const restored = await t.withUser(user, (db) => enrollInPack(db, user, dva));
    expect(restored).toBe(id);
    const exam = await t.withUser(user, (db) => getExam(db, id));
    expect(exam.archived).toBe(false);
    expect(exam.readinessTargetPct).toBe(90);
  });

  it("one learner's courses never show up for another", async () => {
    expect(await t.withUser(other, (db) => listExams(db))).toHaveLength(0);
    expect(await t.withUser(other, (db) => listPausedExams(db))).toHaveLength(0);
  });
});

describe("setExamOutcome", () => {
  it("marks a course passed with a date and score, and clearing it resets all three", async () => {
    const id = await t.withUser(user, (db) => enrollInPack(db, user, clf));
    await t.withUser(user, (db) => setExamOutcome(db, id, { outcome: "passed", date: "2026-11-09", score: "812" }));
    let exam = await t.withUser(user, (db) => getExam(db, id));
    expect([exam.outcome, exam.outcomeDate, exam.outcomeScore]).toEqual(["passed", "2026-11-09", 812]);

    await t.withUser(user, (db) => setExamOutcome(db, id, { outcome: null }));
    exam = await t.withUser(user, (db) => getExam(db, id));
    expect([exam.outcome, exam.outcomeDate, exam.outcomeScore]).toEqual([null, null, null]);
  });

  it("keeps a score for a pass only, and rejects bad values", async () => {
    const id = await t.withUser(user, (db) => enrollInPack(db, user, clf));
    await t.withUser(user, (db) => setExamOutcome(db, id, { outcome: "finished", date: "", score: "700" }));
    const exam = await t.withUser(user, (db) => getExam(db, id));
    expect([exam.outcome, exam.outcomeDate, exam.outcomeScore]).toEqual(["finished", null, null]);

    await expect(t.withUser(user, (db) => setExamOutcome(db, id, { outcome: "failed" }))).rejects.toThrow();
    await expect(
      t.withUser(user, (db) => setExamOutcome(db, id, { outcome: "passed", score: "1200" })),
    ).rejects.toThrow();
  });

  it("cannot change another learner's course", async () => {
    const id = await t.withUser(user, (db) => enrollInPack(db, user, clf));
    await t.withUser(user, (db) => setExamOutcome(db, id, { outcome: null }));
    await t.withUser(other, (db) => setExamOutcome(db, id, { outcome: "passed" }));
    expect((await t.withUser(user, (db) => getExam(db, id))).outcome).toBeNull();
  });
});

describe("course catalog", () => {
  it("lists each shipped pack with the facts the Courses page shows", () => {
    const packs = listPacks();
    const codes = packs.map((p) => p.code).sort();
    expect(codes).toEqual(["CLF-C02", "DVA-C03", "SAA-C03"]);
    for (const p of packs) {
      expect(p.domainWeights.reduce((n, d) => n + d.weightPct, 0)).toBe(100);
      expect(p.marketing?.tagline).toBeTruthy();
      expect(p.questionCount).toBeGreaterThan(0);
    }
  });

  it("a pack with no question bank yet is listed and can be started", async () => {
    const saa = JSON.parse(readFileSync("content/saa-c03/blueprint.json", "utf8"));
    expect(readPackBank("SAA-C03").version).toBeNull();
    const id = await t.withUser(other, (db) => enrollInPack(db, other, saa));
    const exam = await t.withUser(other, (db) => getExam(db, id));
    expect(exam.code).toBe("SAA-C03");
    expect(exam.domains.flatMap((d) => d.objectives)).toHaveLength(14);
    await t.withUser(other, (db) => archiveExam(db, id, true));
  });
});
