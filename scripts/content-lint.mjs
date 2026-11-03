// Checks question files before they are imported: `npm run content:lint [-- paths...] [--strict]`.
// With no paths it checks content/*/questions/**/*.json (drafts) and content/*/bank/**/*.json (the shared,
// approved bank) against each pack's blueprint. Exits 1 on errors
// (and, with --strict, on warnings too).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { validateImport } from "../lib/content/validate-questions.js";
import { lintBatch } from "../lib/content/lint-batch.js";

const ROOT = resolve("content");
const args = process.argv.slice(2);
const strict = args.includes("--strict");
const targets = args.filter((a) => !a.startsWith("--"));

/** Question batches only: not the blind copies or answer files the verification pass writes beside them. */
const isBatch = (f) => f.endsWith(".json") && !/\.(blind|answers)\.json$/.test(f);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : isBatch(e.name) ? [p] : [];
  });
}

function collectFiles() {
  if (targets.length > 0)
    return targets.flatMap((t) => (statSync(t).isDirectory() ? walk(t) : [resolve(t)]));
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => ["questions", "bank"].map((sub) => join(ROOT, d.name, sub)))
    .filter((dir) => existsSync(dir))
    .flatMap(walk);
}

/** content/<pack>/bank/... */
const inBank = (file) => relative(ROOT, file).split(sep)[1] === "bank";

/** content/<pack>/questions/... -> content/<pack> */
function packDirOf(file) {
  const parts = relative(ROOT, file).split(sep);
  if (parts[0] === ".." || parts.length < 2)
    throw new Error(`${file} is not inside content/<pack>/`);
  return join(ROOT, parts[0]);
}

const files = collectFiles();
if (files.length === 0) {
  console.log("No question files found (looked for content/*/questions/ and content/*/bank/).");
  process.exit(0);
}

let errorCount = 0;
let warningCount = 0;
const byPack = new Map();
for (const f of files) {
  const dir = packDirOf(f);
  byPack.set(dir, [...(byPack.get(dir) ?? []), f]);
}

for (const [dir, packFiles] of byPack) {
  const blueprint = JSON.parse(readFileSync(join(dir, "blueprint.json"), "utf8"));
  const exam = blueprint.exam;
  const code = exam.code;
  const shown = (f) => relative(process.cwd(), f).split(sep).join("/");

  // One pass over the whole pack so duplicate checks see every file, then results are split back per file.
  const all = [];
  const fatal = [];
  for (const f of packFiles) {
    let json;
    try {
      json = JSON.parse(readFileSync(f, "utf8"));
    } catch (e) {
      fatal.push(`${shown(f)}: not valid JSON (${e.message})`);
      continue;
    }
    if (!Array.isArray(json?.questions)) {
      fatal.push(`${shown(f)}: expected { "formatVersion": 1, "questions": [...] }`);
      continue;
    }
    json.questions.forEach((q, i) => all.push({ file: f, index: i, raw: q }));
  }
  for (const m of fatal) {
    console.log(`ERROR ${m}`);
    errorCount += 1;
  }

  const result = validateImport(
    { formatVersion: 1, questions: all.map((a) => a.raw) },
    { domains: exam.domains, profile: exam.profile },
  );
  if (result.fatal) {
    for (const m of result.fatal) console.log(`ERROR ${code}: ${m}`);
    errorCount += result.fatal.length;
    continue;
  }

  const seenIds = new Map();
  const report = (item, kind, msg) => {
    console.log(
      `${kind} ${shown(item.file)} #${item.index + 1}${item.raw?.id ? ` (${item.raw.id})` : ""}: ${msg}`,
    );
    if (kind === "ERROR") errorCount += 1;
    else warningCount += 1;
  };

  result.questions.forEach((r, k) => {
    const item = all[k];
    for (const m of r.errors) report(item, "ERROR", m);
    for (const m of r.warnings) report(item, "WARN ", m);
    if (r.duplicate)
      report(
        item,
        "ERROR",
        `duplicate of a question ${r.duplicate === "in-file" ? "earlier in these files" : "already in the bank"}`,
      );
    // Content files need stable ids: the verification pass and re-imports key on them.
    if (!item.raw?.id) report(item, "ERROR", "id: required in content files");
    else if (seenIds.has(item.raw.id))
      report(
        item,
        "ERROR",
        `id: "${item.raw.id}" is already used in ${shown(seenIds.get(item.raw.id))}`,
      );
    else seenIds.set(item.raw.id, item.file);
    // Everyone gets the bank as approved questions, so only reviewed ones belong there.
    if (inBank(item.file) && item.raw?.reviewStatus !== "approved")
      report(item, "ERROR", 'bank: reviewStatus must be "approved" (move drafts to questions/)');
  });

  // Batch checks run per file: a file is one drafting batch.
  for (const f of packFiles) {
    const idx = all.flatMap((a, k) => (a.file === f && result.questions[k].normalized ? [k] : []));
    const lint = lintBatch(idx.map((k) => result.questions[k].normalized));
    for (const m of lint.batch) {
      console.log(`WARN  ${shown(f)}: ${m}`);
      warningCount += 1;
    }
    lint.perQuestion.forEach((ws, n) => ws.forEach((m) => report(all[idx[n]], "WARN ", m)));
  }

  const ok = result.questions.filter((r) => r.ok && !r.duplicate).length;
  console.log(
    `${code}: ${ok} of ${all.length} questions pass in ${packFiles.length} file${packFiles.length === 1 ? "" : "s"}`,
  );
}

console.log(
  `\n${errorCount} error${errorCount === 1 ? "" : "s"}, ${warningCount} warning${warningCount === 1 ? "" : "s"}`,
);
process.exit(errorCount > 0 || (strict && warningCount > 0) ? 1 : 0);
