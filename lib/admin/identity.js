/**
 * Admin identity (docs/11-auth-and-tenancy.md section 2.6). The admin site is only reachable through a
 * Tailscale sidecar running `tailscale serve`, which adds the caller's tailnet login as a request header.
 * The header is trusted only because nothing else can reach the container; the allowlist then limits who may act.
 */

export function adminMode(env) {
  return env.APP_MODE === "admin";
}

/** Login names allowed to administer, from ADMIN_TAILSCALE_LOGINS (comma-separated, case-insensitive). */
export function adminAllowlist(env) {
  return (env.ADMIN_TAILSCALE_LOGINS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * @param {{ get(name: string): string | null }} headers
 * @returns {string | null} the allowed admin's login, or null
 */
export function adminFromHeaders(headers, env) {
  if (!adminMode(env)) return null;
  const login = headers.get("tailscale-user-login")?.trim().toLowerCase();
  if (!login) return null;
  return adminAllowlist(env).includes(login) ? login : null;
}

/** Refuses to start an admin deployment without an allowlist, or a public deployment that has admin settings. */
export function assertAdminEnv(env) {
  if (adminMode(env)) {
    if (adminAllowlist(env).length === 0) throw new Error("ADMIN_TAILSCALE_LOGINS must list at least one login in admin mode.");
    if (!env.DATABASE_URL_ADMIN) throw new Error("DATABASE_URL_ADMIN is required in admin mode.");
    if (!env.PUBLIC_ORIGIN?.startsWith("http")) throw new Error("PUBLIC_ORIGIN (the public site's URL) is required in admin mode.");
  } else if (env.DATABASE_URL_ADMIN && env.NODE_ENV === "production") {
    throw new Error("The public site must not have DATABASE_URL_ADMIN. Remove it.");
  }
}
