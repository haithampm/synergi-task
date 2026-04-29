-- Fix project import failures caused by empty workflow_id values.
--
-- Error seen during import:
--   invalid input syntax for type uuid: ""
--
-- Imported project rows may not have a workflow assigned. The app stores local workflow
-- identifiers as strings, while the database column was UUID with a FK to workflows.
-- To keep imports robust and avoid rejecting otherwise valid project rows, store the
-- optional workflow reference as TEXT. Existing UUID values are preserved as text.

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_workflow_id_fkey;

ALTER TABLE public.projects
  ALTER COLUMN workflow_id DROP DEFAULT;

ALTER TABLE public.projects
  ALTER COLUMN workflow_id TYPE TEXT
  USING NULLIF(workflow_id::TEXT, '');
