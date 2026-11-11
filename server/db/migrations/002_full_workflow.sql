CREATE TABLE organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text NOT NULL UNIQUE,
  description text NOT NULL
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE task_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  from_status text,
  to_status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE delegation_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  delegation_request_id uuid NOT NULL REFERENCES delegation_requests(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('created', 'approved', 'rejected', 'cancelled')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hr_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hr_request_id uuid NOT NULL REFERENCES hr_requests(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  from_status text,
  to_status text NOT NULL,
  progress integer CHECK (progress BETWEEN 0 AND 100),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hr_request_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hr_request_id uuid NOT NULL REFERENCES hr_requests(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  annual_days numeric(6,2) NOT NULL CHECK (annual_days >= 0),
  requires_approval boolean NOT NULL DEFAULT true,
  UNIQUE (organization_id, name)
);

ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_type_id uuid REFERENCES leave_types(id);
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS review_note text;

CREATE TABLE leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2200),
  entitled_days numeric(6,2) NOT NULL CHECK (entitled_days >= 0),
  used_days numeric(6,2) NOT NULL DEFAULT 0 CHECK (used_days >= 0),
  UNIQUE (employee_id, leave_type_id, year)
);

CREATE TABLE leave_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  leave_request_id uuid NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES users(id),
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE performance_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (organization_id, name),
  CHECK (ends_on >= starts_on)
);

CREATE TABLE performance_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES performance_cycles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  dimension text NOT NULL,
  score numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  weight numeric(5,2) NOT NULL CHECK (weight BETWEEN 0 AND 100),
  reviewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, employee_id, dimension)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  entity_type text,
  entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ticket_code text NOT NULL,
  requester_id uuid NOT NULL REFERENCES users(id),
  assignee_id uuid REFERENCES users(id),
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, ticket_code)
);

CREATE TABLE privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('export', 'deletion', 'correction')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  reason text,
  completed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  retention_days integer NOT NULL CHECK (retention_days > 0),
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE (organization_id, entity_type)
);

CREATE INDEX organization_members_user_idx ON organization_members (user_id, left_at);
CREATE INDEX task_status_history_task_idx ON task_status_history (task_id, created_at DESC);
CREATE INDEX delegation_events_request_idx ON delegation_request_events (delegation_request_id, created_at DESC);
CREATE INDEX hr_events_request_idx ON hr_request_events (hr_request_id, created_at DESC);
CREATE INDEX hr_comments_request_idx ON hr_request_comments (hr_request_id, created_at);
CREATE INDEX leave_requests_org_status_idx ON leave_requests (organization_id, status, start_date);
CREATE INDEX leave_approvals_request_idx ON leave_approvals (leave_request_id, created_at DESC);
CREATE INDEX performance_scores_employee_idx ON performance_scores (employee_id, cycle_id);
CREATE INDEX notifications_user_idx ON notifications (user_id, read_at, created_at DESC);
CREATE INDEX support_tickets_org_status_idx ON support_tickets (organization_id, status, updated_at DESC);
CREATE INDEX privacy_requests_org_status_idx ON privacy_requests (organization_id, status, created_at);

INSERT INTO permissions (permission_key, description) VALUES
  ('employee.read', 'View employee profiles'),
  ('employee.manage', 'Create, update and deactivate employees'),
  ('task.read', 'View permitted tasks'),
  ('task.manage', 'Create and assign tasks'),
  ('task.review', 'Review submitted tasks'),
  ('hr.request.manage', 'Create and manage HR requests'),
  ('leave.review', 'Approve or reject leave'),
  ('performance.manage', 'Manage performance cycles and scores'),
  ('report.read', 'View organization reports'),
  ('privacy.manage', 'Process privacy requests')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO organization_members (organization_id, user_id, employee_id)
SELECT u.organization_id, u.id, e.id
FROM users u LEFT JOIN employees e ON e.user_id = u.id
ON CONFLICT (organization_id, user_id) DO UPDATE SET employee_id = EXCLUDED.employee_id;

INSERT INTO leave_types (organization_id, name, annual_days)
SELECT id, 'Annual leave', 20 FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO leave_types (organization_id, name, annual_days)
SELECT id, 'Sick leave', 10 FROM organizations
ON CONFLICT (organization_id, name) DO NOTHING;

INSERT INTO retention_policies (organization_id, entity_type, retention_days)
SELECT id, 'audit_events', 730 FROM organizations
ON CONFLICT (organization_id, entity_type) DO NOTHING;
