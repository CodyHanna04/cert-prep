-- Shared baseline bank: approved questions shipped in content/<pack>/bank/ are copied into every
-- learner's own exam (still per-user rows under RLS). from_bank marks those copies; exam.bank_version
-- records which version of the pack's bank was last synced, so a deploy with new questions re-syncs.

ALTER TABLE app.question ADD COLUMN from_bank boolean NOT NULL DEFAULT false;
ALTER TABLE app.exam ADD COLUMN bank_version text;
