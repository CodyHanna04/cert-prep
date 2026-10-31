import { existsSync } from "node:fs";

/** Loads .env.local then .env (first file wins) without overriding real environment variables. */
export function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (existsSync(f)) process.loadEnvFile(f);
  }
}
