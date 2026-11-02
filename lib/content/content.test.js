import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fillDraftPrompt, promptBody } from "./prompt.js";
import { lintBatch } from "./lint-batch.js";
import { blindCopy, compareAnswers, flagDisagreements } from "./verify.js";
import { validateImport } from "./validate-questions.js";

/** A normalized single-answer question whose correct option is at `at`. */
const single = (at, { texts, stem = "Which service does X?", lastVerified = "2026-10-30" } = {}) => ({
  type: "single",
  stem,
  lastVerified,
  options: (texts ?? ["Alpha", "Bravo", "Charlie", "Delta"]).map((text, i) => ({ text, isCorrect: i === at })),
});

describe("lintBatch", () => {
  it("flags one answer position dominating a batch", () => {
    const qs = [0, 0, 0, 0, 1, 2].map((at) => single(at));
    const { batch } = lintBatch(qs);
    expect(batch.some((m) => m.includes("option a in 4 of 6"))).toBe(true);
  });

  it("does not judge small batches", () => {
    const qs = [0, 0, 0, 0, 0].map((at) => single(at));
    expect(lintBatch(qs).batch).toEqual([]);
  });

  it("flags the longest option being correct too often", () => {
    const long = ["Short", "Tiny", "A much longer and more detailed option", "Mid"];
    const qs = [2, 2, 2, 2, 2, 1].map((at) => single(at, { texts: long }));
    const { batch } = lintBatch(qs);
    expect(batch.some((m) => m.includes("longest option"))).toBe(true);
  });

  it("is quiet for a balanced batch", () => {
    const qs = [0, 1, 2, 3, 0, 1].map((at) => single(at));
    expect(lintBatch(qs).batch).toEqual([]);
  });

  it("flags absolute words, NOT/EXCEPT stems and old verification dates per question", () => {
    const qs = [
      single(0, { texts: ["Always encrypted", "B", "C", "D"] }),
      single(1, { stem: "Which is NOT a benefit?" }),
      single(2, { lastVerified: "2024-01-01" }),
      single(3),
    ];
    const { perQuestion } = lintBatch(qs, { now: new Date("2026-11-01T00:00:00Z") });
    expect(perQuestion[0][0]).toMatch(/"always"/);
    expect(perQuestion[1][0]).toMatch(/NOT\/EXCEPT/);
    expect(perQuestion[2][0]).toMatch(/over a year old/);
    expect(perQuestion[3]).toEqual([]);
  });
});

describe("blind verification", () => {
  const file = {
    questions: [
      { id: "a1", type: "single", stem: "S1", explanation: "secret", options: [{ text: "x", correct: false, rationale: "r" }, { text: "y", correct: true, rationale: "r" }] },
      { id: "a2", type: "multi", stem: "S2 (choose two)", options: [{ text: "p", correct: true }, { text: "q", correct: false }, { text: "r", correct: true }] },
    ],
  };

  it("removes everything that gives the key away", () => {
    const text = JSON.stringify(blindCopy(file));
    expect(text).not.toContain("secret");
    expect(text).not.toContain("correct");
    expect(text).not.toContain("rationale");
    expect(blindCopy(file).questions[0].options).toEqual([{ id: "a", text: "x" }, { id: "b", text: "y" }]);
  });

  it("compares answers as sets, and counts skipped questions as disagreements", () => {
    const c = compareAnswers(file, { a1: ["b"], a2: ["c", "a"] });
    expect(c.map((x) => x.result)).toEqual(["match", "match"]);
    const bad = compareAnswers(file, { a1: ["a"] });
    expect(bad.map((x) => x.result)).toEqual(["mismatch", "missing"]);
  });

  it("flags only the questions that disagreed", () => {
    const flagged = flagDisagreements(file, compareAnswers(file, { a1: ["b"], a2: ["a"] }));
    expect(flagged.questions[0].needsAttention).toBeUndefined();
    expect(flagged.questions[1].needsAttention).toBe(true);
  });
});

describe("out-of-scope terms", () => {
  const exam = {
    domains: [{ key: "d1", name: "D", objectives: [{ code: "1.1" }] }],
    profile: { outOfScopeTerms: ["GameLift"] },
  };
  const q = (optionText) => ({
    formatVersion: 1,
    questions: [
      {
        id: "x",
        domain: "d1",
        objective: "1.1",
        type: "single",
        source: "own",
        stem: "Which service?",
        options: [
          { text: optionText, correct: true },
          { text: "Amazon S3", correct: false },
          { text: "Amazon EC2", correct: false },
          { text: "AWS IAM", correct: false },
        ],
      },
    ],
  });

  it("rejects a question that names a service the guide lists as out of scope", () => {
    const r = validateImport(q("Amazon GameLift"), exam).questions[0];
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/out of scope/);
  });

  it("accepts in-scope services", () => {
    expect(validateImport(q("Amazon RDS"), exam).questions[0].ok).toBe(true);
  });
});

describe("fillDraftPrompt", () => {
  const template = "{{EXAM_CODE}} {{OBJECTIVE_CODE}} x{{COUNT}}\n{{FORMAT_RULES}}\n{{SCOPE}}\n{{EXISTING}}\n{{ID_PREFIX}}-{{START_NUMBER}} {{TODAY}} {{UNKNOWN}}";
  const input = {
    exam: { code: "CLF-C02", name: "Cloud Practitioner", profile: { single: { options: 4 }, multi: { minOptions: 5, minCorrect: 2 } } },
    domain: { key: "d2", name: "Security", weightPct: 30 },
    objective: { code: "2.1", title: "Shared responsibility", scope: ["Customer duties", "AWS duties"] },
    count: 10,
    packDir: "clf-c02",
    existingStems: ["Which task is the customer's?"],
    startNumber: 3,
    today: "2026-11-01",
  };

  it("fills every known placeholder and leaves unknown ones visible", () => {
    const out = fillDraftPrompt(template, input);
    expect(out).toContain("CLF-C02 2.1 x10");
    expect(out).toContain("- Customer duties");
    expect(out).toContain("- Which task is the customer's?");
    expect(out).toContain("clf-c02-2.1-03 2026-11-01 {{UNKNOWN}}");
  });

  it("states the exam profile in the format rules", () => {
    const out = fillDraftPrompt("{{FORMAT_RULES}}", input);
    expect(out).toContain("About 9 should be `single` (exactly one correct, 4 options)");
    expect(out).toContain("at least 5 options, at least 2 correct");
  });

  it("the shipped template has no placeholder the filler does not know", () => {
    const text = readFileSync("content/prompts/draft-questions.md", "utf8");
    const out = fillDraftPrompt(promptBody(text), input);
    expect(out).not.toMatch(/\{\{[A-Z_]+\}\}/);
    expect(out.startsWith("You are writing original practice questions")).toBe(true);
  });
});
