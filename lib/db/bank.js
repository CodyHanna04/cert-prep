import { validateImport } from "../content/validate-questions.js";
import { getExam } from "./exams.js";

/**
 * Copies a pack's shared bank (lib/content/bank.js) into one learner's exam. Runs inside the caller's
 * `withUser` transaction, so it only ever touches that learner's rows.
 *
 * - Matches on the question `id` (external_id), or on identical content for a copy the learner imported
 *   before it reached the bank; those rows become bank rows.
 * - Bank questions are always approved. Questions dropped from the bank are rejected with a reason
 *   rather than deleted, so answer history survives.
 * - The learner's own imports are never changed.
 */
export const RETIRED_REASON = "Retired from the shared question bank";

export async function syncPackBank(db, userId, examId, bank) {
  const exam = await getExam(db, examId);
  if (!exam) throw new Error("Exam not found");
  const counts = { inserted: 0, updated: 0, retired: 0, skipped: 0 };
  const { questions: results = [] } = validateImport({ formatVersion: 1, questions: bank.questions }, exam);
  const domainByKey = new Map(exam.domains.map((d) => [d.key, d]));
  const keep = [];

  for (const r of results) {
    const q = r.normalized;
    if (!r.ok || !q.externalId) {
      counts.skipped += 1;
      continue;
    }
    const domain = domainByKey.get(q.domainKey);
    const objective = domain.objectives.find((o) => o.code === q.objectiveCode);
    keep.push(q.externalId);

    // One bad row (say, an edit that now collides with a learner's own question) skips that question only.
    await db.query("SAVEPOINT bank_q");
    try {
      const { rows } = await db.query(
        `SELECT id, content_hash, from_bank FROM question
          WHERE exam_id = $1 AND (external_id = $2 OR content_hash = $3)
          ORDER BY (external_id = $2) DESC LIMIT 1`,
        [examId, q.externalId, q.contentHash],
      );
      const fields = [
        domain.id, objective.id, q.externalId, q.type, q.stem, JSON.stringify(q.options), q.explanation,
        q.difficulty, q.tags, q.source, q.generator, q.generatedAt, q.lastVerified, JSON.stringify(q.refs),
        q.contentHash,
      ];
      if (rows.length > 0) {
        await db.query(
          `UPDATE question SET domain_id=$2, objective_id=$3, external_id=$4, type=$5, stem=$6, options=$7,
             explanation=$8, difficulty=$9, tags=$10, source=$11, generator=$12, generated_at=$13,
             last_verified=$14, refs=$15, content_hash=$16, from_bank=true, review_status='approved',
             reject_reason=NULL, needs_attention=false, updated_at=now()
           WHERE id=$1`,
          [rows[0].id, ...fields],
        );
        if (!rows[0].from_bank || rows[0].content_hash !== q.contentHash) counts.updated += 1;
      } else {
        await db.query(
          `INSERT INTO question (user_id, exam_id, domain_id, objective_id, external_id, type, stem, options,
             explanation, difficulty, tags, source, generator, generated_at, last_verified, refs, content_hash,
             from_bank, review_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,true,'approved')`,
          [userId, examId, ...fields],
        );
        counts.inserted += 1;
      }
      await db.query("RELEASE SAVEPOINT bank_q");
    } catch (e) {
      await db.query("ROLLBACK TO SAVEPOINT bank_q");
      console.error(`bank sync: skipped ${q.externalId}: ${e.message}`);
      counts.skipped += 1;
    }
  }

  const retired = await db.query(
    `UPDATE question SET review_status='rejected', reject_reason=$3, updated_at=now()
      WHERE exam_id=$1 AND from_bank AND review_status <> 'rejected' AND NOT (external_id = ANY($2))`,
    [examId, keep, RETIRED_REASON],
  );
  counts.retired = retired.rowCount;
  await db.query("UPDATE exam SET bank_version = $2, updated_at = now() WHERE id = $1", [examId, bank.version]);
  return counts;
}

/** Syncs every exam whose recorded bank version differs from the pack's current one. */
export async function syncStaleBanks(db, userId, exams, readBank) {
  let changed = false;
  for (const e of exams) {
    const bank = readBank(e.code);
    if ((bank.version ?? null) === (e.bankVersion ?? null)) continue;
    await syncPackBank(db, userId, e.id, bank);
    changed = true;
  }
  return changed;
}
