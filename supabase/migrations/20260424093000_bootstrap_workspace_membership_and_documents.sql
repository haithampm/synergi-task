DROP POLICY IF EXISTS "Documents managed by workspace leads" ON public.project_documents;

CREATE POLICY "Documents managed by workspace leads" ON public.project_documents
  FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']));

CREATE OR REPLACE FUNCTION public.bootstrap_workspace_membership()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  metadata jsonb := coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);
  existing_membership public.workspace_memberships%ROWTYPE;
  matched_member public.team_members%ROWTYPE;
  target_workspace public.workspaces%ROWTYPE;
  target_role public.app_role := 'project_manager';
  target_title text := 'Workspace Member';
  member_count bigint := 0;
  display_name text := null;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'missing',
      'message', 'Authentication is required before the workspace can be linked.'
    );
  END IF;

  SELECT *
  INTO existing_membership
  FROM public.workspace_memberships
  WHERE user_id = current_user_id
    AND status = 'active'
  ORDER BY joined_at ASC
  LIMIT 1;

  IF existing_membership.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'existing',
      'workspace_id', existing_membership.workspace_id,
      'role', existing_membership.role::text
    );
  END IF;

  IF current_email <> '' THEN
    SELECT *
    INTO matched_member
    FROM public.team_members
    WHERE lower(coalesce(email, '')) = current_email
    ORDER BY updated_at DESC
    LIMIT 1;
  END IF;

  IF matched_member.id IS NOT NULL THEN
    SELECT *
    INTO target_workspace
    FROM public.workspaces
    WHERE id = matched_member.workspace_id
    LIMIT 1;

    target_role := coalesce(matched_member.privilege_role, 'project_manager'::public.app_role);
    target_title := coalesce(matched_member.role_title, target_title);
  ELSE
    SELECT *
    INTO target_workspace
    FROM public.workspaces
    ORDER BY created_at ASC
    LIMIT 1;

    IF target_workspace.id IS NULL THEN
      RETURN jsonb_build_object(
        'status', 'missing',
        'message', 'No workspace exists yet for this project.'
      );
    END IF;

    SELECT count(*)
    INTO member_count
    FROM public.workspace_memberships
    WHERE workspace_id = target_workspace.id;

    IF member_count > 0 AND target_workspace.created_by IS DISTINCT FROM current_user_id THEN
      RETURN jsonb_build_object(
        'status', 'missing',
        'message', 'No workspace membership matched this account. Ask the workspace owner to link your user first.'
      );
    END IF;
  END IF;

  INSERT INTO public.workspace_memberships (
    workspace_id,
    user_id,
    role,
    status,
    title
  )
  VALUES (
    target_workspace.id,
    current_user_id,
    target_role,
    'active',
    target_title
  )
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE
    SET role = EXCLUDED.role,
        status = 'active',
        title = coalesce(EXCLUDED.title, public.workspace_memberships.title);

  IF matched_member.id IS NOT NULL THEN
    UPDATE public.team_members
    SET user_id = current_user_id
    WHERE id = matched_member.id;
  END IF;

  display_name :=
    nullif(trim(coalesce(matched_member.name, '')), '') ||
    CASE
      WHEN nullif(trim(coalesce(matched_member.name, '')), '') IS NULL
      THEN nullif(trim(coalesce(metadata ->> 'full_name', metadata ->> 'name', '')), '')
      ELSE ''
    END;

  IF display_name IS NULL OR trim(display_name) = '' THEN
    display_name := split_part(current_email, '@', 1);
  END IF;

  INSERT INTO public.profiles (
    user_id,
    display_name,
    department
  )
  VALUES (
    current_user_id,
    display_name,
    matched_member.department
  )
  ON CONFLICT (user_id)
  DO UPDATE
    SET display_name = coalesce(nullif(EXCLUDED.display_name, ''), public.profiles.display_name),
        department = coalesce(EXCLUDED.department, public.profiles.department),
        updated_at = now();

  RETURN jsonb_build_object(
    'status', CASE WHEN matched_member.id IS NOT NULL THEN 'linked' ELSE 'created' END,
    'workspace_id', target_workspace.id,
    'role', target_role::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_workspace_membership() TO authenticated;
