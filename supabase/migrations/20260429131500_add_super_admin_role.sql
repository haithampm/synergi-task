-- Add super_admin as the highest workspace/database role.
--
-- After deploying this migration, grant it from Supabase SQL Editor with:
--   select public.grant_workspace_privileges_by_email_text('<user-email>', 'super_admin');

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'super_admin') OR
    public.has_role(_user_id, 'admin') OR
    public.has_role(_user_id, 'organization_admin')
$$;

CREATE OR REPLACE FUNCTION public.grant_workspace_privileges_by_email_text(
  target_email TEXT,
  target_role TEXT DEFAULT 'project_manager'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_user_id UUID;
  normalized_role public.app_role;
  updated_memberships INTEGER := 0;
BEGIN
  IF target_role NOT IN ('super_admin', 'admin', 'organization_admin', 'project_admin', 'project_manager', 'team_member', 'standard_member', 'guest') THEN
    RETURN 'Invalid role. Use super_admin, admin, organization_admin, project_admin, project_manager, team_member, standard_member, or guest.';
  END IF;

  normalized_role := target_role::public.app_role;

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
  VALUES (target_user_id, normalized_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.workspace_memberships
  SET role = normalized_role,
      status = 'active'
  WHERE user_id = target_user_id;

  GET DIAGNOSTICS updated_memberships = ROW_COUNT;

  RETURN 'Privilege granted. Updated memberships: ' || updated_memberships::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_workspace_privileges_by_email_text(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_workspace_privileges_by_email_text(TEXT, TEXT) TO authenticated;
