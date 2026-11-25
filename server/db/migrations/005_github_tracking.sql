-- 005: GitHub tracking — projects, project members, task commits, connected GitHub accounts.

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_code text NOT NULL,
  name text NOT NULL,
  description text,
  repo_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, project_code)
);

CREATE TABLE project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, employee_id)
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

CREATE TABLE task_commits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  repo text NOT NULL,
  commit_sha text NOT NULL,
  commit_url text NOT NULL,
  message text,
  author_login text,
  author_email text,
  committed_at timestamptz,
  verified boolean NOT NULL DEFAULT true,
  verified_at timestamptz NOT NULL DEFAULT now(),
  github_raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, commit_sha)
);

CREATE TABLE github_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  github_login text NOT NULL,
  github_id text,
  access_token text NOT NULL,
  scope text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX projects_org_idx ON projects (organization_id, status);
CREATE INDEX project_members_employee_idx ON project_members (employee_id);
CREATE INDEX task_commits_task_idx ON task_commits (task_id, verified);
CREATE INDEX task_commits_employee_idx ON task_commits (employee_id);
