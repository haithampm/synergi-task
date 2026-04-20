DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'channel_kind' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.channel_kind AS ENUM ('general', 'deliverables', 'announcements', 'support');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_provider' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.integration_provider AS ENUM ('outlook', 'teams', 'onedrive', 'whatsapp', 'google_calendar');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_sync_mode' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.integration_sync_mode AS ENUM ('read', 'write', 'two-way');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_review_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.document_review_status AS ENUM ('draft', 'in-review', 'approved', 'signed');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_output_format' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.document_output_format AS ENUM ('doc', 'xlsx', 'pdf', 'txt');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custom_field_entity' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.custom_field_entity AS ENUM ('project', 'task', 'team_member', 'ticket');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  portfolio_office TEXT,
  branding JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ms_project_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workspace_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'standard_member',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  title TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  role_title TEXT,
  department TEXT,
  privilege_role public.app_role NOT NULL DEFAULT 'team_member',
  capacity_hours NUMERIC NOT NULL DEFAULT 40,
  utilization_target NUMERIC NOT NULL DEFAULT 85,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'task', 'ticket')),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS namespace TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS project_nature TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_field_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS radar_lifecycle JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phase TEXT,
  ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS workload_hours NUMERIC,
  ADD COLUMN IF NOT EXISTS duration_days NUMERIC,
  ADD COLUMN IF NOT EXISTS custom_field_values JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_field_values JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  predecessor_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start',
  lag_days NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (task_id, predecessor_task_id, dependency_type)
);
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.task_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  team_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  hours NUMERIC NOT NULL DEFAULT 0,
  activity TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_timesheets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  folder TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('template', 'attachment')),
  review_status public.document_review_status NOT NULL DEFAULT 'draft',
  output_format public.document_output_format NOT NULL DEFAULT 'doc',
  provider TEXT NOT NULL DEFAULT 'workspace',
  external_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  content TEXT,
  generated_by_ai BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  topic TEXT,
  kind public.channel_kind NOT NULL DEFAULT 'general',
  read_only BOOLEAN NOT NULL DEFAULT false,
  whatsapp_group_url TEXT,
  quick_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  parent_message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  mentions TEXT[] NOT NULL DEFAULT '{}'::text[],
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES public.chat_channels(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'workspace',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  join_url TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.personal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'personal',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.sticky_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'amber',
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type public.custom_field_entity NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (workspace_id, entity_type, field_key)
);
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  layout JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.workspace_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider public.integration_provider NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  connected BOOLEAN NOT NULL DEFAULT false,
  sync_mode public.integration_sync_mode NOT NULL DEFAULT 'read',
  status TEXT NOT NULL DEFAULT 'not-connected',
  last_sync_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}'::text[],
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (workspace_id, provider)
);
ALTER TABLE public.workspace_integrations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  detail TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'organization_admin') $$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _workspace_id IS NULL OR public.is_platform_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.workspace_memberships wm
    WHERE wm.workspace_id = _workspace_id AND wm.user_id = _user_id AND wm.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(_workspace_id UUID, _user_id UUID, _roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.workspace_memberships wm
    WHERE wm.workspace_id = _workspace_id
      AND wm.user_id = _user_id
      AND wm.status = 'active'
      AND wm.role::text = ANY(_roles)
  )
$$;

DROP POLICY IF EXISTS "Projects viewable by authenticated" ON public.projects;
DROP POLICY IF EXISTS "Projects creatable by authenticated" ON public.projects;
DROP POLICY IF EXISTS "Projects updatable by owner or admin" ON public.projects;
DROP POLICY IF EXISTS "Projects deletable by owner or admin" ON public.projects;

CREATE POLICY "Projects viewable by workspace members" ON public.projects
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Projects managed by workspace leads" ON public.projects
  FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']));

DROP POLICY IF EXISTS "Tasks viewable by authenticated" ON public.tasks;
DROP POLICY IF EXISTS "Tasks creatable by authenticated" ON public.tasks;
DROP POLICY IF EXISTS "Tasks updatable by assignee/admin/pm" ON public.tasks;
DROP POLICY IF EXISTS "Tasks deletable by creator/admin" ON public.tasks;

CREATE POLICY "Tasks viewable by workspace members" ON public.tasks
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Tasks writable by contributors and managers" ON public.tasks
  FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager', 'team_member', 'standard_member']))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager', 'team_member', 'standard_member']));

DROP POLICY IF EXISTS "Tickets viewable by authenticated" ON public.tickets;
DROP POLICY IF EXISTS "Tickets creatable by authenticated" ON public.tickets;
DROP POLICY IF EXISTS "Tickets updatable by assignee/admin" ON public.tickets;

CREATE POLICY "Tickets viewable by workspace members" ON public.tickets
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Tickets writable by contributors and managers" ON public.tickets
  FOR ALL TO authenticated
  USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager', 'team_member', 'standard_member']))
  WITH CHECK (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager', 'team_member', 'standard_member']));

DROP POLICY IF EXISTS "Workspace tables readable by members" ON public.workspaces;
DROP POLICY IF EXISTS "Workspace memberships readable by members" ON public.workspace_memberships;
DROP POLICY IF EXISTS "Team members readable by members" ON public.team_members;
DROP POLICY IF EXISTS "Documents readable by members" ON public.project_documents;
DROP POLICY IF EXISTS "Channels readable by members" ON public.chat_channels;
DROP POLICY IF EXISTS "Messages readable by members" ON public.chat_messages;
DROP POLICY IF EXISTS "Meetings readable by members" ON public.meetings;
DROP POLICY IF EXISTS "Sticky notes readable by owner or admins" ON public.sticky_notes;
DROP POLICY IF EXISTS "Integrations readable by admins" ON public.workspace_integrations;
DROP POLICY IF EXISTS "Audit readable by workspace leads" ON public.audit_events;

CREATE POLICY "Workspace tables readable by members" ON public.workspaces
  FOR SELECT TO authenticated USING (public.is_workspace_member(id, auth.uid()));
CREATE POLICY "Workspace memberships readable by members" ON public.workspace_memberships
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()) OR auth.uid() = user_id);
CREATE POLICY "Team members readable by members" ON public.team_members
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Documents readable by members" ON public.project_documents
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Channels readable by members" ON public.chat_channels
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Messages readable by members" ON public.chat_messages
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.id = channel_id AND public.is_workspace_member(c.workspace_id, auth.uid())));
CREATE POLICY "Meetings readable by members" ON public.meetings
  FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Sticky notes readable by owner or admins" ON public.sticky_notes
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']));
CREATE POLICY "Integrations readable by admins" ON public.workspace_integrations
  FOR SELECT TO authenticated USING (public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin']));
CREATE POLICY "Audit readable by workspace leads" ON public.audit_events
  FOR SELECT TO authenticated USING (workspace_id IS NULL OR public.has_workspace_role(workspace_id, auth.uid(), ARRAY['admin', 'organization_admin', 'project_admin', 'project_manager']));

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_workspace_user ON public.workspace_memberships(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tickets_workspace ON public.tickets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_workspace_project ON public.project_documents(workspace_id, project_id);
CREATE INDEX IF NOT EXISTS idx_chat_channels_workspace_project ON public.chat_channels(workspace_id, project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_workspace_project ON public.meetings(workspace_id, project_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_workspace_created_at ON public.audit_events(workspace_id, created_at DESC);
