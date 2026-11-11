ALTER TABLE employees ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'inactive'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS employees_org_status_idx ON employees (organization_id, status);
