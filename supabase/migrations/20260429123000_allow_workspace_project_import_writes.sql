-- Allow project imports/upserts for active workspace members.
--
-- Context:
-- The app-side permission model controls whether the user can see/use project import.
-- Supabase RLS still needs to allow the authenticated workspace member to INSERT/UPDATE
-- rows in public.projects. The older project write policy only allowed selected DB roles
-- such as project_manager, which caused CSV/project-list import to fail with:
-- "new row violates row-level security policy (USING expression) for table projects".
--
-- These policies are intentionally scoped to active members of the target workspace.
-- Existing stricter lead/admin policies remain in place and continue to work.

DROP POLICY IF EXISTS "Projects importable by workspace members" ON public.projects;
DROP POLICY IF EXISTS "Projects updateable by workspace members" ON public.projects;

CREATE POLICY "Projects importable by workspace members" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Projects updateable by workspace members" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
