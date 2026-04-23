DROP POLICY IF EXISTS "Workspace settings managed by workspace leads" ON public.workspaces;
DROP POLICY IF EXISTS "Audit events created by workspace members" ON public.audit_events;

CREATE POLICY "Workspace settings managed by workspace leads" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (public.has_workspace_role(id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']))
  WITH CHECK (public.has_workspace_role(id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']));

CREATE POLICY "Audit events created by workspace members" ON public.audit_events
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.has_workspace_role(
      workspace_id,
      auth.uid(),
      ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager', 'team_member', 'standard_member']
    )
  );
