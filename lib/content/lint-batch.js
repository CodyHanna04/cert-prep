/**
 * Batch-level checks from docs/07-ai-content-pipeline.md section 5. Pure: no I/O. They look at the shape of a
 * whole file of questions (answer position, option length tells) and at wording habits, none of which a
 * single-question schema check can see. All findings are warnings; structural errors live in validate-questions.js.
 */

/** A batch needs enough single-answer questions before position and length statistics mean anything. */
const MIN_FOR_STATS = 6;
const POSITION_LIMIT = 0.5;
const LONGEST_LIMIT = 0.6;
const FRESH_DAYS = 365;

const ABSOLUTES = /\b(always|never|only|guaranteed|entirely|completely|impossible)\b/i;
const ABOVE = /\b(all|none) of the above\b/i;
const NEGATIVE_STEM = /\b(NOT|EXCEPT)\b/;

/**
 * @param {{ id?: string | null, type: string, stem: string, options: { text: string, isCorrect: boolean }[], lastVerified?: string | null }[]} questions
 *   normalized questions (valid ones only) from one batch
 * @param {{ now?: Date }} [opts]
 * @returns {{ batch: string[], perQuestion: string[][] }} `perQuestion[i]` belongs to `questions[i]`
 */
export function lintBatch(questions, { now = new Date() } = {}) {
  const batch = [];
  const singles = questions.filter((q) => q.type === "single");

  if (singles.length >= MIN_FOR_STATS) {
    const letters = "abcdefgh";
    const byPosition = new Map();
    for (const q of singles) {
      const at = q.options.findIndex((o) => o.isCorrect);
      byPosition.set(at, (byPosition.get(at) ?? 0) + 1);
    }
    for (const [at, n] of byPosition) {
      if (n / singles.length > POSITION_LIMIT) {
        batch.push(`correct answer is option ${letters[at]} in ${n} of ${singles.length} single-answer questions (over ${POSITION_LIMIT * 100}%): vary the position`);
      }
    }

    // "Longest option is correct" is the classic test-taking tell; ties are not counted either way.
    const longestCorrect = singles.filter((q) => {
      const lengths = q.options.map((o) => o.text.length);
      const max = Math.max(...lengths);
      return lengths.filter((l) => l === max).length === 1 && q.options[lengths.indexOf(max)].isCorrect;
    }).length;
    if (longestCorrect / singles.length > LONGEST_LIMIT) {
      batch.push(`the longest option is the correct one in ${longestCorrect} of ${singles.length} single-answer questions (over ${LONGEST_LIMIT * 100}%): the key is easy to guess`);
    }
  }

  const perQuestion = questions.map((q) => {
    const w = [];
    const absolute = q.options.map((o) => o.text.match(ABSOLUTES)?.[0]).find(Boolean);
    if (absolute) w.push(`an option uses the absolute word "${absolute.toLowerCase()}", which tends to give wrong answers away`);
    if (ABOVE.test(q.stem) || q.options.some((o) => ABOVE.test(o.text))) w.push('uses "all/none of the above"');
    if (NEGATIVE_STEM.test(q.stem)) w.push("stem is phrased as NOT/EXCEPT: prefer a positive phrasing");
    if (q.lastVerified) {
      const ageDays = (now - new Date(`${q.lastVerified}T00:00:00Z`)) / 86400000;
      if (ageDays > FRESH_DAYS) w.push(`lastVerified is over a year old (${q.lastVerified}): re-check against current docs`);
    }
    return w;
  });

  return { batch, perQuestion };
}
