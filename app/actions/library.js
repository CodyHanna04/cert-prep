"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/app/context.js";
import { requireUser } from "@/lib/auth/index.js";
import { withUser } from "@/lib/db/index.js";
import { getExam } from "@/lib/db/exams.js";
import { commitImport, existingForImport, getQuestion, setReviewStatus, updateQuestion } from "@/lib/db/questions.js";
import { validateImport } from "@/lib/content/validate-questions.js";

const MAX_CHARS = 2_000_000;
const MAX_QUESTIONS = 2000;

function parseJson(text) {
  if (typeof text !== "string" || text.length === 0) return { error: "Choose a file first." };
  if (text.length > MAX_CHARS) return { error: "That file is too large (2 MB limit)." };
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json?.questions) && json.questions.length > MAX_QUESTIONS) return { error: `At most ${MAX_QUESTIONS} questions per file.` };
    return { json };
  } catch {
    return { error: "That file is not valid JSON." };
  }
}

/** Checks an import file against the active exam. Writes nothing. */
export async function previewImportAction(text) {
  const { user, exam: active } = await getAppContext();
  if (!active) return { error: "Add an exam first." };
  const parsed = parseJson(text);
  if (parsed.error) return { error: parsed.error };
  const result = await withUser(user.id, async (db) => {
    const exam = await getExam(db, active.id);
    return validateImport(parsed.json, { ...exam, existing: await existingForImport(db, active.id) });
  });
  if (result.fatal) return { error: result.fatal.join("; ") };
  // Only what the preview screen needs; never echo whole questions back.
  return {
    summary: result.summary,
    questions: result.questions.map((q) => ({
      index: q.index,
      id: q.id,
      ok: q.ok,
      errors: q.errors,
      warnings: q.warnings,
      duplicate: q.duplicate,
      status: q.normalized?.reviewStatus ?? null,
    })),
  };
}

const commitOptions = z.object({ validOnly: z.boolean().default(false), updateMatching: z.boolean().default(false) });

/** Re-validates on the server, then writes everything in one transaction. */
export async function commitImportAction(text, options = {}) {
  const { user, exam: active } = await getAppContext();
  if (!active) return { error: "Add an exam first." };
  const opts = commitOptions.parse(options);
  const parsed = parseJson(text);
  if (parsed.error) return { error: parsed.error };

  try {
    const counts = await withUser(user.id, async (db) => {
      const exam = await getExam(db, active.id);
      const result = await validateImport(parsed.json, { ...exam, existing: await existingForImport(db, active.id) });
      if (result.fatal) throw new Error(result.fatal.join("; "));
      if (result.summary.invalid > 0 && !opts.validOnly) throw new Error("Some questions have errors. Fix them, or import the valid ones only.");
      const toWrite = result.questions.filter((q) => q.ok && !q.duplicate).map((q) => q.normalized);
      return commitImport(db, user.id, exam, toWrite, { onExternalIdMatch: opts.updateMatching ? "update" : "skip" });
    });
    revalidatePath("/", "layout");
    return { counts };
  } catch (e) {
    return { error: e.message };
  }
}

export async function approveQuestionAction(questionId) {
  const user = await requireUser();
  const id = z.uuid().parse(questionId);
  await withUser(user.id, (db) => setReviewStatus(db, id, "approved"));
  revalidatePath("/", "layout");
}

export async function rejectQuestionAction(questionId, reason) {
  const user = await requireUser();
  const id = z.uuid().parse(questionId);
  const why = z.string().trim().min(1, "Give a reason.").max(500).parse(reason);
  await withUser(user.id, (db) => setReviewStatus(db, id, "rejected", why));
  revalidatePath("/", "layout");
}

const editSchema = z.object({
  id: z.uuid(),
  stem: z.string().trim().min(1),
  explanation: z.string().optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  tags: z.string().optional(),
  options: z.array(z.object({ text: z.string(), correct: z.boolean(), rationale: z.string().optional() })),
});

