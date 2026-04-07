
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'project_manager', 'team_member');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'team_member',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on-hold', 'completed', 'at-risk', 'archived')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  owner_id UUID REFERENCES auth.users(id),
  start_date DATE,
  end_date DATE,
  budget NUMERIC,
  risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('high', 'medium', 'low')),
  ai_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Projects viewable by authenticated" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Projects creatable by authenticated" ON public.projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Projects updatable by owner or admin" ON public.projects FOR UPDATE TO authenticated USING (
  auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'project_manager')
);
CREATE POLICY "Projects deletable by owner or admin" ON public.projects FOR DELETE TO authenticated USING (
  auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin')
);

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'todo', 'in-progress', 'review', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  assignee_id UUID REFERENCES auth.users(id),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  due_date DATE,
  tags TEXT[] DEFAULT '{}',
  depends_on UUID[] DEFAULT '{}',
  estimated_hours NUMERIC,
  actual_hours NUMERIC,
  ai_generated BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks viewable by authenticated" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tasks creatable by authenticated" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Tasks updatable by assignee/admin/pm" ON public.tasks FOR UPDATE TO authenticated USING (
  auth.uid() = assignee_id OR auth.uid() = created_by OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'project_manager')
);
CREATE POLICY "Tasks deletable by creator/admin" ON public.tasks FOR DELETE TO authenticated USING (
  auth.uid() = created_by OR public.has_role(auth.uid(), 'admin')
);

-- Agent memory table (stores context, decisions, learnings)
CREATE TABLE public.agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('context', 'preference', 'learning', 'decision')),
  content JSONB NOT NULL,
  relevance_score NUMERIC DEFAULT 1.0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own memory" ON public.agent_memory FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own memory" ON public.agent_memory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own memory" ON public.agent_memory FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Agent decisions audit trail
CREATE TABLE public.agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('task_created', 'task_assigned', 'risk_flagged', 'deadline_adjusted', 'notification_sent', 'plan_generated', 'mitigation_suggested')),
  context JSONB NOT NULL,
  action_taken JSONB NOT NULL,
  confidence NUMERIC DEFAULT 0.8,
  was_overridden BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own decisions" ON public.agent_decisions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System insert decisions" ON public.agent_decisions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Support tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'waiting', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  category TEXT,
  reporter_id UUID REFERENCES auth.users(id),
  assignee_id UUID REFERENCES auth.users(id),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  sla_deadline TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tickets viewable by authenticated" ON public.tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tickets creatable by authenticated" ON public.tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Tickets updatable by assignee/admin" ON public.tickets FOR UPDATE TO authenticated USING (
  auth.uid() = assignee_id OR auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin')
);

-- Comments (polymorphic)
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments viewable by authenticated" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Comments creatable by authenticated" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Comments updatable by author" ON public.comments FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "Comments deletable by author" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- Activity feed
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity viewable by authenticated" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Activity insertable by authenticated" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- Indexes
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_agent_memory_user ON public.agent_memory(user_id);
CREATE INDEX idx_agent_memory_type ON public.agent_memory(memory_type);
CREATE INDEX idx_agent_decisions_user ON public.agent_decisions(user_id);
CREATE INDEX idx_activity_entity ON public.activity_log(entity_type, entity_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_comments_task ON public.comments(task_id);

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply timestamp triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'team_member');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS for user_roles
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
