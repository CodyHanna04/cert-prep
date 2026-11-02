import { z } from "zod";

/**
 * Exam pack blueprint (content/<code>/blueprint.json). `scripts/validate-pack.mjs` is the strict authoring-time
 * check; this schema is what the app needs at load time. Unknown fields are ignored.
 */
const objective = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  scope: z.array(z.string()).default([]),
});

const domain = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  weightPct: z.number().min(0).max(100),
  objectives: z.array(objective).min(1),
});

const source = z.object({
  title: z.string(),
  url: z.string(),
  retrievedOn: z.string(),
  note: z.string().optional(),
});

const profile = z
  .object({
    single: z.object({ options: z.number().int().optional() }).optional(),
    multi: z
      .object({ minOptions: z.number().int().optional(), minCorrect: z.number().int().optional() })
      .optional(),
    bannedOptionText: z.array(z.string()).optional(),
    outOfScopeTerms: z.array(z.string()).optional(),
  })
  .default({});

/** Optional catalog copy for the Courses page. Written by the pack author, never taken from vendor marketing. */
const marketing = z.object({
  tagline: z.string(),
  level: z.string(),
  audience: z.string(),
  highlights: z.array(z.string()).default([]),
});

export const packSchema = z.object({
  formatVersion: z.literal(1),
  sources: z.array(source).min(1),
  exam: z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    vendor: z.string().min(1),
    passMarkPct: z.number().nullable().optional(),
    passMarkNote: z.string().optional(),
    readinessTargetPct: z.number().int().min(1).max(100).default(80),
    timeLimitMin: z.number().int().positive().nullable().optional(),
    questionCount: z.number().int().positive().nullable().optional(),
    profile,
    marketing: marketing.optional(),
    domains: z.array(domain).min(1),
  }),
});

/** @param {unknown} json */
export function parsePack(json) {
  return packSchema.parse(json);
}
