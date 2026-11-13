-- 006: task reference links — GitHub repositories and external reference links attached by managers/leads.
CREATE TABLE task_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('repo', 'link')),
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_links_task_idx ON task_links (task_id);
