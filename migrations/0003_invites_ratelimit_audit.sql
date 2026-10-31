-- Tables beside Better Auth's own: DB-backed rate limits, single-use invite/reset tokens, admin audit log.

CREATE TABLE auth."rateLimit" (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL UNIQUE,
  count         integer NOT NULL,
  "lastRequest" bigint NOT NULL
);

-- Tokens are stored hashed (sha256); the raw token only ever appears in the link handed to the user.
CREATE TABLE auth.invite_token (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  purpose    text NOT NULL CHECK (purpose IN ('invite', 'reset')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL
);
CREATE INDEX invite_token_user_idx ON auth.invite_token (user_id);

-- The public site's role can check and consume tokens but never mint them.
REVOKE INSERT, DELETE ON auth.invite_token FROM auth_app;

-- Append-only record of admin actions. Not visible to the public site's role at all.
CREATE TABLE auth.audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at             timestamptz NOT NULL DEFAULT now(),
  actor          text NOT NULL,
  action         text NOT NULL,
  target_user_id uuid,
  target_name    text,
  detail         jsonb NOT NULL DEFAULT '{}'
);
REVOKE ALL ON auth.audit_log FROM auth_app;
REVOKE UPDATE, DELETE ON auth.audit_log FROM admin_app;
