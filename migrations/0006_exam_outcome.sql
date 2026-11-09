-- A learner can mark a course done: they passed the real exam (optionally with the date and scaled score),
-- or they finished with it. Clearing the outcome puts the course back to plain studying.

ALTER TABLE app.exam
  ADD COLUMN outcome       text CHECK (outcome IN ('passed', 'finished')),
  ADD COLUMN outcome_date  date,
  ADD COLUMN outcome_score integer CHECK (outcome_score BETWEEN 100 AND 1000);
