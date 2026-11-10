import { describe, expect, it } from "vitest";
import { scoreAnswer, summarizeScore } from "./scoring.js";
import { computeProgress, STATUS } from "./progress.js";
import { selectQuestions } from "./selection.js";
import { allocateByWeight, stratifiedSample } from "./sampling.js";
import { makeRng } from "./rng.js";
import { median, movingAverage, scoreAxis, timeDistribution, weekStarts, weeklyAccuracy } from "./trend.js";
import { buildCoverage, coverageTargets, stageFor } from "./coverage.js";
import { fmtDuration, isSlow, timeStats } from "./timing.js";

const opt = (id, isCorrect) => ({ id, text: id, isCorrect });

describe("scoreAnswer", () => {
  const single = {
    type: "single",
    options: [opt("a", true), opt("b", false), opt("c", false), opt("d", false)],
  };
  const multi = {
    type: "multi",
    options: [opt("a", true), opt("b", true), opt("c", false), opt("d", false), opt("e", false)],
  };

  it("single: only the correct option counts", () => {
    expect(scoreAnswer(single, ["a"])).toEqual({ isCorrect: true, score: 1 });
    expect(scoreAnswer(single, ["b"])).toEqual({ isCorrect: false, score: 0 });
    expect(scoreAnswer(single, ["a", "b"]).isCorrect).toBe(false);
  });

  it("unanswered is incorrect", () => {
    expect(scoreAnswer(single, []).isCorrect).toBe(false);
  });

  it("multi: all-or-nothing by default", () => {
    expect(scoreAnswer(multi, ["a", "b"]).isCorrect).toBe(true);
    expect(scoreAnswer(multi, ["a"])).toEqual({ isCorrect: false, score: 0 });
    expect(scoreAnswer(multi, ["a", "b", "c"]).isCorrect).toBe(false);
  });

  it("multi: optional partial credit = (correct - wrong) / correct count, floored at 0", () => {
    expect(scoreAnswer(multi, ["a"], { partialCredit: true }).score).toBe(0.5);
    expect(scoreAnswer(multi, ["a", "c"], { partialCredit: true }).score).toBe(0);
    expect(scoreAnswer(multi, ["c", "d"], { partialCredit: true }).score).toBe(0);
    expect(scoreAnswer(multi, ["a", "b", "c"], { partialCredit: true }).score).toBe(0.5);
  });
});

describe("summarizeScore", () => {
  it("compares raw percent with the pass-mark proxy and readiness target", () => {
    const answers = [true, true, true, false].map((isCorrect) => ({ isCorrect }));
    const s = summarizeScore(answers, { passMarkPct: 70, readinessTargetPct: 80 });
    expect(s).toMatchObject({
      total: 4,
      correct: 3,
      pct: 75,
      meetsPassMarkProxy: true,
      meetsReadinessTarget: false,
    });
  });
  it("handles an empty session", () => {
    expect(summarizeScore([]).pct).toBe(0);
  });
});

// Hand-computed fixture (the most important test in the project).
//   Target 80. D1 weight 60 {O1, O2}, D2 weight 40 {O3, O4}.
//   Pool: O1 = q1-q5, O2 = q6-q8, O3 = q9-q18, O4 = none. qd is a draft (not in the pool).
//   O1: q1 attempts F,T,T,T (latest 3 = T,T,T), q2..q4 T, q5 F  -> correct 6 / attempts 7 = 85.71%, coverage 100%, sample 5 => On target
//   O2: q6 T only -> sample 1, coverage 1/3 => In progress
//   O3: q9..q18 once each, 7 correct -> 70%, coverage 100%, sample 10 => Needs work
//   O4: no questions
//   D1: pool 8, sample 6, coverage .75, accuracy 7/8 = 87.5% => In progress (coverage < 80%)
//   D2: pool 10, sample 10, accuracy 70% => Needs work
const domains = [
  { id: "D1", weightPct: 60 },
  { id: "D2", weightPct: 40 },
];
const objectives = [
  { id: "O1", domainId: "D1" },
  { id: "O2", domainId: "D1" },
  { id: "O3", domainId: "D2" },
  { id: "O4", domainId: "D2" },
];
const q = (id, objectiveId, domainId) => ({ id, objectiveId, domainId });
const pool = [
  ...["q1", "q2", "q3", "q4", "q5"].map((id) => q(id, "O1", "D1")),
  ...["q6", "q7", "q8"].map((id) => q(id, "O2", "D1")),
  ...Array.from({ length: 10 }, (_, i) => q(`q${9 + i}`, "O3", "D2")),
];
const at = (questionId, isCorrect, day) => ({
  questionId,
  isCorrect,
  answeredAt: `2026-10-${String(day).padStart(2, "0")}T10:00:00Z`,
});
const attempts = [
  at("q1", false, 1),
  at("q1", true, 2),
  at("q1", true, 3),
  at("q1", true, 4),
  at("q2", true, 5),
  at("q3", true, 5),
  at("q4", true, 5),
  at("q5", false, 5),
  at("q6", true, 6),
  ...Array.from({ length: 10 }, (_, i) => at(`q${9 + i}`, i < 7, 7)),
  at("qd", false, 8), // draft: not in the pool, must be ignored
];

