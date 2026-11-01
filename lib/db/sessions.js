import { scoreAnswer, summarizeScore } from "../domain/scoring.js";
import { questionRow } from "./questions.js";

/** Session and response data access (see exams.js for the conventions). */

const sessionRow = (r) => ({
  id: r.id,
  examId: r.exam_id,
  mode: r.mode,
  config: r.config,
  questionIds: r.question_ids,
  status: r.status,
  timeLimitSec: r.time_limit_sec,
  startedAt: r.started_at,
  endedAt: r.ended_at,
});

const DEADLINE_GRACE_MS = 5000;

/** Mock exams have a hard deadline (server clock); a few seconds of grace cover network delay. */
export function isPastDeadline(session, now = Date.now()) {
  if (session.mode !== "mock" || !session.timeLimitSec) return false;
  return (
    now > new Date(session.startedAt).getTime() + session.timeLimitSec * 1000 + DEADLINE_GRACE_MS
  );
}

/** True once the mock's time has run out (no grace); used to close an exam the learner walked away from. */
export function hasExpired(session, now = Date.now()) {
  if (session.mode !== "mock" || !session.timeLimitSec) return false;
  return now > new Date(session.startedAt).getTime() + session.timeLimitSec * 1000;
}

export async function getOpenSession(db, examId) {
  const { rows } = await db.query(
    "SELECT * FROM session WHERE exam_id = $1 AND status = 'in-progress'",
    [examId],
  );
  return rows[0] ? sessionRow(rows[0]) : null;
}

/** Creates a session. Fails if the exam already has an open one (one open session per exam). */
export async function createSession(
  db,
  userId,
  { examId, mode, config = {}, questionIds, timeLimitSec = null },
) {
  if (questionIds.length === 0) throw new Error("A session needs at least one question.");
  if (await getOpenSession(db, examId))
    throw new Error("Finish or abandon your open session first.");
  const { rows } = await db.query(
    `INSERT INTO session (user_id, exam_id, mode, config, question_ids, time_limit_sec)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [userId, examId, mode, JSON.stringify(config), JSON.stringify(questionIds), timeLimitSec],
  );
  return sessionRow(rows[0]);
}

export async function getSession(db, id) {
  const { rows } = await db.query("SELECT * FROM session WHERE id = $1", [id]);
  return rows[0] ? sessionRow(rows[0]) : null;
}

export async function getResponses(db, sessionId) {
  const { rows } = await db.query(
    "SELECT * FROM response WHERE session_id = $1 ORDER BY answered_at",
    [sessionId],
  );
  return rows.map((r) => ({
    questionId: r.question_id,
    selectedOptionIds: r.selected_option_ids,
    isCorrect: r.is_correct,
    timeMs: r.time_ms,
    flagged: r.flagged,
    answeredAt: r.answered_at,
  }));
}

/**
 * Scores and stores one answer. Practice: the first answer to a question sticks (feedback is shown right away).
 * Mock: the answer can be changed until the session is submitted.
 * @returns {Promise<{ isCorrect: boolean, accepted: boolean }>}
 */
export async function recordResponse(
  db,
  userId,
  sessionId,
  questionId,
  selectedOptionIds,
  timeMs = null,
) {
  const session = await getSession(db, sessionId);
  if (!session || session.status !== "in-progress") throw new Error("This session is not open.");
  if (isPastDeadline(session)) throw new Error("Time is up for this exam.");
  if (!session.questionIds.includes(questionId))
    throw new Error("That question is not part of this session.");

  const q = (await db.query("SELECT * FROM question WHERE id = $1", [questionId])).rows[0];
  if (!q) throw new Error("Question not found.");
  const validIds = new Set(q.options.map((o) => o.id));
  if (!selectedOptionIds.every((id) => validIds.has(id)))
    throw new Error("Unknown option selected.");

  const { isCorrect } = scoreAnswer(questionRow(q), selectedOptionIds);
  const conflict =
    session.mode === "mock"
      ? `DO UPDATE SET selected_option_ids = EXCLUDED.selected_option_ids, is_correct = EXCLUDED.is_correct,
           time_ms = EXCLUDED.time_ms, answered_at = now()`
      : "DO NOTHING";
  const res = await db.query(
    `INSERT INTO response (user_id, session_id, question_id, selected_option_ids, is_correct, time_ms)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (session_id, question_id) ${conflict}`,
    [userId, sessionId, questionId, JSON.stringify(selectedOptionIds), isCorrect, timeMs],
  );
  return { isCorrect, accepted: res.rowCount > 0 };
}

export async function finishSession(db, sessionId, status = "completed") {
  await db.query(
    "UPDATE session SET status = $2, ended_at = now() WHERE id = $1 AND status = 'in-progress'",
    [sessionId, status],
  );
}

/** Score for a session; unanswered questions count as incorrect. */
export async function sessionScore(db, session, exam) {
  const responses = await getResponses(db, session.id);
  const byQ = new Map(responses.map((r) => [r.questionId, r]));
  const answers = session.questionIds.map((id) => ({ isCorrect: byQ.get(id)?.isCorrect ?? false }));
  return summarizeScore(answers, {
    passMarkPct: exam.passMarkPct,
    readinessTargetPct: exam.readinessTargetPct,
  });
}

export async function listSessions(db, examId, limit = 50) {
  const { rows } = await db.query(
    `SELECT s.*, (SELECT count(*)::int FROM response r WHERE r.session_id = s.id) AS answered,
            (SELECT count(*)::int FROM response r WHERE r.session_id = s.id AND r.is_correct) AS correct
       FROM session s WHERE s.exam_id = $1 ORDER BY s.started_at DESC LIMIT $2`,
    [examId, limit],
  );
  return rows.map((r) => ({
    ...sessionRow(r),
    total: r.question_ids.length,
    answered: r.answered,
    correct: r.correct,
  }));
}

/** Every response to a pool question, for the progress model. */
export async function attemptsForExam(db, examId) {
  const { rows } = await db.query(
    `SELECT r.question_id, r.is_correct, r.answered_at FROM response r
       JOIN question q ON q.id = r.question_id WHERE q.exam_id = $1`,
    [examId],
  );
  return rows.map((r) => ({
    questionId: r.question_id,
    isCorrect: r.is_correct,
    answeredAt: r.answered_at,
  }));
}

/** Per-question history, used to pick missed / unseen questions. */
export async function questionHistory(db, examId) {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (r.question_id) r.question_id, r.is_correct, r.answered_at,
            count(*) OVER (PARTITION BY r.question_id)::int AS attempts
       FROM response r JOIN question q ON q.id = r.question_id
      WHERE q.exam_id = $1 ORDER BY r.question_id, r.answered_at DESC`,
    [examId],
  );
  return new Map(
    rows.map((r) => [
      r.question_id,
      {
        attempts: r.attempts,
        lastResult: r.is_correct,
        lastSeenAt: new Date(r.answered_at).getTime(),
      },
    ]),
  );
}

