-- Helper for granting database roles needed by workspace administration/import flows.
--
-- Usage after deploying this migration, from Supabase SQL Editor as an admin:
--   select public.grant_workspace_privileges_by_email('<user-email>', 'project_manager');
--   select public.grant_workspace_privileges_by_email('<user-email>', 'admin');
--
-- Supported roles are defined by public.app_role: admin, project_manager, team_member.
-- The function also activates existing workspace memberships for the selected user.

CREATE OR REPLACE FUNCTION public.grant_workspace_privileges_by_email(
  target_email TEXT,
  target_role public.app_role DEFAULT 'project_manager'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_user_id UUID;
  updated_memberships INTEGER := 0;
BEGIN
  SELECT id
  INTO target_user_id
  FROM auth.users
  WHERE lower(email) = lower(target_email)
  ORDER BY created_at DESC
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RETURN 'No auth user found for the provided email.';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, target_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.workspace_memberships
  SET role = target_role,
      status = 'active'
  WHERE user_id = target_user_id;

  GET DIAGNOSTICS updated_memberships = ROW_COUNT;

  RETURN 'Privilege granted. Updated memberships: ' || updated_memberships::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_workspace_privileges_by_email(TEXT, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_workspace_privileges_by_email(TEXT, public.app_role) TO authenticated;
