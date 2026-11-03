import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb } from "./helpers/db.js";
import { enrollInPack, listExams } from "../lib/db/exams.js";
import { commitImport, existingForImport, listQuestions, setReviewStatus, updateQuestion } from "../lib/db/questions.js";
import { RETIRED_REASON, syncPackBank, syncStaleBanks } from "../lib/db/bank.js";
import { readPackBank } from "../lib/content/bank.js";
import { validateImport } from "../lib/content/validate-questions.js";
import { getExam } from "../lib/db/exams.js";

/** The shared baseline bank: every learner gets it; their own imports stay theirs. */
let t;
let alice;
let bob;
const clf = JSON.parse(readFileSync("content/clf-c02/blueprint.json", "utf8"));

const q = (n, extra = {}) => ({
  id: `bank-${n}`,
  domain: "d2",
  objective: "2.1",
  type: "single",
  stem: `Bank question number ${n} about the shared responsibility model?`,
  options: [
    { text: `Right ${n}`, correct: true, rationale: "Because." },
    { text: `Wrong A ${n}`, correct: false, rationale: "No." },
    { text: `Wrong B ${n}`, correct: false, rationale: "No." },
    { text: `Wrong C ${n}`, correct: false, rationale: "No." },
  ],
  difficulty: 2,
  refs: ["https://aws.amazon.com/compliance/shared-responsibility-model/"],
  source: "ai-draft",
  generator: "test-model",
  generatedAt: "2026-11-01",
  lastVerified: "2026-11-01",
  reviewStatus: "approved",
  ...extra,
});
const bank = (version, questions) => ({ version, questions });

beforeAll(async () => {
  t = await setupTestDb();
  alice = await t.createUser("alice");
  bob = await t.createUser("bob");
});
afterAll(async () => t?.close());

const questionsOf = (user, examId) => t.withUser(user, (db) => listQuestions(db, examId, { limit: 500 }));

