import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * Import validation (docs/04-content-format.md). Pure: no I/O. Each question is validated on its own so one bad
 * question never hides the others; the caller decides whether to import "valid rows only" or nothing.
 */

export const MAX_OPTIONS = 8;
const OPTION_IDS = "abcdefgh".split("");

const optionIn = z.object({
  text: z.string().trim().min(1, "option text is empty"),
  correct: z.boolean(),
  rationale: z.string().optional(),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

const questionIn = z.object({
  id: z.string().trim().min(1).optional(),
  domain: z.string().trim().min(1, "domain is required"),
  objective: z.string().trim().min(1, "objective is required"),
  type: z.enum(["single", "multi", "tf"], { error: "type must be single, multi or tf" }),
  stem: z.string().trim().min(1, "stem is required"),
  options: z.array(optionIn).min(2, "needs at least 2 options").max(MAX_OPTIONS, `at most ${MAX_OPTIONS} options`),
  explanation: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "tags are lowercase kebab-case")).optional(),
  refs: z.array(z.url({ protocol: /^https$/, error: "refs must be https URLs" })).optional(),
  source: z.enum(["own", "ai-draft", "licensed", "imported"]).optional(),
  reviewStatus: z.enum(["draft", "approved", "rejected"]).optional(),
  generator: z.string().optional(),
  generatedAt: isoDate.optional(),
  lastVerified: isoDate.optional(),
  needsAttention: z.boolean().optional(),
});

export const importFileSchema = z.object({
  formatVersion: z.literal(1, { error: "unsupported formatVersion (this app reads 1)" }),
  questions: z.array(z.unknown()),
});

const normalize = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
const words = (s) => new Set(normalize(s).replace(/[^a-z0-9 ]/g, "").split(" ").filter(Boolean));

function similarity(a, b) {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared += 1;
  return shared / (wa.size + wb.size - shared);
}

/** Stable hash of what makes a question "the same": type, stem, and each option's text and correctness. */
export function contentHash({ type, stem, options }) {
  const body = JSON.stringify([
    type,
    normalize(stem),
    options.map((o) => [normalize(o.text), !!o.isCorrect]).sort((x, y) => (x[0] < y[0] ? -1 : 1)),
  ]);
  return createHash("sha256").update(body).digest("hex");
}

/**
 * @param {unknown} file parsed JSON of an import file
 * @param {{
 *   domains: { key: string, name: string, objectives: { code: string }[] }[],
 *   profile?: { single?: { options?: number }, multi?: { minOptions?: number, minCorrect?: number }, bannedOptionText?: string[] },
 *   existing?: { contentHashes?: Set<string>, stems?: string[] },
 * }} exam the target exam (from the database)
 */
