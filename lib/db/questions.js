/**
 * Question data access (see exams.js for the conventions). Options are stored as jsonb:
 * [{ id, text, isCorrect, rationale }].
 */

export const questionRow = (r) => ({
  id: r.id,
  examId: r.exam_id,
  domainId: r.domain_id,
  objectiveId: r.objective_id,
  externalId: r.external_id,
  type: r.type,
  stem: r.stem,
  options: r.options,
  explanation: r.explanation,
  difficulty: r.difficulty,
  tags: r.tags,
  source: r.source,
  reviewStatus: r.review_status,
  rejectReason: r.reject_reason,
  generator: r.generator,
  refs: r.refs,
  needsAttention: r.needs_attention,
  contentHash: r.content_hash,
});

/** What the importer needs to detect duplicates. */
export async function existingForImport(db, examId) {
  const { rows } = await db.query("SELECT content_hash, stem FROM question WHERE exam_id = $1", [examId]);
  return { contentHashes: new Set(rows.map((r) => r.content_hash)), stems: rows.map((r) => r.stem) };
}

/**
 * Writes validated questions. Runs inside the caller's transaction, so it is all-or-nothing.
 * `onExternalIdMatch`: "skip" leaves an existing question alone, "update" rewrites its content.
 * @param {{ domains: { id: string, key: string, objectives: { id: string, code: string }[] }[] }} exam
 * @param {object[]} normalized the `normalized` objects from validateImport (valid, non-duplicate only)
 */