describe("computeProgress", () => {
  const result = computeProgress({ targetPct: 80, domains, objectives, pool, attempts });
  const obj = (id) => result.objectives.find((o) => o.objectiveId === id);
  const dom = (id) => result.domains.find((d) => d.domainId === id);

  it("computes objective stats and statuses", () => {
    expect(obj("O1")).toMatchObject({
      poolSize: 5,
      sample: 5,
      coverage: 1,
      status: STATUS.ON_TARGET,
    });
    expect(obj("O1").accuracy).toBeCloseTo(85.714, 2);
    expect(obj("O2")).toMatchObject({ poolSize: 3, sample: 1, status: STATUS.IN_PROGRESS });
    expect(obj("O2").coverage).toBeCloseTo(1 / 3, 5);
    expect(obj("O3")).toMatchObject({
      poolSize: 10,
      sample: 10,
      accuracy: 70,
      status: STATUS.NEEDS_WORK,
    });
    expect(obj("O4")).toMatchObject({ poolSize: 0, accuracy: null, status: STATUS.NO_QUESTIONS });
  });

  it("only the latest 3 attempts per question count", () => {
    // If all 4 of q1's attempts counted, O1 would be 6/8 = 75% (Needs work).
    expect(obj("O1").status).toBe(STATUS.ON_TARGET);
  });

  it("rolls up to domains with the same rules", () => {
    expect(dom("D1")).toMatchObject({
      poolSize: 8,
      sample: 6,
      accuracy: 87.5,
      status: STATUS.IN_PROGRESS,
    });
    expect(dom("D1").coverage).toBe(0.75);
    expect(dom("D2")).toMatchObject({
      poolSize: 10,
      sample: 10,
      accuracy: 70,
      status: STATUS.NEEDS_WORK,
    });
  });

  it("lists what's left by domain weight x gap, excluding on-target objectives", () => {
    expect(result.whatsLeft.map((o) => [o.objectiveId, o.priority])).toEqual([
      ["O4", 40 * 80], // no data counts as 0% accuracy
      ["O3", 40 * 10],
      ["O2", 0], // 100% accuracy so far, but not enough coverage yet
    ]);
  });

  it("withholds readiness until every domain has enough attempted questions", () => {
    expect(result.readiness).toMatchObject({ available: false, scorePct: null, meetsTarget: null });
    expect(result.readiness.missing).toEqual([{ domainId: "D1", sample: 6, needed: 10 }]);
  });

  it("computes readiness as weighted domain accuracy when the sample is large enough", () => {
    const r = computeProgress({
      targetPct: 80,
      domains,
      objectives,
      pool,
      attempts,
      thresholds: { minDomainSampleForReadiness: 6 },
    }).readiness;
    // (60 x 87.5 + 40 x 70) / 100 = 80.5
    expect(r.available).toBe(true);
    expect(r.scorePct).toBeCloseTo(80.5, 5);
    expect(r.meetsTarget).toBe(true);
  });

  it("an empty exam is all 'no questions' and has no readiness", () => {
    const empty = computeProgress({ targetPct: 80, domains, objectives, pool: [], attempts: [] });
    expect(empty.objectives.every((o) => o.status === STATUS.NO_QUESTIONS)).toBe(true);
    expect(empty.readiness.available).toBe(false);
  });
});

