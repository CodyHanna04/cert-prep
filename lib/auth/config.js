import { passkey } from "@better-auth/passkey";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { consumeToken, findValidToken } from "./tokens.js";

/**
 * Builds the Better Auth options from the environment. Kept free of side effects so tests can build the
 * production configuration and assert on it (docs/11-auth-and-tenancy.md section 2).
 */

/** Dev-only password login: never in production, only on localhost, only when explicitly enabled. */
export function devPasswordLoginEnabled(env) {
  if (env.NODE_ENV === "production") return false;
  if (env.ALLOW_DEV_PASSWORD_LOGIN !== "true") return false;
  try {
    return new URL(env.APP_ORIGIN).hostname === "localhost";
  } catch {
    return false;
  }
}

/** Refuses to run a production server that still carries the dev-login flag or lacks required settings. */
export function assertSafeEnv(env) {
  if (env.NODE_ENV === "production") {
    if ("ALLOW_DEV_PASSWORD_LOGIN" in env) {
      throw new Error("ALLOW_DEV_PASSWORD_LOGIN must not exist in production. Remove it and restart.");
    }
    if (!env.APP_ORIGIN?.startsWith("https://")) throw new Error("APP_ORIGIN must be an https URL in production.");
  }
  for (const key of ["APP_ORIGIN", "BETTER_AUTH_SECRET", "PASSKEY_RP_ID"]) {
    if (!env[key]) throw new Error(`${key} is not set.`);
  }
  if (env.BETTER_AUTH_SECRET.length < 32) throw new Error("BETTER_AUTH_SECRET must be at least 32 characters.");
}

const requireUserVerified = (verified, what) => {
  if (!verified) throw new APIError("BAD_REQUEST", { message: `${what} requires user verification (PIN or biometrics).` });
};

/**
 * @param {Record<string, string | undefined>} env
 * @param {{ query: Function }} pool pg pool connected as the auth_app role (also used for token checks)
 * @param {unknown[]} [extraPlugins] e.g. Next.js cookie plugin, added by the caller
 * @param {object} [overrides] shallow overrides, for tests only
 */
export function buildAuthOptions(env, pool, extraPlugins = [], overrides = {}) {
  assertSafeEnv(env);
  const prod = env.NODE_ENV === "production";
  const devLogin = devPasswordLoginEnabled(env);

  return {
    ...baseOptions(env, pool, extraPlugins, prod, devLogin),
    ...overrides,
  };
}

function baseOptions(env, pool, extraPlugins, prod, devLogin) {
  return {
    appName: "CertPrep",
    baseURL: env.APP_ORIGIN,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_ORIGIN],
    database: pool,

    advanced: {
      database: { generateId: "uuid" },
      useSecureCookies: prod,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: prod, path: "/" },
      // nginx overwrites X-Forwarded-For with the real client address; trust only that header.
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },

    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24, freshAge: 60 * 5 },

    // Counters live in Postgres so limits survive restarts and are shared across instances.
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/passkey/generate-authenticate-options": { window: 60, max: 20 },
        "/passkey/verify-authentication": { window: 60, max: 10 },
        "/passkey/generate-register-options": { window: 60, max: 10 },
        "/passkey/verify-registration": { window: 60, max: 10 },
        "/sign-in/email": { window: 60, max: 10 },
      },
    },

    // Passkeys only. Password login exists solely for localhost development.
    emailAndPassword: { enabled: devLogin, autoSignIn: true, minPasswordLength: 8 },
    disabledPaths: [
      "/sign-up/email",
      "/change-email",
      "/change-password",
      "/request-password-reset",
      "/reset-password",
      "/send-verification-email",
      "/verify-email",
      "/delete-user",
      "/delete-user/callback",
      "/set-password",
      ...(devLogin ? [] : ["/sign-in/email"]),
    ],

    hooks: {
      // Never let an account end up with zero passkeys: that would be a self-inflicted lockout.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/passkey/delete-passkey") return;
        const target = await ctx.context.adapter.findOne({ model: "passkey", where: [{ field: "id", value: ctx.body?.id }] });
        if (!target) return;
        const mine = await ctx.context.adapter.findMany({ model: "passkey", where: [{ field: "userId", value: target.userId }] });
        if (mine.length <= 1) {
          throw new APIError("BAD_REQUEST", { message: "You can't remove your only passkey. Add another one first." });
        }
      }),
    },

    plugins: [
      passkey({
        rpID: env.PASSKEY_RP_ID,
        rpName: "CertPrep",
        origin: env.APP_ORIGIN,
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        registration: {
          // Passkey-first: there is no password or email step. The invite/reset token is the proof.
          requireSession: false,
          resolveUser: async ({ context }) => {
            const t = await findValidToken(pool, context);
            if (!t) throw new APIError("BAD_REQUEST", { message: "This link is invalid or has expired." });
            return { id: t.userId, name: t.name, displayName: t.name };
          },
          afterVerification: async ({ verification, user, context }) => {
            requireUserVerified(verification.registrationInfo?.userVerified, "Registration");
            if (context && !(await consumeToken(pool, context, user.id))) {
              throw new APIError("BAD_REQUEST", { message: "This link was already used or has expired." });
            }
          },
        },
        authentication: {
          afterVerification: async ({ verification }) => {
            requireUserVerified(verification.authenticationInfo?.userVerified, "Sign-in");
          },
        },
      }),
      ...extraPlugins,
    ],
  };
}
