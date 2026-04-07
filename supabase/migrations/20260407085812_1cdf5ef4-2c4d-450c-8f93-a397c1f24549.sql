
-- Fix permissive INSERT policies
DROP POLICY "Projects creatable by authenticated" ON public.projects;
CREATE POLICY "Projects creatable by authenticated" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY "Tasks creatable by authenticated" ON public.tasks;
CREATE POLICY "Tasks creatable by authenticated" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY "Tickets creatable by authenticated" ON public.tickets;
CREATE POLICY "Tickets creatable by authenticated" ON public.tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY "Activity insertable by authenticated" ON public.activity_log;
CREATE POLICY "Activity insertable by authenticated" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