describe("selectQuestions", () => {
  const rng = () => makeRng(42);
  const history = new Map([
    ["q1", { attempts: 2, lastResult: false, lastSeenAt: 1 }],
    ["q2", { attempts: 1, lastResult: true, lastSeenAt: 2 }],
  ]);

  it("scopes by objective and domain", () => {
    expect(
      selectQuestions({
        pool,
        scope: { type: "objective", id: "O2" },
        count: 10,
        rng: rng(),
      }).sort(),
    ).toEqual(["q6", "q7", "q8"]);
    expect(
      selectQuestions({ pool, scope: { type: "domain", id: "D2" }, count: 100, rng: rng() }),
    ).toHaveLength(10);
  });

  it("scopes to missed, unseen and flagged", () => {
    expect(
      selectQuestions({ pool, scope: { type: "missed" }, count: 10, history, rng: rng() }),
    ).toEqual(["q1"]);
    const unseen = selectQuestions({
      pool,
      scope: { type: "unseen" },
      count: 100,
      history,
      rng: rng(),
    });
    expect(unseen).toHaveLength(pool.length - 2);
    expect(unseen).not.toContain("q1");
    expect(
      selectQuestions({
        pool,
        scope: { type: "flagged" },
        count: 5,
        flaggedIds: new Set(["q3", "q9"]),
        rng: rng(),
      }).sort(),
    ).toEqual(["q3", "q9"]);
  });

  it("respects count and is deterministic for a seeded rng", () => {
    const a = selectQuestions({ pool, scope: { type: "exam" }, count: 5, rng: rng() });
    const b = selectQuestions({ pool, scope: { type: "exam" }, count: 5, rng: rng() });
    expect(a).toHaveLength(5);
    expect(a).toEqual(b);
  });

  it("missed-first puts missed before unseen before answered-correctly", () => {
    const ids = selectQuestions({
      pool,
      scope: { type: "exam" },
      count: 100,
      order: "missed-first",
      history,
      rng: rng(),
    });
    expect(ids[0]).toBe("q1");
    expect(ids[ids.length - 1]).toBe("q2");
  });

  it("unseen-first puts unseen questions ahead", () => {
    const ids = selectQuestions({
      pool,
      scope: { type: "exam" },
      count: 100,
      order: "unseen-first",
      history,
      rng: rng(),
    });
    expect(ids.slice(-2).sort()).toEqual(["q1", "q2"]);
  });
});

describe("allocateByWeight", () => {
  it("uses largest remainder so the total is exact (CLF-C02: 65 across 24/30/34/12)", () => {
    // exact 15.6, 19.5, 22.1, 7.8 -> floors 15, 19, 22, 7 (= 63); +1 to .8 and .6 => 16, 19, 22, 8
    const a = allocateByWeight(65, [
      { id: "d1", weightPct: 24 },
      { id: "d2", weightPct: 30 },
      { id: "d3", weightPct: 34 },
      { id: "d4", weightPct: 12 },
    ]);
    expect([...a.values()]).toEqual([16, 19, 22, 8]);
    expect([...a.values()].reduce((s, n) => s + n, 0)).toBe(65);
  });
});

