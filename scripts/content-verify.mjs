// Independent verification pass for a drafted batch (docs/07 section 2, step 3).
//   npm run content:blind -- <batch.json>                    writes <batch>.blind.json (no key, no rationales)
//   npm run content:check -- <batch.json> <answers.json> [--write]
//                                                           compares a verifier's answers with the key;
//                                                           --write sets needsAttention on disagreements
import { readFileSync, writeFileSync } from "node:fs";
import { blindCopy, compareAnswers, flagDisagreements } from "../lib/content/verify.js";

const [command, batchPath, answersPath, ...flags] = process.argv.slice(2);
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const usage = () => {
  console.error(
    "usage: content-verify.mjs blind <batch.json>\n       content-verify.mjs check <batch.json> <answers.json> [--write]",
  );
  process.exit(2);
};

if (!batchPath) usage();
const batch = read(batchPath);
if (batch.questions.some((q) => !q.id)) {
  console.error("Every question needs an id before it can be verified.");
  process.exit(1);
}

if (command === "blind") {
  const out = batchPath.replace(/\.json$/, ".blind.json");
  writeFileSync(out, `${JSON.stringify(blindCopy(batch), null, 2)}\n`);
  console.log(
    `Wrote ${out}. Give it (and content/prompts/verify-blind.md) to a separate model or session, save its reply as <batch>.answers.json, then run content:check.`,
  );
} else if (command === "check" && answersPath) {
  const comparison = compareAnswers(batch, read(answersPath));
  for (const c of comparison.filter((x) => x.result !== "match")) {
    console.log(
      `${c.result === "missing" ? "MISSING " : "MISMATCH"} ${c.id}: key ${c.key.join(",")}, verifier ${c.answered.join(",") || "(none)"}`,
    );
  }
  const bad = comparison.filter((c) => c.result !== "match").length;
  console.log(`${comparison.length - bad} of ${comparison.length} agree with the key.`);
  if (flags.includes("--write") && bad > 0) {
    writeFileSync(batchPath, `${JSON.stringify(flagDisagreements(batch, comparison), null, 2)}\n`);
    console.log(`Set needsAttention on ${bad} question${bad === 1 ? "" : "s"} in ${batchPath}.`);
  }
  process.exit(bad > 0 ? 1 : 0);
} else {
  usage();
}