export async function commitImport(db, userId, exam, normalized, { onExternalIdMatch = "skip" } = {}) {
  const domainByKey = new Map(exam.domains.map((d) => [d.key, d]));
  const counts = { inserted: 0, updated: 0, skipped: 0 };

  for (const q of normalized) {
    const domain = domainByKey.get(q.domainKey);
    const objective = domain?.objectives.find((o) => o.code === q.objectiveCode);
    if (!domain || !objective) throw new Error(`Unknown domain/objective for question ${q.externalId ?? q.stem.slice(0, 40)}`);

    if (q.externalId) {
      const { rows } = await db.query("SELECT id FROM question WHERE exam_id = $1 AND external_id = $2", [
        exam.id,
        q.externalId,
      ]);
      if (rows.length > 0) {
        if (onExternalIdMatch === "update") {
          await db.query(
            `UPDATE question SET domain_id=$2, objective_id=$3, type=$4, stem=$5, options=$6, explanation=$7,
               difficulty=$8, tags=$9, refs=$10, content_hash=$11, updated_at=now() WHERE id=$1`,
            [
              rows[0].id, domain.id, objective.id, q.type, q.stem, JSON.stringify(q.options), q.explanation,
              q.difficulty, q.tags, JSON.stringify(q.refs), q.contentHash,
            ],
          );
          counts.updated += 1;
        } else {
          counts.skipped += 1;
        }
        continue;
      }
    }

    await db.query(
      `INSERT INTO question (user_id, exam_id, domain_id, objective_id, external_id, type, stem, options,
         explanation, difficulty, tags, source, review_status, generator, generated_at, last_verified, refs,
         needs_attention, content_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        userId, exam.id, domain.id, objective.id, q.externalId, q.type, q.stem, JSON.stringify(q.options),
        q.explanation, q.difficulty, q.tags, q.source, q.reviewStatus, q.generator, q.generatedAt, q.lastVerified,
        JSON.stringify(q.refs), q.needsAttention, q.contentHash,
      ],
    );
    counts.inserted += 1;
  }
  return counts;
}

/** Approved questions only: the pool for practice, mocks and stats. */
export async function getPool(db, examId) {
  const { rows } = await db.query(
    "SELECT id, domain_id, objective_id FROM question WHERE exam_id = $1 AND review_status = 'approved'",
    [examId],
  );
  return rows.map((r) => ({ id: r.id, domainId: r.domain_id, objectiveId: r.objective_id }));
}

/** Question counts per objective and review status, for the coverage view and the draft inbox. */
export async function countsByObjective(db, examId) {
  const { rows } = await db.query(
    `SELECT objective_id, review_status, count(*)::int AS n FROM question WHERE exam_id = $1
      GROUP BY objective_id, review_status`,
    [examId],
  );
  return rows.map((r) => ({ objectiveId: r.objective_id, reviewStatus: r.review_status, n: r.n }));
}

export async function listQuestions(db, examId, { reviewStatus, objectiveId, domainId, search, limit = 50, offset = 0 } = {}) {
  const where = ["exam_id = $1"];
  const params = [examId];
  const add = (sql, v) => {
    params.push(v);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (reviewStatus) add("review_status = ?", reviewStatus);
  if (objectiveId) add("objective_id = ?", objectiveId);
  if (domainId) add("domain_id = ?", domainId);
  if (search) add("stem ILIKE ?", `%${search.replace(/[%_\\]/g, "\\$&")}%`);
  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT * FROM question WHERE ${where.join(" AND ")} ORDER BY created_at, id
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows.map(questionRow);
}

export async function getQuestion(db, id) {
  const { rows } = await db.query("SELECT * FROM question WHERE id = $1", [id]);
  return rows[0] ? questionRow(rows[0]) : null;
}

export async function getQuestionsByIds(db, ids) {
  if (ids.length === 0) return [];
  const { rows } = await db.query("SELECT * FROM question WHERE id = ANY($1::uuid[])", [ids]);
  return rows.map(questionRow);
}

/** Approve or reject a draft. Rejecting requires a reason. */
export async function setReviewStatus(db, id, status, rejectReason = null) {
  if (!["draft", "approved", "rejected"].includes(status)) throw new Error("Bad review status");
  if (status === "rejected" && !rejectReason?.trim()) throw new Error("A reject reason is required.");
  await db.query(
    "UPDATE question SET review_status = $2, reject_reason = $3, updated_at = now() WHERE id = $1",
    [id, status, status === "rejected" ? rejectReason.trim() : null],
  );
}

/**
 * Rewrites a question's content from validated import output. Keeps its id and history; the review status,
 * source and provenance stay as they are. Changing the correct answer changes the content hash.
 */
export async function updateQuestion(db, id, q) {
  await db.query(
    `UPDATE question SET stem = $2, options = $3, explanation = $4, difficulty = $5, tags = $6,
            content_hash = $7, updated_at = now() WHERE id = $1`,
    [id, q.stem, JSON.stringify(q.options), q.explanation, q.difficulty, q.tags, q.contentHash],
  );
}

/** Next draft to review for an exam, optionally within one objective. */
export async function nextDraft(db, examId, objectiveId = null) {
  const { rows } = await db.query(
    `SELECT * FROM question WHERE exam_id = $1 AND review_status = 'draft'
       AND ($2::uuid IS NULL OR objective_id = $2) ORDER BY created_at, id LIMIT 1`,
    [examId, objectiveId],
  );
  return rows[0] ? questionRow(rows[0]) : null;
}

export async function toggleMark(db, userId, questionId, kind) {
  const del = await db.query("DELETE FROM question_mark WHERE question_id = $1 AND kind = $2", [questionId, kind]);
  if (del.rowCount > 0) return false;
  await db.query("INSERT INTO question_mark (user_id, question_id, kind) VALUES ($1,$2,$3)", [userId, questionId, kind]);
  return true;
}

export async function flaggedIds(db, examId) {
  const { rows } = await db.query(
    `SELECT m.question_id FROM question_mark m JOIN question q ON q.id = m.question_id
      WHERE q.exam_id = $1 AND m.kind = 'flag'`,
    [examId],
  );
  return new Set(rows.map((r) => r.question_id));
}

export async function getNote(db, questionId) {
  const { rows } = await db.query("SELECT body FROM note WHERE question_id = $1", [questionId]);
  return rows[0]?.body ?? "";
}

export async function setNote(db, userId, questionId, body) {
  if (!body.trim()) {
    await db.query("DELETE FROM note WHERE question_id = $1", [questionId]);
    return;
  }
  await db.query(
    `INSERT INTO note (user_id, question_id, body) VALUES ($1,$2,$3)
     ON CONFLICT (question_id) DO UPDATE SET body = EXCLUDED.body, updated_at = now()`,
    [userId, questionId, body.trim()],
  );
}
