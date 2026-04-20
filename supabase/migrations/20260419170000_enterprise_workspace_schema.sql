-- Phase 1 enterprise workspace schema for Synergi Task

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'organization_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'project_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'standard_member';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'guest';
