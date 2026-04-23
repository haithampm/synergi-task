DROP POLICY IF EXISTS "Workspace memberships managed by workspace leads" ON public.workspace_memberships;
DROP POLICY IF EXISTS "Team members managed by workspace leads" ON public.team_members;
DROP POLICY IF EXISTS "Channels managed by contributors and managers" ON public.chat_channels;
DROP POLICY IF EXISTS "Messages managed by contributors and managers" ON public.chat_messages;
DROP POLICY IF EXISTS "Meetings managed by contributors and managers" ON public.meetings;
DROP POLICY IF EXISTS "Sticky notes managed by owners or leads" ON public.sticky_notes;
DROP POLICY IF EXISTS "Dashboards managed by workspace leads" ON public.dashboards;

CREATE POLICY "Workspace memberships managed by workspace leads" ON public.workspace_memberships
  FOR UPDATE TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']));

CREATE POLICY "Team members managed by workspace leads" ON public.team_members
  FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']));

CREATE POLICY "Channels managed by contributors and managers" ON public.chat_channels
  FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager', 'team_member', 'standard_member']))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager', 'team_member', 'standard_member']));

CREATE POLICY "Messages managed by contributors and managers" ON public.chat_messages
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.chat_channels c
    WHERE c.id = channel_id
      AND public.has_workspace_role(c.workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager', 'team_member', 'standard_member'])
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.chat_channels c
    WHERE c.id = channel_id
      AND public.has_workspace_role(c.workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager', 'team_member', 'standard_member'])
  ));

CREATE POLICY "Meetings managed by contributors and managers" ON public.meetings
  FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager', 'team_member', 'standard_member']))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager', 'team_member', 'standard_member']));

CREATE POLICY "Sticky notes managed by owners or leads" ON public.sticky_notes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']))
  WITH CHECK (auth.uid() = user_id OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']));

CREATE POLICY "Dashboards managed by workspace leads" ON public.dashboards
  FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']));
