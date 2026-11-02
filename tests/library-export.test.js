import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb } from "./helpers/db.js";
import { createExamFromPack, getExam } from "../lib/db/exams.js";
import {
  commitImport,
  existingForImport,
  exportApprovedQuestions,
  listQuestions,
  setReviewStatus,
} from "../lib/db/questions.js";
import { validateImport } from "../lib/content/validate-questions.js";

/** Approved questions leave the database in the content format and come back identical. */
let t;
let user;
let examId;
const pack = JSON.parse(readFileSync("content/clf-c02/blueprint.json", "utf8"));
const fixture = JSON.parse(readFileSync("tests/fixtures/valid-small.json", "utf8"));
const draft = {
  formatVersion: 1,
  questions: [
    {
      id: "d-1",
      domain: "d2",
      objective: "2.1",
      type: "single",
      stem: "Which party is responsible for security of the underlying hardware?",
      options: [
        { text: "AWS", correct: true, rationale: "AWS runs the hardware." },
        { text: "The customer", correct: false, rationale: "Not for hardware." },
        { text: "A third party", correct: false, rationale: "Not defined by the model." },
        { text: "The auditor", correct: false, rationale: "Not a party to the model." },
      ],
      difficulty: 1,
      tags: ["shared-responsibility"],
      refs: ["https://aws.amazon.com/compliance/shared-responsibility-model/"],
      source: "ai-draft",
      generator: "test-model",
      generatedAt: "2026-11-01",
      lastVerified: "2026-11-01",
    },
  ],
};

async function importFile(file) {
  await t.withUser(user, async (db) => {
    const exam = await getExam(db, examId);
    const v = validateImport(file, { ...exam, existing: await existingForImport(db, examId) });
    expect(v.summary.invalid).toBe(0);
    await commitImport(
      db,
      user,
      exam,
      v.questions.filter((r) => r.ok && !r.duplicate).map((r) => r.normalized),
    );
  });
}

beforeAll(async () => {
  t = await setupTestDb();
  user = await t.createUser("exporter");
  examId = await t.withUser(user, (db) => createExamFromPack(db, user, pack));
  await importFile(fixture);
  await importFile(draft);
});
afterAll(async () => t?.close());

describe("exportApprovedQuestions", () => {
  it("exports approved questions only, in blueprint order", async () => {
    const out = await t.withUser(user, (db) => exportApprovedQuestions(db, examId));
    expect(out.formatVersion).toBe(1);
    expect(out.questions.map((q) => q.id)).toEqual(["t-001", "t-002", "t-003", "t-004", "t-005"]);
    expect(out.questions.map((q) => q.domain)).toEqual(["d1", "d2", "d2", "d3", "d4"]);
  });

  it("includes a draft once it is approved, with its provenance", async () => {
    const [d] = await t.withUser(user, (db) =>
      listQuestions(db, examId, { reviewStatus: "draft" }),
    );
    await t.withUser(user, (db) => setReviewStatus(db, d.id, "approved"));
    const out = await t.withUser(user, (db) => exportApprovedQuestions(db, examId));
    const q = out.questions.find((x) => x.id === "d-1");
    expect(q).toMatchObject({
      source: "ai-draft",
      generator: "test-model",
      generatedAt: "2026-11-01",
      lastVerified: "2026-11-01",
      reviewStatus: "approved",
    });
    expect(q.refs).toHaveLength(1);
  });

  it("round-trips: the export validates and every question is a duplicate of what is already there", async () => {
    const out = await t.withUser(user, (db) => exportApprovedQuestions(db, examId));
    const v = await t.withUser(user, async (db) => {
      const exam = await getExam(db, examId);
      return validateImport(out, { ...exam, existing: await existingForImport(db, examId) });
    });
    expect(v.summary.invalid).toBe(0);
    expect(v.summary.duplicates).toBe(out.questions.length);
  });
});
