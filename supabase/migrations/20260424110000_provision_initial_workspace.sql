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
  linked_member public.team_members%ROWTYPE;
  target_workspace public.workspaces%ROWTYPE;
  target_organization public.organizations%ROWTYPE;
  existing_profile public.profiles%ROWTYPE;
  target_role public.app_role := 'project_manager';
  target_title text := 'Workspace Member';
  member_count bigint := 0;
  display_name text := null;
  slug_base text := null;
  org_name text := null;
  workspace_name text := null;
  org_slug text := null;
  workspace_slug text := null;
  resolved_profile_id uuid := null;
  created_workspace boolean := false;
  role_metadata jsonb := '{}'::jsonb;
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

  SELECT *
  INTO existing_profile
  FROM public.profiles
  WHERE user_id = current_user_id
  LIMIT 1;

  IF current_email <> '' THEN
    SELECT *
    INTO matched_member
    FROM public.team_members
    WHERE lower(coalesce(email, '')) = current_email
    ORDER BY updated_at DESC
    LIMIT 1;
  END IF;

  display_name := coalesce(
    nullif(trim(coalesce(matched_member.name, '')), ''),
    nullif(trim(coalesce(existing_profile.display_name, '')), ''),
    nullif(trim(coalesce(metadata ->> 'full_name', metadata ->> 'name', '')), ''),
    nullif(trim(split_part(current_email, '@', 1)), ''),
    'Workspace Admin'
  );

  slug_base := trim(both '-' from regexp_replace(lower(display_name), '[^a-z0-9]+', '-', 'g'));
  IF slug_base IS NULL OR slug_base = '' THEN
    slug_base := 'workspace';
  END IF;

  org_name := display_name || ' Organization';
  workspace_name := display_name || ' Workspace';

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
      created_workspace := true;
      target_role := 'organization_admin';
      target_title := 'Workspace Owner';
      org_slug := left(slug_base || '-org-' || substring(replace(current_user_id::text, '-', '') from 1 for 8), 120);
      workspace_slug := left(slug_base || '-workspace-' || substring(replace(current_user_id::text, '-', '') from 1 for 8), 120);

      INSERT INTO public.organizations (
        name,
        slug,
        timezone,
        created_by
      )
      VALUES (
        org_name,
        org_slug,
        'Asia/Riyadh',
        current_user_id
      )
      RETURNING *
      INTO target_organization;

      INSERT INTO public.workspaces (
        organization_id,
        name,
        slug,
        portfolio_office,
        branding,
        created_by
      )
      VALUES (
        target_organization.id,
        workspace_name,
        workspace_slug,
        'PMO',
        jsonb_build_object(
          'appName', 'Synergi Task',
          'homeLabel', 'Dashboard',
          'createdBy', display_name
        ),
        current_user_id
      )
      RETURNING *
      INTO target_workspace;
    ELSE
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

  INSERT INTO public.profiles (
    user_id,
    display_name,
    department
  )
  VALUES (
    current_user_id,
    display_name,
    coalesce(matched_member.department, existing_profile.department)
  )
  ON CONFLICT (user_id)
  DO UPDATE
    SET display_name = coalesce(nullif(EXCLUDED.display_name, ''), public.profiles.display_name),
        department = coalesce(EXCLUDED.department, public.profiles.department),
        updated_at = now()
  RETURNING id
  INTO resolved_profile_id;

  role_metadata := jsonb_build_object(
    'status', 'online',
    'avatarColor', 'gradient-primary',
    'assignedProjectIds', '[]'::jsonb,
    'customFieldValues', '{}'::jsonb
  );

  IF matched_member.id IS NOT NULL THEN
    UPDATE public.team_members
    SET user_id = current_user_id,
        profile_id = resolved_profile_id,
        name = display_name,
        email = CASE WHEN current_email <> '' THEN current_email ELSE public.team_members.email END,
        role_title = coalesce(public.team_members.role_title, target_title),
        privilege_role = coalesce(public.team_members.privilege_role, target_role),
        metadata = public.team_members.metadata || role_metadata,
        updated_at = now()
    WHERE id = matched_member.id;
  ELSE
    SELECT *
    INTO linked_member
    FROM public.team_members
    WHERE workspace_id = target_workspace.id
      AND (
        user_id = current_user_id
        OR (current_email <> '' AND lower(coalesce(email, '')) = current_email)
      )
    ORDER BY updated_at DESC
    LIMIT 1;

    IF linked_member.id IS NOT NULL THEN
      UPDATE public.team_members
      SET user_id = current_user_id,
          profile_id = resolved_profile_id,
          name = display_name,
          email = CASE WHEN current_email <> '' THEN current_email ELSE public.team_members.email END,
          role_title = coalesce(public.team_members.role_title, target_title),
          privilege_role = coalesce(public.team_members.privilege_role, target_role),
          metadata = public.team_members.metadata || role_metadata,
          updated_at = now()
      WHERE id = linked_member.id;
    ELSE
      INSERT INTO public.team_members (
        workspace_id,
        user_id,
        profile_id,
        name,
        email,
        role_title,
        department,
        privilege_role,
        metadata
      )
      VALUES (
        target_workspace.id,
        current_user_id,
        resolved_profile_id,
        display_name,
        nullif(current_email, ''),
        target_title,
        coalesce(existing_profile.department, matched_member.department),
        target_role,
        role_metadata
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', CASE WHEN matched_member.id IS NOT NULL THEN 'linked' ELSE 'created' END,
    'workspace_id', target_workspace.id,
    'role', target_role::text,
    'message',
      CASE
        WHEN created_workspace THEN 'Created the initial organization, workspace, and membership for this production environment.'
        ELSE NULL
      END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_workspace_membership() TO authenticated;
