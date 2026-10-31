import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parsePack } from "../schemas/pack.js";

/** Exam packs shipped with the app: content/<dir>/blueprint.json (the blank template is excluded). */
const ROOT = join(process.cwd(), "content");

export function packPath(code) {
  const dir = listPackDirs().find((d) => readCode(d) === code);
  if (!dir) throw new Error(`No exam pack for ${code}`);
  return join(ROOT, dir, "blueprint.json");
}

function listPackDirs() {
  if (!existsSync(ROOT)) return [];
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && existsSync(join(ROOT, d.name, "blueprint.json")))
    .map((d) => d.name);
}

function readCode(dir) {
  try {
    return JSON.parse(readFileSync(join(ROOT, dir, "blueprint.json"), "utf8")).exam?.code;
  } catch {
    return undefined;
  }
}

/** @returns {{ code: string, name: string, vendor: string, domains: number, objectives: number, source: { title: string, retrievedOn: string } }[]} */
export function listPacks() {
  const out = [];
  for (const dir of listPackDirs()) {
    try {
      const pack = parsePack(JSON.parse(readFileSync(join(ROOT, dir, "blueprint.json"), "utf8")));
      out.push({
        code: pack.exam.code,
        name: pack.exam.name,
        vendor: pack.exam.vendor,
        domains: pack.exam.domains.length,
        objectives: pack.exam.domains.reduce((n, d) => n + d.objectives.length, 0),
        source: { title: pack.sources[0].title, retrievedOn: pack.sources[0].retrievedOn },
      });
    } catch {
      // A malformed pack is skipped here; `npm run pack:validate` reports why.
    }
  }
  return out;
}