describe("syncPackBank", () => {
  let aliceExam;
  let bobExam;

  beforeAll(async () => {
    aliceExam = await t.withUser(alice, (db) => enrollInPack(db, alice, clf));
    bobExam = await t.withUser(bob, (db) => enrollInPack(db, bob, clf));
  });

  it("gives every learner the bank as approved questions", async () => {
    const b = bank("v1", [q(1), q(2)]);
    const counts = await t.withUser(alice, (db) => syncPackBank(db, alice, aliceExam, b));
    await t.withUser(bob, (db) => syncPackBank(db, bob, bobExam, b));
    expect(counts).toMatchObject({ inserted: 2, updated: 0, retired: 0, skipped: 0 });
    for (const [u, e] of [[alice, aliceExam], [bob, bobExam]]) {
      const qs = await questionsOf(u, e);
      expect(qs).toHaveLength(2);
      expect(qs.every((x) => x.fromBank && x.reviewStatus === "approved")).toBe(true);
    }
  });

  it("keeps a learner's own imports private and untouched", async () => {
    const own = { formatVersion: 1, questions: [q(99, { id: "mine-1", source: "own", reviewStatus: undefined })] };
    await t.withUser(alice, async (db) => {
      const exam = await getExam(db, aliceExam);
      const v = validateImport(own, { ...exam, existing: await existingForImport(db, aliceExam) });
      await commitImport(db, alice, exam, v.questions.map((r) => r.normalized));
    });
    await t.withUser(alice, (db) => syncPackBank(db, alice, aliceExam, bank("v2", [q(1), q(2)])));
    const mine = (await questionsOf(alice, aliceExam)).find((x) => x.externalId === "mine-1");
    expect(mine.fromBank).toBe(false);
    expect(mine.reviewStatus).toBe("approved");
    expect((await questionsOf(bob, bobExam)).some((x) => x.externalId === "mine-1")).toBe(false);
  });

  it("updates changed questions in place, keeping their ids", async () => {
    const before = (await questionsOf(bob, bobExam)).find((x) => x.externalId === "bank-1");
    const edited = q(1, { stem: "Bank question number 1, reworded for clarity?" });
    const counts = await t.withUser(bob, (db) => syncPackBank(db, bob, bobExam, bank("v3", [edited, q(2)])));
    expect(counts).toMatchObject({ inserted: 0, updated: 1 });
    const after = (await questionsOf(bob, bobExam)).find((x) => x.externalId === "bank-1");
    expect(after.id).toBe(before.id);
    expect(after.stem).toBe("Bank question number 1, reworded for clarity?");
  });

  it("retires questions dropped from the bank instead of deleting them", async () => {
    const counts = await t.withUser(bob, (db) => syncPackBank(db, bob, bobExam, bank("v4", [q(1)])));
    expect(counts.retired).toBe(1);
    const gone = (await questionsOf(bob, bobExam)).find((x) => x.externalId === "bank-2");
    expect(gone.reviewStatus).toBe("rejected");
    expect(gone.rejectReason).toBe(RETIRED_REASON);
    // Coming back restores it.
    await t.withUser(bob, (db) => syncPackBank(db, bob, bobExam, bank("v5", [q(1), q(2)])));
    expect((await questionsOf(bob, bobExam)).find((x) => x.externalId === "bank-2").reviewStatus).toBe("approved");
  });

  it("adopts a copy the learner imported before it reached the bank", async () => {
    const carol = await t.createUser("carol");
    const exam = await t.withUser(carol, (db) => enrollInPack(db, carol, clf));
    const draft = { formatVersion: 1, questions: [q(7, { id: undefined, reviewStatus: "draft" })] };
    await t.withUser(carol, async (db) => {
      const e = await getExam(db, exam);
      const v = validateImport(draft, { ...e, existing: await existingForImport(db, exam) });
      await commitImport(db, carol, e, v.questions.map((r) => r.normalized));
    });
    await t.withUser(carol, (db) => syncPackBank(db, carol, exam, bank("v1", [q(7)])));
    const qs = await questionsOf(carol, exam);
    expect(qs).toHaveLength(1);
    expect(qs[0]).toMatchObject({ externalId: "bank-7", fromBank: true, reviewStatus: "approved" });
  });

  it("bank questions can't be re-reviewed or edited by the learner", async () => {
    const b1 = (await questionsOf(bob, bobExam)).find((x) => x.externalId === "bank-1");
    await t.withUser(bob, (db) => setReviewStatus(db, b1.id, "rejected", "I disagree"));
    await t.withUser(bob, (db) =>
      updateQuestion(db, b1.id, { ...b1, stem: "changed", contentHash: "x" }),
    );
    const again = (await questionsOf(bob, bobExam)).find((x) => x.externalId === "bank-1");
    expect(again.reviewStatus).toBe("approved");
    expect(again.stem).toBe(b1.stem);
  });

  it("skips invalid bank entries without failing the rest", async () => {
    const dave = await t.createUser("dave");
    const exam = await t.withUser(dave, (db) => enrollInPack(db, dave, clf));
    const bad = q(8, { objective: "9.9" });
    const counts = await t.withUser(dave, (db) => syncPackBank(db, dave, exam, bank("v1", [bad, q(9)])));
    expect(counts).toMatchObject({ inserted: 1, skipped: 1 });
  });
});

describe("syncStaleBanks", () => {
  it("syncs only when the pack's bank version differs from the exam's", async () => {
    const erin = await t.createUser("erin");
    await t.withUser(erin, (db) => enrollInPack(db, erin, clf));
    let reads = 0;
    const read = () => (reads++, bank("v1", [q(1)]));
    const first = await t.withUser(erin, async (db) => syncStaleBanks(db, erin, await listExams(db), read));
    const second = await t.withUser(erin, async (db) => syncStaleBanks(db, erin, await listExams(db), read));
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect((await t.withUser(erin, (db) => listExams(db)))[0].bankVersion).toBe("v1");
  });

  it("a pack with no bank leaves the exam alone", async () => {
    const frank = await t.createUser("frank");
    await t.withUser(frank, (db) => enrollInPack(db, frank, clf));
    const changed = await t.withUser(frank, async (db) =>
      syncStaleBanks(db, frank, await listExams(db), () => bank(null, [])),
    );
    expect(changed).toBe(false);
  });
});

describe("readPackBank", () => {
  it("reads every bank file and versions them by content", () => {
    const root = mkdtempSync(join(tmpdir(), "bank-"));
    mkdirSync(join(root, "clf-c02", "bank"), { recursive: true });
    const write = (name, qs) =>
      writeFileSync(join(root, "clf-c02", "bank", name), JSON.stringify({ formatVersion: 1, questions: qs }));
    write("a.json", [q(1)]);
    write("b.json", [q(2)]);
    const one = readPackBank("CLF-C02", root);
    expect(one.questions.map((x) => x.id)).toEqual(["bank-1", "bank-2"]);
    write("b.json", [q(3)]);
    expect(readPackBank("CLF-C02", root).version).not.toBe(one.version);
    expect(readPackBank("DVA-C03", root)).toEqual({ version: null, questions: [] });
  });
});
