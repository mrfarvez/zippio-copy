CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name IN ('manager', 'employee', 'hr')),
  UNIQUE (organization_id, name)
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE TABLE password_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by uuid REFERENCES refresh_tokens(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  manager_name text NOT NULL DEFAULT 'Unassigned',
  UNIQUE (organization_id, name)
);

CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  employee_code text NOT NULL,
  name text NOT NULL,
  title text NOT NULL,
  email text NOT NULL,
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  scores jsonb NOT NULL DEFAULT '[0,0,0,0,0]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_code),
  UNIQUE (organization_id, email)
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_code text NOT NULL,
  title text NOT NULL,
  employee_id uuid NOT NULL REFERENCES employees(id),
  priority text NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  hours numeric(8,2) NOT NULL CHECK (hours > 0),
  points integer NOT NULL CHECK (points >= 0),
  deadline date NOT NULL,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'progress', 'review', 'handoff', 'approved')),
  note text,
  started_at timestamptz,
  parent_task_id uuid REFERENCES tasks(id),
  reviewer_id uuid REFERENCES employees(id),
  attachment_name text,
  github_repo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, task_code)
);

CREATE TABLE task_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id),
  approved boolean NOT NULL,
  points_awarded integer NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE delegation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_code text NOT NULL,
  parent_task_id uuid NOT NULL REFERENCES tasks(id),
  from_employee_id uuid NOT NULL REFERENCES employees(id),
  to_employee_id uuid NOT NULL REFERENCES employees(id),
  title text NOT NULL,
  details text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  points integer CHECK (points IS NULL OR points > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hr_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_code text NOT NULL,
  department_id uuid REFERENCES departments(id),
  requirement text NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'Pending approval',
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  priority text NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
  deadline date,
  requester_id uuid REFERENCES users(id),
  officer_id uuid REFERENCES users(id),
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, request_code)
);

CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  check_in timestamptz,
  check_out timestamptz,
  status text NOT NULL DEFAULT 'Present',
  UNIQUE (employee_id, work_date)
);

CREATE TABLE leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'Pending approval',
  approved_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE TABLE point_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id),
  task_id uuid REFERENCES tasks(id),
  value integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0),
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_org_idx ON users (organization_id, status);
CREATE INDEX employees_org_department_idx ON employees (organization_id, department_id);
CREATE INDEX tasks_org_status_idx ON tasks (organization_id, status, deadline);
CREATE INDEX tasks_employee_idx ON tasks (organization_id, employee_id, status);
CREATE INDEX hr_requests_org_status_idx ON hr_requests (organization_id, status, deadline);
CREATE INDEX attendance_employee_date_idx ON attendance_records (employee_id, work_date DESC);
CREATE INDEX audit_events_org_date_idx ON audit_events (organization_id, created_at DESC);
