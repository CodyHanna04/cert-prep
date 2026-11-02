import { allocateByWeight } from "./sampling.js";

/** How many approved questions an objective needs before practice drills on it feel worthwhile (docs/07 section 6). */
export const PRACTICE_MIN = 10;
/** The starter bank aims for this many full exams' worth of questions, so mocks can sample without repeats. */
export const BANK_MULTIPLIER = 4;
/** Fewer than this many exams' worth of approved questions and mocks repeat questions too often. */
export const MOCK_MIN_MULTIPLIER = 2;

/**
 * Default target of approved questions per objective: `multiplier` exams' worth of questions, split across
 * domains by blueprint weight and then evenly across each domain's objectives (extras go to the earlier ones).
 * @param {{ id: string, weightPct: number, objectiveIds: string[] }[]} domains
 * @param {number} examQuestionCount
 * @returns {Map<string, number>} objective id -> target
 */
export function coverageTargets(domains, examQuestionCount, multiplier = BANK_MULTIPLIER) {
  const perDomain = allocateByWeight(Math.round(examQuestionCount * multiplier), domains);
  const targets = new Map();
  for (const d of domains) {
    const total = perDomain.get(d.id);
    const base = Math.floor(total / d.objectiveIds.length);
    const extra = total - base * d.objectiveIds.length;
    d.objectiveIds.forEach((id, i) => targets.set(id, base + (i < extra ? 1 : 0)));
  }
  return targets;
}

/** "needs" below the practice minimum, "practice" once drills are worthwhile, "full" at the target. */
export const stageFor = (approved, target) =>
  approved >= target ? "full" : approved >= PRACTICE_MIN ? "practice" : "needs";

/**
 * @param {{ domains: { id: string, name: string, weightPct: number, objectives: { id: string, code: string, title: string }[] }[], questionCount: number | null }} exam
 * @param {{ objectiveId: string, reviewStatus: string, n: number }[]} counts from countsByObjective
 */
export function buildCoverage(exam, counts) {
  const examSize = exam.questionCount ?? 65;
  const targets = coverageTargets(
    exam.domains.map((d) => ({
      id: d.id,
      weightPct: d.weightPct,
      objectiveIds: d.objectives.map((o) => o.id),
    })),
    examSize,
  );
  const n = (objectiveId, status) =>
    counts.find((c) => c.objectiveId === objectiveId && c.reviewStatus === status)?.n ?? 0;

  const domains = exam.domains.map((d) => {
    const objectives = d.objectives.map((o) => {
      const approved = n(o.id, "approved");
      const target = targets.get(o.id);
      return {
        id: o.id,
        code: o.code,
        title: o.title,
        approved,
        draft: n(o.id, "draft"),
        target,
        stage: stageFor(approved, target),
      };
    });
    const sum = (k) => objectives.reduce((s, o) => s + o[k], 0);
    return {
      id: d.id,
      name: d.name,
      weightPct: d.weightPct,
      objectives,
      approved: sum("approved"),
      draft: sum("draft"),
      target: sum("target"),
    };
  });

  const approved = domains.reduce((s, d) => s + d.approved, 0);
  return {
    domains,
    approved,
    draft: domains.reduce((s, d) => s + d.draft, 0),
    target: domains.reduce((s, d) => s + d.target, 0),
    practiceReady: domains.flatMap((d) => d.objectives).filter((o) => o.stage !== "needs").length,
    objectiveCount: domains.reduce((s, d) => s + d.objectives.length, 0),
    mockReady: approved >= examSize * MOCK_MIN_MULTIPLIER,
    mockMin: examSize * MOCK_MIN_MULTIPLIER,
  };
}