/** Daily activity for the last `days` days: answers per calendar day in time zone `tz` (so evenings are not tomorrow). */
export async function activityByDay(db, examId, days = 14, tz = "UTC") {
  const { rows } = await db.query(
    `SELECT to_char(date_trunc('day', r.answered_at AT TIME ZONE $3), 'YYYY-MM-DD') AS day, count(*)::int AS n
       FROM response r JOIN question q ON q.id = r.question_id
      WHERE q.exam_id = $1 AND r.answered_at >= now() - ($2 || ' days')::interval
      GROUP BY 1 ORDER BY 1`,
    [examId, String(days), tz],
  );
  return rows;
}

/** Removes a mock answer (the learner cleared their selection), so it counts as unanswered. */
export async function clearResponse(db, sessionId, questionId) {
  const session = await getSession(db, sessionId);
  if (!session || session.status !== "in-progress" || session.mode !== "mock")
    throw new Error("This session is not open.");
  await db.query("DELETE FROM response WHERE session_id = $1 AND question_id = $2", [
    sessionId,
    questionId,
  ]);
}

/** Completed mock exams, oldest first, with their raw score. */
export async function mockHistory(db, examId) {
  const { rows } = await db.query(
    `SELECT s.id, s.started_at, jsonb_array_length(s.question_ids) AS total,
            (SELECT count(*)::int FROM response r WHERE r.session_id = s.id AND r.is_correct) AS correct
       FROM session s WHERE s.exam_id = $1 AND s.mode = 'mock' AND s.status = 'completed' ORDER BY s.started_at`,
    [examId],
  );
  return rows.map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    total: r.total,
    correct: r.correct,
    pct: r.total ? (r.correct / r.total) * 100 : 0,
  }));
}
