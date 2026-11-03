import { parsePack } from "../schemas/pack.js";

/**
 * Exam data access. Every function takes `db`, a client from `withUser(...)`, so row-level
 * security scopes it to the signed-in user. Rows are mapped to camelCase here.
 */

const examRow = (r) => ({
  id: r.id,
  code: r.code,
  name: r.name,
  vendor: r.vendor,
  passMarkPct: r.pass_mark_pct == null ? null : Number(r.pass_mark_pct),
  passMarkNote: r.pass_mark_note,
  readinessTargetPct: r.readiness_target_pct,
  timeLimitMin: r.time_limit_min,
  questionCount: r.question_count,
  examDate: r.exam_date ? r.exam_date.toISOString().slice(0, 10) : null,
  profile: r.profile,
  sources: r.sources,
  archived: r.archived,
  bankVersion: r.bank_version ?? null,
});

export async function listExams(db, { includeArchived = false } = {}) {
  const { rows } = await db.query(
    `SELECT * FROM exam ${includeArchived ? "" : "WHERE NOT archived"} ORDER BY created_at`,
  );
  return rows.map(examRow);
}

/** One exam with its domains and objectives, in blueprint order. Returns null if it isn't yours. */
export async function getExam(db, examId) {
  const { rows } = await db.query("SELECT * FROM exam WHERE id = $1", [examId]);
  if (rows.length === 0) return null;
  const domains = (
    await db.query("SELECT * FROM domain WHERE exam_id = $1 ORDER BY sort_order", [examId])
  ).rows;
  const objectives = (
    await db.query("SELECT * FROM objective WHERE exam_id = $1 ORDER BY sort_order", [examId])
  ).rows;
  return {
    ...examRow(rows[0]),
    domains: domains.map((d) => ({
      id: d.id,
      key: d.key,
      name: d.name,
      weightPct: Number(d.weight_pct),
      objectives: objectives
        .filter((o) => o.domain_id === d.id)
        .map((o) => ({
          id: o.id,
          domainId: o.domain_id,
          code: o.code,
          title: o.title,
          scope: o.scope,
          studyNotes: o.study_notes,
        })),
    })),
  };
}

/** Copies an exam pack into the signed-in user's own rows. */
export async function createExamFromPack(db, userId, packJson) {
  const pack = parsePack(packJson);
  const e = pack.exam;
  const dup = await db.query("SELECT 1 FROM exam WHERE code = $1", [e.code]);
  if (dup.rowCount > 0) throw new Error(`You have already added ${e.code}.`);

  const { rows } = await db.query(
    `INSERT INTO exam (user_id, code, name, vendor, pass_mark_pct, pass_mark_note, readiness_target_pct,
                       time_limit_min, question_count, profile, sources)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [
      userId,
      e.code,
      e.name,
      e.vendor,
      e.passMarkPct ?? null,
      e.passMarkNote ?? null,
      e.readinessTargetPct,
      e.timeLimitMin ?? null,
      e.questionCount ?? null,
      JSON.stringify(e.profile),
      JSON.stringify(pack.sources),
    ],
  );
  const examId = rows[0].id;
  let objectiveOrder = 0;
  for (const [i, d] of e.domains.entries()) {
    const dom = await db.query(
      `INSERT INTO domain (user_id, exam_id, key, name, weight_pct, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [userId, examId, d.key, d.name, d.weightPct, i],
    );
    for (const o of d.objectives) {
      await db.query(
        `INSERT INTO objective (user_id, exam_id, domain_id, code, title, scope, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          userId,
          examId,
          dom.rows[0].id,
          o.code,
          o.title,
          JSON.stringify(o.scope),
          objectiveOrder++,
        ],
      );
    }
  }
  return examId;
}

/**
 * Starts studying a pack: restores it if the learner paused it earlier (progress is kept), does nothing if
 * it is already active, otherwise copies the pack in. Always returns the exam id.
 */
export async function enrollInPack(db, userId, packJson) {
  const code = parsePack(packJson).exam.code;
  const existing = await db.query("SELECT id, archived FROM exam WHERE code = $1", [code]);
  if (existing.rowCount === 0) return createExamFromPack(db, userId, packJson);
  if (existing.rows[0].archived) await archiveExam(db, existing.rows[0].id, false);
  return existing.rows[0].id;
}

/** Courses the learner paused: hidden from the dashboard, with progress kept. */
export async function listPausedExams(db) {
  const { rows } = await db.query("SELECT * FROM exam WHERE archived ORDER BY created_at");
  return rows.map(examRow);
}

/** Updates the per-exam settings the user may change. */
export async function updateExamSettings(db, examId, { readinessTargetPct, examDate }) {
  const target = Number(readinessTargetPct);
  if (!Number.isInteger(target) || target < 1 || target > 100) {
    throw new Error("Readiness target must be a whole number from 1 to 100.");
  }
  await db.query(
    "UPDATE exam SET readiness_target_pct = $2, exam_date = $3, updated_at = now() WHERE id = $1",
    [examId, target, examDate || null],
  );
}

export async function archiveExam(db, examId, archived = true) {
  await db.query("UPDATE exam SET archived = $2, updated_at = now() WHERE id = $1", [
    examId,
    archived,
  ]);
}