describe("stratifiedSample", () => {
  const dm = [
    { id: "A", weightPct: 50 },
    { id: "B", weightPct: 50 },
  ];
  const mk = (d, n) => Array.from({ length: n }, (_, i) => ({ id: `${d}${i}`, domainId: d }));

  it("takes questions per domain by weight with no repeats", () => {
    const r = stratifiedSample({
      total: 10,
      domains: dm,
      pool: [...mk("A", 20), ...mk("B", 20)],
      rng: makeRng(1),
    });
    expect(r.questionIds).toHaveLength(10);
    expect(new Set(r.questionIds).size).toBe(10);
    expect(r.questionIds.filter((id) => id.startsWith("A"))).toHaveLength(5);
    expect(r.warnings).toEqual([]);
  });

  it("redistributes the shortfall and warns when a domain pool is short", () => {
    const r = stratifiedSample({
      total: 10,
      domains: dm,
      pool: [...mk("A", 3), ...mk("B", 20)],
      rng: makeRng(1),
    });
    expect(r.questionIds).toHaveLength(10);
    expect(r.questionIds.filter((id) => id.startsWith("A"))).toHaveLength(3);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("prefers least-recently-seen questions", () => {
    const lastSeenAt = new Map(mk("A", 10).map((x, i) => [x.id, 100 + i]));
    const r = stratifiedSample({
      total: 4,
      domains: [{ id: "A", weightPct: 100 }],
      pool: mk("A", 10),
      lastSeenAt,
      rng: makeRng(3),
    });
    expect(r.questionIds.sort()).toEqual(["A0", "A1", "A2", "A3"]);
  });

  it("returns fewer than requested, with a warning, when the whole pool is too small", () => {
    const r = stratifiedSample({
      total: 10,
      domains: dm,
      pool: [...mk("A", 2), ...mk("B", 3)],
      rng: makeRng(1),
    });
    expect(r.questionIds).toHaveLength(5);
    expect(r.warnings.some((w) => /short of 10/.test(w))).toBe(true);
  });
});

describe("movingAverage", () => {
  it("is defined from the first point and only looks backwards", () => {
    expect(movingAverage([60, 80, 100, 40], 3)).toEqual([60, 70, 80, (80 + 100 + 40) / 3]);
  });
  it("a window of 1 returns the values", () => {
    expect(movingAverage([10, 20], 1)).toEqual([10, 20]);
    expect(movingAverage([], 3)).toEqual([]);
  });
});

describe("scoreAxis", () => {
  it("tops out at 100 and starts below the lowest score", () => {
    expect(scoreAxis([72, 85, 90])).toEqual({ lo: 60, hi: 100 });
    expect(scoreAxis([95, 100])).toEqual({ lo: 60, hi: 100 });
  });
  it("shows the full range when scores are low", () => {
    expect(scoreAxis([12, 40])).toEqual({ lo: 0, hi: 100 });
    expect(scoreAxis([])).toEqual({ lo: 0, hi: 100 });
  });
});

describe("coverage", () => {
  const domains = [
    { id: "d1", weightPct: 24, objectiveIds: ["a", "b", "c", "d"] },
    { id: "d2", weightPct: 30, objectiveIds: ["e", "f", "g", "h"] },
    { id: "d3", weightPct: 34, objectiveIds: ["i", "j", "k", "l", "m", "n", "o", "p"] },
    { id: "d4", weightPct: 12, objectiveIds: ["q", "r", "s"] },
  ];

  it("targets four exams' worth of questions, split by weight, summing exactly", () => {
    const t = coverageTargets(domains, 65);
    const sum = (ids) => ids.reduce((n, id) => n + t.get(id), 0);
    expect([...t.values()].reduce((a, b) => a + b, 0)).toBe(260);
    // 24/30/34/12 of 260 is 62.4/78/88.4/31.2: one leftover seat goes to a domain tied on remainder.
    expect([62, 63]).toContain(sum(domains[0].objectiveIds));
    expect(sum(domains[1].objectiveIds)).toBe(78);
    expect([88, 89]).toContain(sum(domains[2].objectiveIds));
    expect(sum(domains[3].objectiveIds)).toBe(31);
  });

  it("splits a domain's share across objectives, extras to the earlier ones", () => {
    const t = coverageTargets(domains, 65);
    expect(["q", "r", "s"].map((id) => t.get(id))).toEqual([11, 10, 10]);
  });

  it("stages: needs, practice, full", () => {
    expect(stageFor(0, 15)).toBe("needs");
    expect(stageFor(9, 15)).toBe("needs");
    expect(stageFor(10, 15)).toBe("practice");
    expect(stageFor(15, 15)).toBe("full");
  });

  it("buildCoverage counts per objective and reports mock readiness", () => {
    const exam = {
      questionCount: 10,
      domains: [
        {
          id: "d1",
          name: "One",
          weightPct: 100,
          objectives: [
            { id: "a", code: "1.1", title: "A" },
            { id: "b", code: "1.2", title: "B" },
          ],
        },
      ],
    };
    const c = buildCoverage(exam, [
      { objectiveId: "a", reviewStatus: "approved", n: 12 },
      { objectiveId: "a", reviewStatus: "draft", n: 3 },
      { objectiveId: "b", reviewStatus: "approved", n: 9 },
    ]);
    expect(c.target).toBe(40);
    expect(c.approved).toBe(21);
    expect(c.draft).toBe(3);
    expect(c.practiceReady).toBe(1);
    expect(c.mockReady).toBe(true);
    expect(c.domains[0].objectives[0]).toMatchObject({
      approved: 12,
      draft: 3,
      target: 20,
      stage: "practice",
    });
  });
});

describe("timeStats", () => {
  it("averages measured times and ignores missing ones", () => {
    const s = timeStats([20_000, null, 40_000, 60_000, undefined]);
    expect(s).toMatchObject({ count: 3, totalMs: 120_000, avgMs: 40_000, medianMs: 40_000, maxMs: 60_000 });
    expect(s.slowThresholdMs).toBe(60_000);
    expect(isSlow(60_000, s)).toBe(true);
    expect(isSlow(59_999, s)).toBe(false);
  });

  it("never calls a question under 30 seconds slow", () => {
    const s = timeStats([4_000, 5_000, 6_000, 20_000]);
    expect(s.medianMs).toBe(5_500);
    expect(s.slowThresholdMs).toBe(30_000);
    expect(isSlow(20_000, s)).toBe(false);
  });

  it("is null with nothing measured", () => {
    expect(timeStats([null, 0])).toBeNull();
    expect(isSlow(90_000, null)).toBe(false);
  });

  it("formats durations", () => {
    expect(fmtDuration(9_000)).toBe("0:09");
    expect(fmtDuration(75_000)).toBe("1:15");
    expect(fmtDuration(3_725_000)).toBe("1:02:05");
  });
});

describe("weekly trends", () => {
  it("lists the Mondays of the last n weeks, oldest first", () => {
    // 2026-11-09 is a Monday; 2026-11-15 is the Sunday of the same week.
    expect(weekStarts("2026-11-09", 3)).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(weekStarts("2026-11-15", 2)).toEqual(["2026-11-02", "2026-11-09"]);
    expect(weekStarts("2026-01-01", 2)).toEqual(["2025-12-22", "2025-12-29"]);
  });

  it("gives one cell per week per group, with null for an empty week", () => {
    const weeks = ["2026-10-26", "2026-11-02", "2026-11-09"];
    const rows = [
      { week: "2026-10-26", g: "a", isCorrect: true },
      { week: "2026-10-26", g: "a", isCorrect: false },
      { week: "2026-11-09", g: "a", isCorrect: true },
      { week: "2026-11-09", g: "b", isCorrect: false },
      { week: "2025-01-06", g: "b", isCorrect: true }, // outside the window: ignored
    ];
    const by = weeklyAccuracy(rows, weeks, (r) => r.g);
    expect(by.get("a").map((c) => c.pct)).toEqual([50, null, 100]);
    expect(by.get("b").map((c) => c.n)).toEqual([0, 0, 1]);
  });

  it("buckets answer times and skips unmeasured ones", () => {
    const d = timeDistribution([5_000, 30_000, 59_999, 61_000, 200_000, null, 0]);
    expect(d.map((b) => b.n)).toEqual([1, 2, 1, 0, 0, 1]);
    expect(d.at(-1).toSec).toBeNull();
    expect(median([null, 3, 1, 2, 0])).toBe(2);
    expect(median([])).toBeNull();
  });
});

describe("content security policy", async () => {
  const { buildCsp, makeNonce } = await import("../app/csp.js");
  it("allows scripts only with the nonce in production, and same-origin everything else", () => {
    const nonce = makeNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    const csp = buildCsp(nonce);
    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    expect(csp).not.toMatch(/unsafe-eval|ws:/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) expect(csp).toContain(d);
    expect(buildCsp(nonce, { dev: true })).toMatch(/'unsafe-eval'.*connect-src 'self' ws: wss:/);
  });
});

describe("course order", async () => {
  const { byCourseState, courseState } = await import("../app/view.js");
  it("puts studying courses first and passed or finished ones last", () => {
    const rows = [
      { code: "A", state: courseState({ outcome: "passed" }, false) },
      { code: "B", state: courseState(null, false) },
      { code: "C", state: courseState({ outcome: null }, false) },
      { code: "D", state: courseState(null, true) },
      { code: "E", state: courseState({ outcome: "finished" }, false) },
    ];
    expect(rows.map((r) => r.state)).toEqual(["completed", "new", "studying", "paused", "completed"]);
    expect([...rows].sort(byCourseState).map((r) => r.code)).toEqual(["C", "D", "B", "A", "E"]);
  });
});