export function validateImport(file, exam) {
  const envelope = importFileSchema.safeParse(file);
  if (!envelope.success) {
    return { fatal: envelope.error.issues.map((i) => `${i.path.join(".") || "file"}: ${i.message}`), questions: [], summary: null };
  }

  const profile = exam.profile ?? {};
  const banned = (profile.bannedOptionText ?? []).map(normalize);
  const existingHashes = exam.existing?.contentHashes ?? new Set();
  const existingStems = exam.existing?.stems ?? [];
  const seenHashes = new Set();
  const seenStems = [];

  const results = envelope.data.questions.map((raw, index) => {
    const errors = [];
    const warnings = [];
    const parsed = questionIn.safeParse(raw);
    if (!parsed.success) {
      for (const i of parsed.error.issues) errors.push(`${i.path.join(".") || "question"}: ${i.message}`);
      return { index, id: raw?.id ?? null, ok: false, errors, warnings, duplicate: null, normalized: null };
    }
    const q = parsed.data;

    const domain = exam.domains.find((d) => d.key === q.domain || d.name === q.domain);
    if (!domain) errors.push(`domain: "${q.domain}" is not a domain of this exam`);
    const objective = domain?.objectives.find((o) => o.code === q.objective);
    if (domain && !objective) errors.push(`objective: "${q.objective}" is not an objective of domain ${domain.key}`);

    // Option structure by type.
    const correctCount = q.options.filter((o) => o.correct).length;
    if (q.type === "tf" && q.options.length !== 2) errors.push("options: a true/false question has exactly 2 options");
    if ((q.type === "single" || q.type === "tf") && correctCount !== 1) {
      errors.push(`options: ${q.type} needs exactly 1 correct option (found ${correctCount})`);
    }
    if (q.type === "multi" && correctCount < 1) errors.push("options: multi needs at least 1 correct option");
    const texts = q.options.map((o) => normalize(o.text));
    if (new Set(texts).size !== texts.length) errors.push("options: duplicate option text");

    // Exam-specific profile (from the pack).
    if (q.type === "single" && profile.single?.options && q.options.length !== profile.single.options) {
      errors.push(`profile: single questions on this exam have exactly ${profile.single.options} options`);
    }
    if (q.type === "multi") {
      if (profile.multi?.minOptions && q.options.length < profile.multi.minOptions) {
        errors.push(`profile: multi questions on this exam have at least ${profile.multi.minOptions} options`);
      }
      if (profile.multi?.minCorrect && correctCount < profile.multi.minCorrect) {
        errors.push(`profile: multi questions on this exam have at least ${profile.multi.minCorrect} correct options`);
      }
    }
    for (const t of texts) {
      if (banned.some((b) => t.includes(b))) errors.push(`profile: option text "${t}" is not allowed on this exam`);
    }

    const source = q.source ?? "imported";
    if (source === "ai-draft") {
      if (!q.generator) errors.push("generator: required for ai-draft");
      if (!q.generatedAt) errors.push("generatedAt: required for ai-draft");
      if (!q.lastVerified) errors.push("lastVerified: required for ai-draft");
      if (!q.refs?.length) errors.push("refs: at least one supporting URL is required for ai-draft");
    }

    // Warnings.
    if (q.options.some((o) => !o.rationale?.trim())) warnings.push("some options have no rationale");
    if (!q.explanation?.trim()) warnings.push("no explanation");
    if (q.difficulty == null) warnings.push("no difficulty");
    if (q.type === "multi" && !/\b(choose|select|pick|two|three|four|\d)\b/i.test(q.stem)) {
      warnings.push("multi stem should state how many answers to choose");
    }

    const options = q.options.map((o, i) => ({
      id: OPTION_IDS[i],
      text: o.text.trim(),
      isCorrect: o.correct,
      rationale: o.rationale?.trim() || null,
    }));
    const hash = contentHash({ type: q.type, stem: q.stem, options });

    let duplicate = null;
    if (existingHashes.has(hash)) duplicate = "existing";
    else if (seenHashes.has(hash)) duplicate = "in-file";
    else if ([...existingStems, ...seenStems].some((s) => similarity(s, q.stem) >= 0.9)) {
      warnings.push("very similar to an existing question");
    }
    seenHashes.add(hash);
    seenStems.push(q.stem);

    const reviewStatus = q.reviewStatus ?? (source === "own" || source === "licensed" ? "approved" : "draft");

    return {
      index,
      id: q.id ?? null,
      ok: errors.length === 0,
      errors,
      warnings,
      duplicate,
      normalized:
        errors.length === 0
          ? {
              externalId: q.id ?? null,
              domainKey: domain.key,
              objectiveCode: objective.code,
              type: q.type,
              stem: q.stem.trim(),
              options,
              explanation: q.explanation?.trim() || null,
              difficulty: q.difficulty ?? null,
              tags: q.tags ?? [],
              source,
              reviewStatus,
              generator: q.generator ?? null,
              generatedAt: q.generatedAt ?? null,
              lastVerified: q.lastVerified ?? null,
              refs: q.refs ?? [],
              needsAttention: q.needsAttention ?? false,
              contentHash: hash,
            }
          : null,
    };
  });

  return {
    fatal: null,
    questions: results,
    summary: {
      total: results.length,
      valid: results.filter((r) => r.ok && !r.duplicate).length,
      invalid: results.filter((r) => !r.ok).length,
      duplicates: results.filter((r) => r.duplicate).length,
      withWarnings: results.filter((r) => r.warnings.length > 0).length,
    },
  };
}
