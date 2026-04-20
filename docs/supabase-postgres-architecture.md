# Supabase + PostgreSQL Architecture Plan

## Current State

The repository already includes a minimal Supabase foundation:

- Auth via `Supabase Auth`
- Client setup in [client.ts](C:/projects/synergi-task/src/integrations/supabase/client.ts)
- Frontend auth hook in [useAuth.ts](C:/projects/synergi-task/src/hooks/useAuth.ts)
- Existing SQL migrations in:
  - [20260407085759_fd0234b9-dabb-43d5-86e6-37c08e2b0db0.sql](C:/projects/synergi-task/supabase/migrations/20260407085759_fd0234b9-dabb-43d5-86e6-37c08e2b0db0.sql)
  - [20260407085812_1cdf5ef4-2c4d-450c-8f93-a397c1f24549.sql](C:/projects/synergi-task/supabase/migrations/20260407085812_1cdf5ef4-2c4d-450c-8f93-a397c1f24549.sql)

The application data itself is still frontend-local in:

- [workspace-store.ts](C:/projects/synergi-task/src/lib/workspace-store.ts)
- [useProjects.ts](C:/projects/synergi-task/src/hooks/useProjects.ts)

So the next production step is to move the workspace domain into Supabase tables and RLS.

## Recommended Database Shape

### Tenant And Access Layer

- `organizations`
- `workspaces`
- `workspace_memberships`
- `profiles`
- `user_roles`
- `team_members`

Purpose:

- support tenant/workspace separation
- map auth users to internal team profiles
- enforce role-based access

### Project Delivery Layer

- `projects`
- `project_members`
- `project_templates`
- `workflows`
- `workflow_stages`
- `tasks`
- `task_dependencies`
- `task_assignments`
- `task_timesheets`
- `tickets`

Purpose:

- Microsoft Project style scheduling
- Notion/task workspace collaboration
- role-aware assignment and workload control

### Collaboration And Meetings

- `chat_channels`
- `chat_channel_members`
- `chat_messages`
- `meetings`
- `meeting_attendees`
- `personal_events`
- `sticky_notes`

Purpose:

- project community
- native internal chat
- linked meeting events
- personal work and calendar data

### Documents And Templates

- `project_documents`
- `document_versions`
- `configurable_options`
- `custom_fields`
- `entity_custom_field_values`

Purpose:

- project document drive
- PMI / SAP template generation
- configurable dropdowns
- admin-defined custom fields

### Reporting And Administration

- `dashboards`
- `report_templates`
- `workspace_integrations`
- `audit_events`

Purpose:

- advanced dashboards
- dynamic reporting
- integration configuration
- enterprise audit trail

## Core Relationship Model

### Identity

- `auth.users` -> `profiles.user_id`
- `auth.users` -> `workspace_memberships.user_id`
- `auth.users` -> `team_members.user_id`

### Tenant Scope

- `organizations` -> many `workspaces`
- `workspaces` -> many `workspace_memberships`
- `workspaces` -> many `projects`
- `workspaces` -> many `team_members`
- `workspaces` -> many `tasks`
- `workspaces` -> many `documents`

### Project Scope

- `projects` -> many `tasks`
- `projects` -> many `tickets`
- `projects` -> many `project_documents`
- `projects` -> many `chat_channels`
- `projects` -> many `meetings`
- `projects` -> many `project_members`

### Task Scope

- `tasks` -> many `task_dependencies`
- `tasks` -> many `task_assignments`
- `tasks` -> many `task_timesheets`

## Permissions Model

### Global Roles

The existing `app_role` enum should support:

- `admin`
- `organization_admin`
- `project_admin`
- `project_manager`
- `team_member`
- `standard_member`
- `guest`

### Access Pattern

- `admin`: global full access
- `organization_admin`: full access inside organization/workspaces they manage
- `project_admin`: project governance, documents, reports, integrations inside workspace
- `project_manager`: manage projects, tasks, schedules, meetings, documents
- `team_member` / `standard_member`: contribute to assigned work and channels
- `guest`: read-only or restricted collaboration access

### RLS Strategy

Use helper functions:

- `is_platform_admin(user_id)`
- `is_workspace_member(workspace_id, user_id)`
- `has_workspace_role(workspace_id, user_id, roles[])`

Then apply them consistently:

- `SELECT`: workspace member or admin
- `INSERT`: workspace member with creator role
- `UPDATE`: owner, assigned contributor, PM, or admin depending on entity
- `DELETE`: project admin / org admin / platform admin

## Integration Model

Use `workspace_integrations` for:

- `outlook`
- `teams`
- `onedrive`
- `whatsapp`
- `google_calendar`

Store:

- provider
- enabled
- connected
- sync mode
- scopes
- tenant/client identifiers
- secure config references
- last sync status

Do not store secret tokens directly in user-editable JSON. Use Supabase secrets or Edge Functions for token exchange/refresh.

## Storage Model

Recommended Supabase Storage buckets:

- `project-documents`
- `avatars`
- `chat-attachments`
- `imports`

Recommended path pattern:

- `project-documents/{workspace_id}/{project_id}/{document_id}/{filename}`
- `avatars/{user_id}/{filename}`
- `chat-attachments/{workspace_id}/{channel_id}/{message_id}/{filename}`

## Migration Plan

### Phase 1

- keep current auth tables and roles
- add workspace, team, workflow, document, meeting, dashboard, audit, and integration tables
- extend `projects`, `tasks`, and `tickets`

### Phase 2

- backfill one default organization/workspace
- map existing profiles and projects into the workspace
- map localStorage export into Supabase import scripts

### Phase 3

- refactor frontend hooks to query Supabase instead of `localStorage`
- keep the current workspace model as a temporary adapter shape

### Phase 4

- move documents to Supabase Storage
- move AI context and reporting to Edge Functions
- turn on stricter RLS for all project entities

## Frontend Refactor Plan

### Keep

- page structure
- shared TypeScript workspace model
- auth flow

### Replace Gradually

- `readWorkspaceData()` -> Supabase query adapters
- `updateWorkspaceData()` -> row-level mutations
- dashboard derived metrics -> SQL views or RPCs where needed

### Best First Refactor Order

1. `profiles`, `workspace_memberships`, `team_members`
2. `projects`
3. `tasks`, `task_dependencies`, `task_timesheets`
4. `tickets`
5. `documents`
6. `chat_channels`, `chat_messages`
7. `meetings`, `personal_events`
8. `settings`, `custom_fields`, `configurable_options`
9. `dashboards`, `reports`, `audit_events`

## Included In Repo

This plan is backed by the new migration blueprint:

- [20260419170000_enterprise_workspace_schema.sql](C:/projects/synergi-task/supabase/migrations/20260419170000_enterprise_workspace_schema.sql)
- [20260419170100_enterprise_workspace_objects.sql](C:/projects/synergi-task/supabase/migrations/20260419170100_enterprise_workspace_objects.sql)

Run them in this order:

1. [20260419170000_enterprise_workspace_schema.sql](C:/projects/synergi-task/supabase/migrations/20260419170000_enterprise_workspace_schema.sql)
2. [20260419170100_enterprise_workspace_objects.sql](C:/projects/synergi-task/supabase/migrations/20260419170100_enterprise_workspace_objects.sql)

The first migration only extends the `app_role` enum, and the second creates the enterprise workspace objects. This split avoids PostgreSQL enum transaction errors when new enum values are used as defaults in the same migration run.
