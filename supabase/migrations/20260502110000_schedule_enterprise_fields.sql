-- Enterprise schedule support for MS Project-style planning.
-- Safe additive migration only; no data is removed.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS duration text,
  ADD COLUMN IF NOT EXISTS workload_hours numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_hours numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_hours numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_milestone boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_task_id uuid,
  ADD COLUMN IF NOT EXISTS predecessors jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS phase text DEFAULT 'Execution',
  ADD COLUMN IF NOT EXISTS sequence_no integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outline_level integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dependency_type text DEFAULT 'FS',
  ADD COLUMN IF NOT EXISTS lag_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS critical_path boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS baseline_start_date date,
  ADD COLUMN IF NOT EXISTS baseline_end_date date,
  ADD COLUMN IF NOT EXISTS resource_ids jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tasks_project_schedule_dates
  ON public.tasks(project_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id
  ON public.tasks(parent_task_id);

CREATE INDEX IF NOT EXISTS idx_tasks_project_phase
  ON public.tasks(project_id, phase);

CREATE INDEX IF NOT EXISTS idx_tasks_critical_path
  ON public.tasks(project_id, critical_path)
  WHERE critical_path = true;

-- Backfill schedule dates from due_date where start/end are empty.
UPDATE public.tasks
SET
  start_date = COALESCE(start_date, due_date),
  end_date = COALESCE(end_date, due_date),
  duration = COALESCE(duration, '1d'),
  workload_hours = COALESCE(workload_hours, estimated_hours, 8),
  estimated_hours = COALESCE(estimated_hours, workload_hours, 8),
  phase = COALESCE(NULLIF(phase, ''), 'Execution')
WHERE start_date IS NULL
   OR end_date IS NULL
   OR duration IS NULL
   OR workload_hours IS NULL
   OR estimated_hours IS NULL
   OR phase IS NULL
   OR phase = '';

COMMENT ON COLUMN public.tasks.parent_task_id IS 'Parent task for MS Project-style WBS tree/subtask hierarchy.';
COMMENT ON COLUMN public.tasks.predecessors IS 'JSON array of predecessor task IDs for schedule dependency links.';
COMMENT ON COLUMN public.tasks.critical_path IS 'Flag used by the schedule page to mark critical path activities.';
COMMENT ON COLUMN public.tasks.sequence_no IS 'Manual schedule ordering value for spreadsheet/MS Project-style sorting.';
COMMENT ON COLUMN public.tasks.resource_ids IS 'JSON array of team member/resource IDs assigned to the schedule activity.';
