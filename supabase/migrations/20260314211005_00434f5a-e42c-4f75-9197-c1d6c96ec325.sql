
-- Add due_date to workflow_flow_tasks
ALTER TABLE workflow_flow_tasks ADD COLUMN due_date date DEFAULT NULL;

-- Create workflow_task_comments table
CREATE TABLE workflow_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES workflow_flow_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workflow_task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view task comments"
  ON workflow_task_comments FOR SELECT TO authenticated
  USING (is_approved_user(auth.uid()));

CREATE POLICY "Approved users can insert task comments"
  ON workflow_task_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_approved_user(auth.uid()));

CREATE POLICY "Users can delete own comments"
  ON workflow_task_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
