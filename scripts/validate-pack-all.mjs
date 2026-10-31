#!/usr/bin/env node
// Validates every content/*/blueprint.json (the blank template is checked structurally only).
import { readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

let failed = false;
for (const dir of readdirSync("content", { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const file = `content/${dir.name}/blueprint.json`;
  if (!existsSync(file)) continue;
  const args = ["scripts/validate-pack.mjs", file];
  if (dir.name === "_template") args.push("--allow-template");
  const r = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
