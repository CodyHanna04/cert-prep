import { z } from "zod";

/**
 * Per-user export and import (docs/04-content-format.md, "Personal data export").
 * Ids are never exported: questions are referenced by content hash, so an import builds fresh rows for
 * whoever imports it. Deliberately plain: no migrations, checksums or merge mode.
 */

export const EXPORT_VERSION = 1;

const iso = (d) => new Date(d).toISOString();

export async function exportUserData(db) {
  const exams = (await db.query("SELECT * FROM exam ORDER BY created_at")).rows;
  const out = [];
  for (const e of exams) {
    const domains = (await db.query("SELECT * FROM domain WHERE exam_id = $1 ORDER BY sort_order", [e.id])).rows;
    const objectives = (await db.query("SELECT * FROM objective WHERE exam_id = $1 ORDER BY sort_order", [e.id])).rows;
    const questions = (await db.query("SELECT * FROM question WHERE exam_id = $1 ORDER BY created_at, content_hash", [e.id])).rows;
    const marks = (await db.query("SELECT m.question_id, m.kind FROM question_mark m JOIN question q ON q.id = m.question_id WHERE q.exam_id = $1", [e.id])).rows;
    const notes = (await db.query("SELECT n.question_id, n.body FROM note n JOIN question q ON q.id = n.question_id WHERE q.exam_id = $1", [e.id])).rows;
    const sessions = (await db.query("SELECT * FROM session WHERE exam_id = $1 ORDER BY started_at", [e.id])).rows;
    const responses = (await db.query("SELECT r.* FROM response r JOIN session s ON s.id = r.session_id WHERE s.exam_id = $1 ORDER BY r.answered_at", [e.id])).rows;

    const domainKey = new Map(domains.map((d) => [d.id, d.key]));
    const objectiveCode = new Map(objectives.map((o) => [o.id, o.code]));
    const hashOf = new Map(questions.map((q) => [q.id, q.content_hash]));

    out.push({
      code: e.code, name: e.name, vendor: e.vendor, passMarkPct: e.pass_mark_pct == null ? null : Number(e.pass_mark_pct),
      passMarkNote: e.pass_mark_note, readinessTargetPct: e.readiness_target_pct, timeLimitMin: e.time_limit_min,
      questionCount: e.question_count, examDate: e.exam_date ? e.exam_date.toISOString().slice(0, 10) : null,
      profile: e.profile, sources: e.sources, archived: e.archived,
      domains: domains.map((d) => ({
        key: d.key, name: d.name, weightPct: Number(d.weight_pct), sortOrder: d.sort_order,
        objectives: objectives.filter((o) => o.domain_id === d.id).map((o) => ({ code: o.code, title: o.title, scope: o.scope, studyNotes: o.study_notes, sortOrder: o.sort_order })),
      })),
      questions: questions.map((q) => ({
        externalId: q.external_id, domainKey: domainKey.get(q.domain_id), objectiveCode: objectiveCode.get(q.objective_id),
        type: q.type, stem: q.stem, options: q.options, explanation: q.explanation, difficulty: q.difficulty, tags: q.tags,
        source: q.source, reviewStatus: q.review_status, rejectReason: q.reject_reason, generator: q.generator,
        generatedAt: q.generated_at ? q.generated_at.toISOString().slice(0, 10) : null,
        lastVerified: q.last_verified ? q.last_verified.toISOString().slice(0, 10) : null,
        refs: q.refs, needsAttention: q.needs_attention, contentHash: q.content_hash,
        marks: marks.filter((m) => m.question_id === q.id).map((m) => m.kind),
        note: notes.find((n) => n.question_id === q.id)?.body ?? null,
      })),
      sessions: sessions.map((s) => ({
        mode: s.mode, config: s.config, status: s.status, timeLimitSec: s.time_limit_sec,
        startedAt: iso(s.started_at), endedAt: s.ended_at ? iso(s.ended_at) : null,
        questionHashes: s.question_ids.map((id) => hashOf.get(id)).filter(Boolean),
        responses: responses.filter((r) => r.session_id === s.id && hashOf.has(r.question_id)).map((r) => ({
          questionHash: hashOf.get(r.question_id), selectedOptionIds: r.selected_option_ids, isCorrect: r.is_correct,
          timeMs: r.time_ms, flagged: r.flagged, answeredAt: iso(r.answered_at),
        })),
      })),
    });
  }
  return { formatVersion: EXPORT_VERSION, exportedAt: new Date().toISOString(), exams: out };
}

