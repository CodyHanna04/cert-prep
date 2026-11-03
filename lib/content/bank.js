import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The shared baseline bank for a pack: approved questions in content/<pack>/bank/*.json (content format v1).
 * Every learner gets a copy in their own exam; `version` is a hash of the files, so a change re-syncs.
 * Questions a learner imports themselves never go here: they stay in that learner's account.
 */
const ROOT = join(process.cwd(), "content");
const cache = new Map();

/** @returns {{ version: string | null, questions: object[] }} version is null when the pack has no bank. */
export function readPackBank(code, root = ROOT) {
  const cached = process.env.NODE_ENV === "production" ? cache.get(code) : undefined;
  if (cached) return cached;
  const dir = join(root, code.toLowerCase(), "bank");
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
    : [];
  const hash = createHash("sha256");
  const questions = [];
  for (const f of files) {
    const text = readFileSync(join(dir, f), "utf8");
    hash.update(f).update("\0").update(text);
    questions.push(...(JSON.parse(text).questions ?? []));
  }
  const bank = { version: files.length ? hash.digest("hex").slice(0, 16) : null, questions };
  cache.set(code, bank);
  return bank;
}
