ALTER TABLE tasks
  ALTER COLUMN deadline TYPE timestamptz USING deadline::timestamp + interval '23 hours 59 minutes 59 seconds';

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS additional_reference_url text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kpi_score numeric(10,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kpi_bonus_rate numeric(5,4) NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kpi_penalty_rate numeric(5,4) NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kpi_late_days integer NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kpi_status text NOT NULL DEFAULT 'pending'
  CHECK (kpi_status IN ('pending', 'on_time', 'early', 'overdue', 'late', 'finalized'));

CREATE INDEX IF NOT EXISTS tasks_org_deadline_idx ON tasks (organization_id, deadline, status);
