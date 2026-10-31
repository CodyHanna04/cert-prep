#!/usr/bin/env node
// Starts a new exam pack from the template. Usage: npm run pack:new -- <exam-code>   (e.g. SAA-C03)
import { cpSync, existsSync } from "node:fs";

const code = process.argv[2]?.trim();
if (!code || !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(code)) {
  console.error("usage: npm run pack:new -- <exam-code>   (letters, digits and dashes)");
  process.exit(2);
}
const dest = `content/${code.toLowerCase()}`;
if (existsSync(dest)) {
  console.error(`${dest} already exists.`);
  process.exit(1);
}
cpSync("content/_template", dest, { recursive: true });
console.log(`Created ${dest}. Next: follow docs/08-exam-pack-onboarding.md, then run: npm run pack:validate`);
