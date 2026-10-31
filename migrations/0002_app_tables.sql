-- Application tables. Every table is user-owned: user_id NOT NULL, RLS enabled and FORCED.
-- The app connects as app_user and sets app.user_id per transaction (lib/db/with-user.js).

CREATE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::uuid $$;

GRANT EXECUTE ON FUNCTION app.current_user_id() TO app_user;

CREATE TABLE app.exam (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  code                 text NOT NULL,
  name                 text NOT NULL,
  vendor               text NOT NULL,
  pass_mark_pct        numeric,
  pass_mark_note       text,
  readiness_target_pct integer NOT NULL DEFAULT 80 CHECK (readiness_target_pct BETWEEN 1 AND 100),
  time_limit_min       integer,
  question_count       integer,
  exam_date            date,
  profile              jsonb NOT NULL DEFAULT '{}',
  sources              jsonb NOT NULL DEFAULT '[]',
  archived             boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);

CREATE TABLE app.domain (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  exam_id    uuid NOT NULL REFERENCES app.exam(id) ON DELETE CASCADE,
  key        text NOT NULL,
  name       text NOT NULL,
  weight_pct numeric NOT NULL CHECK (weight_pct >= 0 AND weight_pct <= 100),
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (exam_id, key)
);
CREATE INDEX domain_user_exam_idx ON app.domain (user_id, exam_id);

CREATE TABLE app.objective (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  exam_id     uuid NOT NULL REFERENCES app.exam(id) ON DELETE CASCADE,
  domain_id   uuid NOT NULL REFERENCES app.domain(id) ON DELETE CASCADE,
  code        text NOT NULL,
  title       text NOT NULL,
  scope       jsonb NOT NULL DEFAULT '[]',
  study_notes text,
  sort_order  integer NOT NULL DEFAULT 0,
  UNIQUE (exam_id, code)
);
CREATE INDEX objective_user_exam_idx ON app.objective (user_id, exam_id);

CREATE TABLE app.question (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  exam_id         uuid NOT NULL REFERENCES app.exam(id) ON DELETE CASCADE,
  domain_id       uuid NOT NULL REFERENCES app.domain(id) ON DELETE CASCADE,
  objective_id    uuid NOT NULL REFERENCES app.objective(id) ON DELETE CASCADE,
  external_id     text,
  type            text NOT NULL CHECK (type IN ('single', 'multi', 'tf')),
  stem            text NOT NULL,
  options         jsonb NOT NULL,
  explanation     text,
  difficulty      integer CHECK (difficulty BETWEEN 1 AND 5),
  tags            text[] NOT NULL DEFAULT '{}',
  source          text NOT NULL DEFAULT 'imported' CHECK (source IN ('own', 'ai-draft', 'licensed', 'imported')),
  review_status   text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'approved', 'rejected')),
  reject_reason   text,
  generator       text,
  generated_at    date,
  last_verified   date,
  refs            jsonb NOT NULL DEFAULT '[]',
  needs_attention boolean NOT NULL DEFAULT false,
  content_hash    text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exam_id, content_hash)
);
CREATE INDEX question_user_exam_idx ON app.question (user_id, exam_id, review_status);
CREATE UNIQUE INDEX question_external_idx ON app.question (user_id, exam_id, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE app.question_mark (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES app.question(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('flag', 'bookmark')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, kind)
);

CREATE TABLE app.note (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES app.question(id) ON DELETE CASCADE,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id)
);

CREATE TABLE app.session (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  exam_id        uuid NOT NULL REFERENCES app.exam(id) ON DELETE CASCADE,
  mode           text NOT NULL CHECK (mode IN ('practice', 'mock')),
  config         jsonb NOT NULL DEFAULT '{}',
  question_ids   jsonb NOT NULL DEFAULT '[]',
  status         text NOT NULL DEFAULT 'in-progress' CHECK (status IN ('in-progress', 'completed', 'abandoned')),
  time_limit_sec integer,
  started_at     timestamptz NOT NULL DEFAULT now(),
  ended_at       timestamptz
);
-- At most one open session per exam.
CREATE UNIQUE INDEX session_one_open_idx ON app.session (user_id, exam_id) WHERE status = 'in-progress';
CREATE INDEX session_user_exam_idx ON app.session (user_id, exam_id, started_at DESC);

CREATE TABLE app.response (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth."user"(id) ON DELETE CASCADE,
  session_id          uuid NOT NULL REFERENCES app.session(id) ON DELETE CASCADE,
  question_id         uuid NOT NULL REFERENCES app.question(id) ON DELETE CASCADE,
  selected_option_ids jsonb NOT NULL,
  is_correct          boolean NOT NULL,
  time_ms             integer,
  flagged             boolean NOT NULL DEFAULT false,
  answered_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id)
);
CREATE INDEX response_user_question_idx ON app.response (user_id, question_id, answered_at DESC);

-- Row-level security on every app table: fail closed (no context => no rows).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['exam', 'domain', 'objective', 'question', 'question_mark', 'note', 'session', 'response']
  LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY user_isolation ON app.%I FOR ALL TO app_user
         USING (user_id = app.current_user_id())
         WITH CHECK (user_id = app.current_user_id())', t);
  END LOOP;
END $$;
