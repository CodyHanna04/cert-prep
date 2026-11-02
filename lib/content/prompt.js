/**
 * Fills content/prompts/draft-questions.md for one objective. Pure: the caller reads the template and style file.
 * @param {string} template the text of draft-questions.md after its "---" separator
 * @param {{
 *   exam: { code: string, name: string, profile?: { single?: { options?: number }, multi?: { minOptions?: number, minCorrect?: number } } },
 *   domain: { key: string, name: string, weightPct: number },
 *   objective: { code: string, title: string, scope: string[] },
 *   count: number,
 *   packDir: string,
 *   style?: string | null,
 *   existingStems?: string[],
 *   startNumber?: number,
 *   today: string,
 *   model?: string,
 * }} input
 */
export function fillDraftPrompt(template, { exam, domain, objective, count, packDir, style, existingStems = [], startNumber = 1, today, model = "your model id" }) {
  const single = exam.profile?.single?.options;
  const multi = exam.profile?.multi;
  const multiCount = Math.max(0, Math.round(count * 0.12));
  const multiRules = [];
  if (multi?.minOptions) multiRules.push(`at least ${multi.minOptions} options`);
  if (multi?.minCorrect) multiRules.push(`at least ${multi.minCorrect} correct`);
  multiRules.push('the stem must say how many to choose, e.g. "Choose TWO."');
  const format = [
    `About ${count - multiCount} should be \`single\` (exactly one correct${single ? `, ${single} options` : ""}).`,
    multiCount > 0 ? `About ${multiCount} should be \`multi\` (${multiRules.join(", ")}).` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const idPrefix = `${packDir}-${objective.code}`;
  const values = {
    EXAM_NAME: exam.name,
    EXAM_CODE: exam.code,
    OBJECTIVE_CODE: objective.code,
    OBJECTIVE_TITLE: objective.title,
    DOMAIN_KEY: domain.key,
    DOMAIN_NAME: domain.name,
    DOMAIN_WEIGHT: String(domain.weightPct),
    SCOPE: objective.scope.length ? objective.scope.map((s) => `- ${s}`).join("\n") : "- (the vendor lists no detail; use the objective title)",
    COUNT: String(count),
    FORMAT_RULES: format,
    STYLE: style?.trim() || "No exam-specific style notes exist yet. Match the level of the vendor's task statements for this objective: if they say \"identify\" or \"describe\", test recognition; if they say \"implement\" or \"troubleshoot\", test applied decisions.",
    EXISTING: existingStems.length ? existingStems.map((s) => `- ${s.replace(/\s+/g, " ").slice(0, 160)}`).join("\n") : "(none yet)",
    PACK_DIR: packDir,
    ID_PREFIX: idPrefix,
    START_NUMBER: String(startNumber).padStart(2, "0"),
    TODAY: today,
    MODEL: model,
  };
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key) => values[key] ?? whole);
}

/** The part of the prompt file after the first horizontal rule: the text a model should actually receive. */
export function promptBody(fileText) {
  const at = fileText.indexOf("\n---\n");
  return (at === -1 ? fileText : fileText.slice(at + 5)).trim();
}
