#!/usr/bin/env node
// Validates an exam pack blueprint. No dependencies (Node 18+).
// Usage: node scripts/validate-pack.mjs <path/to/blueprint.json> [--allow-template]
// Exit codes: 0 = valid, 1 = errors found, 2 = bad usage.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const allowTemplate = args.includes("--allow-template");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: node scripts/validate-pack.mjs <blueprint.json> [--allow-template]");
  process.exit(2);
}

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

let pack;
try {
  pack = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error(`FAIL ${file}: cannot read or parse JSON: ${e.message}`);
  process.exit(1);
}

const isStr = (v) => typeof v === "string" && v.trim() !== "";
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isDate = (v) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isUrl = (v) => isStr(v) && /^https:\/\/\S+$/.test(v);

// --- placeholders -----------------------------------------------------------
const todos = [];
(function scan(v, path) {
  if (typeof v === "string") {
    if (/TODO/.test(v)) todos.push(path);
  } else if (Array.isArray(v)) {
    v.forEach((x, i) => scan(x, `${path}[${i}]`));
  } else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) scan(x, `${path}.${k}`);
  }
})(pack, "$");
if (pack._template === true && !allowTemplate) {
  err("`_template` is true: this is the unfilled template (use --allow-template to check its structure only)");
}
if (todos.length && !allowTemplate) {
  err(`TODO placeholders remain at: ${todos.slice(0, 5).join(", ")}${todos.length > 5 ? ` (+${todos.length - 5} more)` : ""}`);
}

// --- top level --------------------------------------------------------------
if (pack.formatVersion !== 1) err("formatVersion must be 1");

if (!Array.isArray(pack.sources) || pack.sources.length === 0) {
  err("sources[] is required: record where every fact came from");
} else {
  pack.sources.forEach((s, i) => {
    if (!isStr(s?.title)) err(`sources[${i}].title is required`);
    if (!isUrl(s?.url)) err(`sources[${i}].url must be an https URL`);
    if (!isDate(s?.retrievedOn)) err(`sources[${i}].retrievedOn must be YYYY-MM-DD`);
    if (!isStr(s?.note)) err(`sources[${i}].note is required (what was taken, what was condensed)`);
  });
}

if (pack.version !== undefined) {
  const v = pack.version;
  if (!isStr(v?.current)) err("version.current is required when a version block is present");
  for (const k of ["registrationOpens", "supersededLastExamDay"]) {
    if (v?.[k] !== undefined && !isDate(v[k])) err(`version.${k} must be YYYY-MM-DD`);
  }
}

if (!Array.isArray(pack.questions)) err("questions[] must exist (it may be empty)");

// --- exam -------------------------------------------------------------------
const exam = pack.exam;
if (!exam || typeof exam !== "object") {
  err("exam block is required");
} else {
  for (const k of ["code", "name", "vendor"]) if (!isStr(exam[k])) err(`exam.${k} is required`);
  const pct = (k, required) => {
    if (exam[k] === undefined) return required && err(`exam.${k} is required`);
    if (!isNum(exam[k]) || exam[k] < 1 || exam[k] > 100) err(`exam.${k} must be a number from 1 to 100`);
  };
  pct("passMarkPct", true);
  pct("readinessTargetPct", true);
  for (const k of ["timeLimitMin", "questionCount"]) {
    if (!isNum(exam[k]) || exam[k] <= 0) err(`exam.${k} must be a positive number`);
  }
  if (exam.scoredQuestionCount !== undefined || exam.unscoredQuestionCount !== undefined) {
    const total = (exam.scoredQuestionCount ?? 0) + (exam.unscoredQuestionCount ?? 0);
    if (total !== exam.questionCount) {
      err(`scoredQuestionCount + unscoredQuestionCount (${total}) must equal questionCount (${exam.questionCount})`);
    }
  }
  if (exam.scaledPassScore !== undefined) {
    const r = exam.scaleRange;
    if (!Array.isArray(r) || r.length !== 2 || !(r[0] <= exam.scaledPassScore && exam.scaledPassScore <= r[1])) {
      err("scaledPassScore must lie within scaleRange [min, max]");
    }
    if (!isStr(exam.passMarkNote)) {
      err("passMarkNote is required when scaledPassScore is set: explain that passMarkPct is only a proxy");
    }
  }
  const qt = exam.questionTypes;
  if (!qt || typeof qt !== "object" || Object.keys(qt).length === 0) {
    err("exam.questionTypes must list the exam's question types (single, multi, tf)");
  } else {
    for (const k of Object.keys(qt)) {
      if (!["single", "multi", "tf"].includes(k)) {
        err(`exam.questionTypes.${k} is not a supported type yet (supported: single, multi, tf); see docs/08 for unsupported-type triage`);
      }
    }
  }

  // --- domains and objectives -------------------------------------------------
  const domains = exam.domains;
  if (!Array.isArray(domains) || domains.length === 0) {
    err("exam.domains[] is required");
  } else {
    const keys = new Set();
    const codes = new Set();
    let sum = 0;
    let objectiveCount = 0;
    domains.forEach((d, i) => {
      const at = `domains[${i}]`;
      if (!isStr(d?.key) || !/^[a-z0-9-]+$/.test(d.key)) err(`${at}.key must be lowercase letters, digits or dashes`);
      else if (keys.has(d.key)) err(`${at}.key "${d.key}" is duplicated`);
      else keys.add(d.key);
      if (!isStr(d?.name)) err(`${at}.name is required`);
      if (!isNum(d?.weightPct) || d.weightPct <= 0) err(`${at}.weightPct must be a positive number`);
      else sum += d.weightPct;
      if (!Array.isArray(d?.objectives) || d.objectives.length === 0) {
        err(`${at}.objectives[] is required`);
        return;
      }
      d.objectives.forEach((o, j) => {
        const oat = `${at}.objectives[${j}]`;
        objectiveCount += 1;
        if (!isStr(o?.code)) err(`${oat}.code is required`);
        else if (codes.has(o.code)) err(`${oat}.code "${o.code}" is duplicated`);
        else codes.add(o.code);
        if (!isStr(o?.title)) err(`${oat}.title is required`);
        if (!Array.isArray(o?.scope) || o.scope.length === 0 || !o.scope.every(isStr)) {
          err(`${oat}.scope must be a non-empty list of strings (condensed vendor bullets)`);
        }
      });
    });
    if (Math.abs(sum - 100) > 1e-9) err(`domain weights sum to ${sum}, expected 100`);
    pack._summary = { domains: domains.length, objectives: objectiveCount, weightSum: sum };
  }
}

// --- report -----------------------------------------------------------------
const label = pack.exam?.code ?? file;
for (const w of warnings) console.log(`warn  ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error ${e}`);
  console.error(`FAIL ${label}: ${errors.length} error(s)`);
  process.exit(1);
}
const s = pack._summary;
console.log(`PASS ${label}${s ? `: ${s.domains} domains, ${s.objectives} objectives, weights sum ${s.weightSum}` : ""}${allowTemplate ? " (template structure only)" : ""}`);