const optionSchema = z.object({ id: z.string(), text: z.string(), isCorrect: z.boolean(), rationale: z.string().nullable().optional() });
const questionSchema = z.object({
  externalId: z.string().nullable(), domainKey: z.string(), objectiveCode: z.string(), type: z.enum(["single", "multi", "tf"]),
  stem: z.string(), options: z.array(optionSchema).min(2).max(8), explanation: z.string().nullable(), difficulty: z.number().int().min(1).max(5).nullable(),
  tags: z.array(z.string()), source: z.enum(["own", "ai-draft", "licensed", "imported"]), reviewStatus: z.enum(["draft", "approved", "rejected"]),
  rejectReason: z.string().nullable(), generator: z.string().nullable(), generatedAt: z.string().nullable(), lastVerified: z.string().nullable(),
  refs: z.array(z.string()), needsAttention: z.boolean(), contentHash: z.string(), marks: z.array(z.enum(["flag", "bookmark"])), note: z.string().nullable(),
});
const sessionSchema = z.object({
  mode: z.enum(["practice", "mock"]), config: z.record(z.string(), z.unknown()), status: z.enum(["in-progress", "completed", "abandoned"]),
  timeLimitSec: z.number().int().nullable(), startedAt: z.string(), endedAt: z.string().nullable(), questionHashes: z.array(z.string()),
  responses: z.array(z.object({ questionHash: z.string(), selectedOptionIds: z.array(z.string()), isCorrect: z.boolean(), timeMs: z.number().int().nullable(), flagged: z.boolean(), answeredAt: z.string() })),
});
const examSchema = z.object({
  code: z.string().min(1), name: z.string().min(1), vendor: z.string().min(1), passMarkPct: z.number().nullable(), passMarkNote: z.string().nullable(),
  readinessTargetPct: z.number().int().min(1).max(100), timeLimitMin: z.number().int().nullable(), questionCount: z.number().int().nullable(),
  examDate: z.string().nullable(), profile: z.record(z.string(), z.unknown()), sources: z.array(z.unknown()), archived: z.boolean(),
  domains: z.array(z.object({
    key: z.string(), name: z.string(), weightPct: z.number(), sortOrder: z.number().int(),
    objectives: z.array(z.object({ code: z.string(), title: z.string(), scope: z.array(z.string()), studyNotes: z.string().nullable(), sortOrder: z.number().int() })),
  })),
  questions: z.array(questionSchema), sessions: z.array(sessionSchema),
});
export const exportSchema = z.object({ formatVersion: z.literal(EXPORT_VERSION), exportedAt: z.string(), exams: z.array(examSchema) });

/**
 * Replaces everything the user owns with the contents of an export file. Runs in the caller's transaction,
 * so a bad file leaves the existing data untouched.
 */
export async function importUserData(db, userId, json) {
  const data = exportSchema.parse(json);
  await db.query("DELETE FROM exam"); // RLS limits this to the caller; children cascade
  const counts = { exams: 0, questions: 0, sessions: 0, responses: 0 };

  for (const e of data.exams) {
    const exam = (await db.query(
      `INSERT INTO exam (user_id, code, name, vendor, pass_mark_pct, pass_mark_note, readiness_target_pct, time_limit_min,
         question_count, exam_date, profile, sources, archived)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [userId, e.code, e.name, e.vendor, e.passMarkPct, e.passMarkNote, e.readinessTargetPct, e.timeLimitMin, e.questionCount,
        e.examDate, JSON.stringify(e.profile), JSON.stringify(e.sources), e.archived],
    )).rows[0].id;
    counts.exams += 1;

    const domainId = new Map();
    const objectiveId = new Map();
    for (const d of e.domains) {
      const did = (await db.query(
        "INSERT INTO domain (user_id, exam_id, key, name, weight_pct, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
        [userId, exam, d.key, d.name, d.weightPct, d.sortOrder],
      )).rows[0].id;
      domainId.set(d.key, did);
      for (const o of d.objectives) {
        const oid = (await db.query(
          "INSERT INTO objective (user_id, exam_id, domain_id, code, title, scope, study_notes, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id",
          [userId, exam, did, o.code, o.title, JSON.stringify(o.scope), o.studyNotes, o.sortOrder],
        )).rows[0].id;
        objectiveId.set(o.code, oid);
      }
    }

    const questionId = new Map();
    for (const q of e.questions) {
      if (!domainId.has(q.domainKey) || !objectiveId.has(q.objectiveCode)) throw new Error(`Question refers to an unknown domain or objective (${q.domainKey} / ${q.objectiveCode}).`);
      const qid = (await db.query(
        `INSERT INTO question (user_id, exam_id, domain_id, objective_id, external_id, type, stem, options, explanation, difficulty,
           tags, source, review_status, reject_reason, generator, generated_at, last_verified, refs, needs_attention, content_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id`,
        [userId, exam, domainId.get(q.domainKey), objectiveId.get(q.objectiveCode), q.externalId, q.type, q.stem, JSON.stringify(q.options),
          q.explanation, q.difficulty, q.tags, q.source, q.reviewStatus, q.rejectReason, q.generator, q.generatedAt, q.lastVerified,
          JSON.stringify(q.refs), q.needsAttention, q.contentHash],
      )).rows[0].id;
      questionId.set(q.contentHash, qid);
      counts.questions += 1;
      for (const kind of q.marks) await db.query("INSERT INTO question_mark (user_id, question_id, kind) VALUES ($1,$2,$3)", [userId, qid, kind]);
      if (q.note) await db.query("INSERT INTO note (user_id, question_id, body) VALUES ($1,$2,$3)", [userId, qid, q.note]);
    }

    for (const s of e.sessions) {
      const ids = s.questionHashes.map((h) => questionId.get(h)).filter(Boolean);
      const sid = (await db.query(
        `INSERT INTO session (user_id, exam_id, mode, config, question_ids, status, time_limit_sec, started_at, ended_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [userId, exam, s.mode, JSON.stringify(s.config), JSON.stringify(ids), s.status, s.timeLimitSec, s.startedAt, s.endedAt],
      )).rows[0].id;
      counts.sessions += 1;
      for (const r of s.responses) {
        const qid = questionId.get(r.questionHash);
        if (!qid) continue;
        await db.query(
          `INSERT INTO response (user_id, session_id, question_id, selected_option_ids, is_correct, time_ms, flagged, answered_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (session_id, question_id) DO NOTHING`,
          [userId, sid, qid, JSON.stringify(r.selectedOptionIds), r.isCorrect, r.timeMs, r.flagged, r.answeredAt],
        );
        counts.responses += 1;
      }
    }
  }
  return counts;
}
