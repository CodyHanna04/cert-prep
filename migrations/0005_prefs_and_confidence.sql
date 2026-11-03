-- Per-user preferences (theme, confidence chip) stored with the account instead of a browser cookie,
-- and the optional confidence a learner gives before checking a practice answer.

ALTER TABLE app.response ADD COLUMN confidence text CHECK (confidence IN ('guess', 'unsure', 'sure'));

CREATE TABLE app.user_pref (
  user_id         uuid PRIMARY KEY REFERENCES auth."user"(id) ON DELETE CASCADE,
  theme           text,
  show_confidence boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.user_pref ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_pref FORCE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON app.user_pref FOR ALL TO app_user
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());
