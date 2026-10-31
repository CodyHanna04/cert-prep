// Runs once when the server starts. An unsafe production configuration fails here, so the server refuses to boot.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { adminMode, assertAdminEnv } = await import("./lib/admin/identity.js");
  assertAdminEnv(process.env);
  if (!adminMode(process.env)) {
    const { assertSafeEnv } = await import("./lib/auth/config.js");
    assertSafeEnv(process.env);
  }
}
