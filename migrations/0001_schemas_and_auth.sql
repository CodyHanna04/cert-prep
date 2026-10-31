-- Schemas, role grants and the Better Auth tables (schema "auth").
-- Roles are created by docker/initdb/01-roles.sh; this file only grants.
-- Runs as certprep_owner.

CREATE SCHEMA auth;
CREATE SCHEMA app;

REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- auth_app: Better Auth only. admin_app: auth schema (admin site), never app data.
GRANT USAGE ON SCHEMA auth TO auth_app, admin_app;
-- app_user: app schema only. It cannot read auth tables.
GRANT USAGE ON SCHEMA app TO app_user;

-- search_path per role is set in docker/initdb/01-roles.sh (needs a superuser).

ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO auth_app, admin_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA app  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- Better Auth core tables (column names follow Better Auth's defaults).
CREATE TABLE auth."user" (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  email            text NOT NULL UNIQUE,
  "emailVerified"  boolean NOT NULL DEFAULT false,
  image            text,
  "createdAt"      timestamptz NOT NULL DEFAULT now(),
  "updatedAt"      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth.session (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "expiresAt" timestamptz NOT NULL,
  token       text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId"    uuid NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE
);
CREATE INDEX session_user_idx ON auth.session ("userId");

CREATE TABLE auth.account (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "accountId"             text NOT NULL,
  "providerId"            text NOT NULL,
  "userId"                uuid NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope                   text,
  password                text,
  "createdAt"             timestamptz NOT NULL DEFAULT now(),
  "updatedAt"             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_user_idx ON auth.account ("userId");

CREATE TABLE auth.verification (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier  text NOT NULL,
  value       text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth.passkey (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text,
  "publicKey"    text NOT NULL,
  "userId"       uuid NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  "credentialID" text NOT NULL UNIQUE,
  counter        integer NOT NULL,
  "deviceType"   text NOT NULL,
  "backedUp"     boolean NOT NULL,
  transports     text,
  "createdAt"    timestamptz DEFAULT now(),
  aaguid         text
);
CREATE INDEX passkey_user_idx ON auth.passkey ("userId");
