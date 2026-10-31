import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateImport } from "../lib/content/validate-questions.js";
import { parsePack } from "../lib/schemas/pack.js";

const pack = parsePack(JSON.parse(readFileSync("content/clf-c02/blueprint.json", "utf8")));
const exam = { domains: pack.exam.domains, profile: pack.exam.profile };
const fixture = JSON.parse(readFileSync("tests/fixtures/valid-small.json", "utf8"));

const base = fixture.questions[0];
const bad = (patch) => validateImport({ formatVersion: 1, questions: [{ ...base, ...patch }] }, exam).questions[0];

describe("pack schema", () => {
  it("parses both reference packs", () => {
    expect(pack.exam.code).toBe("CLF-C02");
    const dva = parsePack(JSON.parse(readFileSync("content/dva-c03/blueprint.json", "utf8")));
    expect(dva.exam.domains).toHaveLength(4);
  });
});

describe("validateImport", () => {
  it("accepts the valid fixture and defaults own-source questions to approved", () => {
    const r = validateImport(fixture, exam);
    expect(r.fatal).toBeNull();
    expect(r.summary).toMatchObject({ total: 5, valid: 5, invalid: 0, duplicates: 0 });
    expect(r.questions.every((q) => q.normalized.reviewStatus === "approved")).toBe(true);
    expect(r.questions[0].normalized.options.map((o) => o.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("rejects an unknown formatVersion and a non-array questions field", () => {
    expect(validateImport({ formatVersion: 2, questions: [] }, exam).fatal).toBeTruthy();
    expect(validateImport({ formatVersion: 1, questions: "x" }, exam).fatal).toBeTruthy();
  });

  it("flags an unknown domain and an objective that is not in the domain", () => {
    expect(bad({ domain: "dx" }).errors.join()).toMatch(/not a domain/);
    expect(bad({ objective: "2.1" }).errors.join()).toMatch(/not an objective/);
  });

  it("enforces correct-option counts by type", () => {
    const noCorrect = base.options.map((o) => ({ ...o, correct: false }));
    expect(bad({ options: noCorrect }).errors.join()).toMatch(/exactly 1 correct/);
    const twoCorrect = base.options.map((o, i) => ({ ...o, correct: i < 2 }));
    expect(bad({ options: twoCorrect }).errors.join()).toMatch(/exactly 1 correct/);
  });

  it("enforces the CLF-C02 profile: 4 options for single, no 'all of the above'", () => {
    expect(bad({ options: base.options.slice(0, 3) }).errors.join()).toMatch(/exactly 4 options/);
    const withBanned = base.options.map((o, i) => (i === 3 ? { ...o, text: "All of the above" } : o));
    expect(bad({ options: withBanned }).errors.join()).toMatch(/not allowed/);
  });

  it("rejects duplicate option text", () => {
    const dup = base.options.map((o, i) => (i === 1 ? { ...o, text: base.options[2].text } : o));
    expect(bad({ options: dup }).errors.join()).toMatch(/duplicate option/);
  });

  it("requires provenance for ai-draft and lands it as draft", () => {
    expect(bad({ source: "ai-draft" }).errors.join()).toMatch(/generator/);
    const ok = bad({
      source: "ai-draft",
      generator: "claude-sonnet-5-5",
      generatedAt: "2026-10-31",
      lastVerified: "2026-10-31",
      refs: ["https://docs.aws.amazon.com/"],
    });
    expect(ok.ok).toBe(true);
    expect(ok.normalized.reviewStatus).toBe("draft");
  });

  it("warns (not errors) on missing rationale, explanation and difficulty", () => {
    const r = bad({ explanation: undefined, difficulty: undefined, options: base.options.map((o) => ({ ...o, rationale: undefined })) });
    expect(r.ok).toBe(true);
    expect(r.warnings.join()).toMatch(/rationale/);
    expect(r.warnings.join()).toMatch(/explanation/);
    expect(r.warnings.join()).toMatch(/difficulty/);
  });

  it("detects duplicates in the file and against existing questions", () => {
    const inFile = validateImport({ formatVersion: 1, questions: [base, base] }, exam);
    expect(inFile.questions[1].duplicate).toBe("in-file");
    const first = validateImport({ formatVersion: 1, questions: [base] }, exam).questions[0].normalized.contentHash;
    const existing = validateImport({ formatVersion: 1, questions: [base] }, { ...exam, existing: { contentHashes: new Set([first]) } });
    expect(existing.questions[0].duplicate).toBe("existing");
  });

  it("warns on a near-duplicate stem", () => {
    const similar = { ...base, id: "x", stem: base.stem + " ", options: base.options.map((o) => ({ ...o, text: o.text + " (v2)" })) };
    const r = validateImport({ formatVersion: 1, questions: [base, similar] }, exam);
    expect(r.questions[1].warnings.join()).toMatch(/similar/);
  });

  it("keeps script content as inert text (rendering escapes it later)", () => {
    const r = bad({ stem: "<script>alert(1)</script> What is IAM?" });
    expect(r.ok).toBe(true);
    expect(r.normalized.stem).toContain("<script>");
  });
});