/** Saves an edited question through the same validation as an import (including the exam's profile). */
export async function updateQuestionAction(input) {
  const { user, exam: active } = await getAppContext();
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { error: "Those values were not valid." };
  const e = parsed.data;

  try {
    await withUser(user.id, async (db) => {
      const existing = await getQuestion(db, e.id);
      if (!existing) throw new Error("Question not found.");
      if (existing.fromBank) throw new Error("This question comes from the shared bank and can't be edited here.");
      const exam = await getExam(db, existing.examId);
      const domain = exam.domains.find((d) => d.id === existing.domainId);
      const objective = domain.objectives.find((o) => o.id === existing.objectiveId);
      const candidate = {
        id: existing.externalId ?? undefined,
        domain: domain.key,
        objective: objective.code,
        type: existing.type,
        stem: e.stem,
        options: e.options.map((o) => ({ text: o.text, correct: o.correct, rationale: o.rationale || undefined })),
        explanation: e.explanation || undefined,
        difficulty: e.difficulty,
        tags: (e.tags ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
        source: existing.source,
        reviewStatus: existing.reviewStatus,
        refs: existing.refs,
        generator: existing.generator ?? undefined,
        // Provenance dates are not editable here; validation only needs them present for ai-draft.
        generatedAt: "2000-01-01",
        lastVerified: "2000-01-01",
      };
      const result = validateImport({ formatVersion: 1, questions: [candidate] }, { ...exam, existing: { contentHashes: new Set(), stems: [] } });
      const q = result.questions[0];
      if (!q.ok) throw new Error(q.errors.join(" "));
      await updateQuestion(db, e.id, q.normalized);
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    if (err.code === "23505") return { error: "Another question in this exam is already identical to this." };
    return { error: err.message };
  }
}

const createSchema = z.object({
  objectiveId: z.uuid(),
  type: z.enum(["single", "multi", "tf"]),
  stem: z.string().trim().min(1),
  explanation: z.string().max(10_000).optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  tags: z.string().max(500).optional(),
  refs: z.array(z.string().max(2000)).max(20).optional(),
  status: z.enum(["approved", "draft"]),
  options: z
    .array(z.object({ text: z.string().max(2000), correct: z.boolean(), rationale: z.string().max(2000).optional() }))
    .max(8),
});

/** Writes a new question of your own into the active course, through the same checks as an import. */
export async function createQuestionAction(input) {
  const { user, exam: active } = await getAppContext();
  if (!active) return { error: "Choose a course first." };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: "Those values were not valid." };
  const e = parsed.data;

  try {
    const id = await withUser(user.id, async (db) => {
      const exam = await getExam(db, active.id);
      const domain = exam.domains.find((d) => d.objectives.some((o) => o.id === e.objectiveId));
      if (!domain) throw new Error("Pick an objective from this course.");
      const objective = domain.objectives.find((o) => o.id === e.objectiveId);
      const candidate = {
        domain: domain.key,
        objective: objective.code,
        type: e.type,
        stem: e.stem,
        options: e.options.map((o) => ({ text: o.text, correct: o.correct, rationale: o.rationale || undefined })),
        explanation: e.explanation || undefined,
        difficulty: e.difficulty,
        tags: (e.tags ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
        refs: e.refs?.length ? e.refs : undefined,
        source: "own",
        reviewStatus: e.status,
      };
      const result = validateImport(
        { formatVersion: 1, questions: [candidate] },
        { ...exam, existing: await existingForImport(db, exam.id) },
      );
      if (result.fatal) throw new Error(result.fatal.join("; "));
      const q = result.questions[0];
      if (!q.ok) throw new Error(q.errors.join(" "));
      if (q.duplicate) throw new Error("This course already has a question with the same text and answers.");
      await commitImport(db, user.id, exam, [q.normalized]);
      const { rows } = await db.query(
        "SELECT id FROM question WHERE exam_id = $1 AND content_hash = $2 ORDER BY created_at DESC LIMIT 1",
        [exam.id, q.normalized.contentHash],
      );
      return rows[0].id;
    });
    revalidatePath("/", "layout");
    return { id };
  } catch (err) {
    if (err.code === "23505") return { error: "This course already has a question with the same text and answers." };
    return { error: err.message };
  }
}
