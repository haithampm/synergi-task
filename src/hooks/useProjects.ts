import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  makeId,
  readWorkspaceData,
  updateWorkspaceData,
  type WorkspaceChatChannel,
  type WorkspaceDashboard,
  type WorkspaceData,
  type WorkspaceAuditLog,
  type WorkspaceMeeting,
  type WorkspacePersonalEvent,
  type WorkspaceProject,
  type WorkspaceProjectTemplate,
  type WorkspaceReportTemplate,
  type WorkspaceSettings,
  type WorkspaceStickyNote,
  type WorkspaceTask,
  type WorkspaceTeamMember,
  type WorkspaceTicket,
  type WorkspaceUserAccount,
  type WorkspaceWorkflow,
} from "@/lib/workspace-store";
import { buildDashboardWidgets } from "@/lib/dashboard-widgets";
import { applyRadarRowsToWorkspace, type RadarImportRow } from "@/lib/radar-import";
import {
  checkSupabaseConnection,
  deleteRemoteStickyNote,
  deleteRemoteProject,
  deleteRemoteTask,
  fetchMergedMeetings,
  fetchMergedPersonalEvents,
  fetchMergedProjects,
  fetchMergedStickyNotes,
  fetchMergedTasks,
  fetchMergedTeamMembers,
  generatePersistentEntityId,
  isSupabaseReady,
  mergeSettingsWithRemoteContext,
  syncProfileFromSettings,
  upsertRemoteMeeting,
  upsertRemotePersonalEvent,
  upsertRemoteProject,
  upsertRemoteProjectDocuments,
  upsertRemoteStickyNote,
  upsertRemoteTask,
  upsertRemoteTeamMember,
} from "@/integrations/supabase/workspace-data";

export const workspaceKeys = {
  connection: ["supabase-connection"] as const,
  projects: ["projects"] as const,
  tasks: (projectId?: string) => ["tasks", projectId ?? "all"] as const,
  tickets: ["tickets"] as const,
  team: ["team-members"] as const,
  users: ["user-accounts"] as const,
  stickyNotes: ["sticky-notes"] as const,
  meetings: ["meetings"] as const,
  personalEvents: ["personal-events"] as const,
  settings: ["workspace-settings"] as const,
  chat: ["chat-channels"] as const,
  workflows: ["workflows"] as const,
  dashboards: ["dashboards"] as const,
  reports: ["report-templates"] as const,
  templates: ["project-templates"] as const,
  audit: ["audit-logs"] as const,
  dashboard: ["dashboard-stats"] as const,
};

const liveSyncOptions = isSupabaseReady()
  ? ({
      refetchOnWindowFocus: true,
      refetchInterval: 30_000,
    } as const)
  : ({
      refetchOnWindowFocus: false,
    } as const);

export const invalidateWorkspace = (qc: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: workspaceKeys.projects }),
    qc.invalidateQueries({ queryKey: ["tasks"] }),
    qc.invalidateQueries({ queryKey: workspaceKeys.tickets }),
    qc.invalidateQueries({ queryKey: workspaceKeys.team }),
    qc.invalidateQueries({ queryKey: workspaceKeys.users }),
    qc.invalidateQueries({ queryKey: workspaceKeys.stickyNotes }),
    qc.invalidateQueries({ queryKey: workspaceKeys.meetings }),
    qc.invalidateQueries({ queryKey: workspaceKeys.personalEvents }),
    qc.invalidateQueries({ queryKey: workspaceKeys.settings }),
    qc.invalidateQueries({ queryKey: workspaceKeys.chat }),
    qc.invalidateQueries({ queryKey: workspaceKeys.workflows }),
    qc.invalidateQueries({ queryKey: workspaceKeys.dashboards }),
    qc.invalidateQueries({ queryKey: workspaceKeys.reports }),
    qc.invalidateQueries({ queryKey: workspaceKeys.templates }),
    qc.invalidateQueries({ queryKey: workspaceKeys.audit }),
    qc.invalidateQueries({ queryKey: workspaceKeys.dashboard }),
  ]);

const normalizeTask = (task: WorkspaceTask, projects: WorkspaceProject[]): WorkspaceTask => {
  const project = projects.find((item) => item.id === (task.project_id ?? task.projectId));
  const dueDate = task.due_date ?? task.dueDate;
  const startDate = task.start_date ?? project?.start_date ?? project?.startDate;

  return {
    ...task,
    project_id: task.project_id ?? task.projectId,
    projectId: task.projectId ?? task.project_id ?? "",
    projectName: task.projectName ?? project?.name ?? "Unassigned",
    due_date: dueDate,
    dueDate,
    start_date: startDate,
    workloadHours: task.workloadHours ?? Math.max(8, (Number.parseInt(String(task.duration ?? "3d").replace("d", ""), 10) || 3) * 8),
  };
};

const recalcProjects = (projects: WorkspaceProject[], tasks: WorkspaceTask[]) =>
  projects.map((project) => {
    const projectTasks = tasks.filter((task) => (task.project_id ?? task.projectId) === project.id);
    const completed = projectTasks.filter((task) => task.status === "done").length;
    const total = projectTasks.length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : project.progress;
    const starts = projectTasks.map((task) => task.start_date ?? task.due_date).filter(Boolean) as string[];
    const ends = projectTasks.map((task) => task.end_date ?? task.due_date).filter(Boolean) as string[];

    return {
      ...project,
      tasksTotal: total,
      tasksCompleted: completed,
      progress,
      start_date: starts.sort()[0] ?? project.start_date ?? project.startDate,
      end_date: ends.sort().slice(-1)[0] ?? project.end_date ?? project.endDate,
      startDate: starts.sort()[0] ?? project.start_date ?? project.startDate,
      endDate: ends.sort().slice(-1)[0] ?? project.end_date ?? project.endDate,
    };
  });

const getAuditActorName = (current: WorkspaceData) =>
  current.settings.currentUser.displayName?.trim() || current.settings.profile.email || "Workspace User";

const appendAuditLog = (
  current: WorkspaceData,
  entry: Omit<WorkspaceAuditLog, "id" | "createdAt" | "actorName"> & { actorName?: string },
): WorkspaceData => ({
  ...current,
  auditLogs: [
    {
      id: makeId("audit"),
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorName: entry.actorName ?? getAuditActorName(current),
      detail: entry.detail,
      createdAt: new Date().toISOString(),
    },
    ...current.auditLogs,
  ].slice(0, 300),
});

const summarizeUpdatedFields = (updates: Record<string, unknown>) => {
  const ignoredKeys = new Set(["id"]);
  const labels: Record<string, string> = {
    name: "name",
    title: "title",
    description: "description",
    status: "status",
    progress: "progress",
    priority: "priority",
    assignee: "assignee",
    due_date: "due date",
    dueDate: "due date",
    start_date: "start date",
    end_date: "end date",
    department: "department",
    budget: "budget",
    projectNature: "project nature",
    team: "team",
    resources: "resources",
    teamStructure: "team structure",
    stakeholders: "stakeholders",
    risks: "risks",
    documents: "documents",
    comments: "comments",
    timesheetEntries: "timesheets",
    metadata: "metadata",
    customFields: "custom fields",
    privilegeRoles: "privilege roles",
    integrations: "integrations",
    profile: "profile",
    currentUser: "current user",
    appearance: "appearance",
    notifications: "notifications",
    ai: "AI settings",
    msProject: "MS Project settings",
  };

  const fields = Object.keys(updates)
    .filter((key) => !ignoredKeys.has(key) && updates[key] !== undefined)
    .map((key) => labels[key] ?? key)
    .slice(0, 6);

  if (!fields.length) return "record details";
  if (fields.length === 1) return fields[0];
  return `${fields.slice(0, -1).join(", ")} and ${fields.at(-1)}`;
};

export function useProjects() {
  return useQuery({
    queryKey: workspaceKeys.projects,
    queryFn: async () => fetchMergedProjects(),
    ...liveSyncOptions,
  });
}

export function useTasks(projectId?: string) {
  return useQuery({
    queryKey: workspaceKeys.tasks(projectId),
    queryFn: async () => {
      const merged = await fetchMergedTasks(projectId);
      const projects = await fetchMergedProjects();
      const normalized = merged.map((task) => normalizeTask(task, projects));
      return projectId ? normalized.filter((task) => task.project_id === projectId) : normalized;
    },
    ...liveSyncOptions,
  });
}

export function useTickets() {
  return useQuery({
    queryKey: workspaceKeys.tickets,
    queryFn: async () => readWorkspaceData().tickets,
  });
}

export function useTeamMembers() {
  return useQuery({
    queryKey: workspaceKeys.team,
    queryFn: async () => fetchMergedTeamMembers(),
    ...liveSyncOptions,
  });
}

export function useWorkspaceSettings() {
  return useQuery({
    queryKey: workspaceKeys.settings,
    queryFn: async () => mergeSettingsWithRemoteContext(readWorkspaceData().settings),
    ...liveSyncOptions,
  });
}

export function useUserAccounts() {
  return useQuery({
    queryKey: workspaceKeys.users,
    queryFn: async () => readWorkspaceData().userAccounts,
  });
}

export function useStickyNotes() {
  return useQuery({
    queryKey: workspaceKeys.stickyNotes,
    queryFn: async () => fetchMergedStickyNotes(),
    ...liveSyncOptions,
  });
}

export function useMeetings(projectId?: string) {
  return useQuery({
    queryKey: [...workspaceKeys.meetings, projectId ?? "all"] as const,
    queryFn: async () => fetchMergedMeetings(projectId),
    ...liveSyncOptions,
  });
}

export function usePersonalEvents(memberId?: string) {
  return useQuery({
    queryKey: [...workspaceKeys.personalEvents, memberId ?? "all"] as const,
    queryFn: async () => {
      const events = await fetchMergedPersonalEvents();
      return memberId ? events.filter((event) => event.memberId === memberId) : events;
    },
    ...liveSyncOptions,
  });
}

export function useDatabaseConnection() {
  return useQuery({
    queryKey: workspaceKeys.connection,
    queryFn: checkSupabaseConnection,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
}

export function useChatChannels() {
  return useQuery({
    queryKey: workspaceKeys.chat,
    queryFn: async () => readWorkspaceData().chatChannels,
  });
}

export function useWorkflows() {
  return useQuery({
    queryKey: workspaceKeys.workflows,
    queryFn: async () => readWorkspaceData().workflows,
  });
}

export function useDashboards() {
  return useQuery({
    queryKey: workspaceKeys.dashboards,
    queryFn: async () => readWorkspaceData().dashboards,
  });
}

export function useReportTemplates() {
  return useQuery({
    queryKey: workspaceKeys.reports,
    queryFn: async () => readWorkspaceData().reportTemplates,
  });
}

export function useProjectTemplates() {
  return useQuery({
    queryKey: workspaceKeys.templates,
    queryFn: async () => readWorkspaceData().projectTemplates,
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: workspaceKeys.audit,
    queryFn: async () => readWorkspaceData().auditLogs,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: workspaceKeys.dashboard,
    queryFn: async () => {
      const local = readWorkspaceData();
      const projects = await fetchMergedProjects();
      const tasks = await fetchMergedTasks();
      const teamMembers = await fetchMergedTeamMembers();
      const meetings = await fetchMergedMeetings();
      const { tickets, chatChannels, workflows, dashboards } = local;
      const settings = await mergeSettingsWithRemoteContext(local.settings);
      const normalizedTasks = tasks.map((task) => normalizeTask(task, projects));
      const overdueTasks = normalizedTasks.filter(
        (task) => task.due_date && new Date(task.due_date) < new Date() && task.status !== "done",
      );
      const totalCapacity = teamMembers.reduce((sum, member) => sum + (member.capacityHours ?? 40), 0);
      const assignedHours = normalizedTasks.reduce((sum, task) => sum + (task.workloadHours ?? 0), 0);
      const activeWorkflow = workflows[0];
      const defaultDashboard = dashboards.find((dashboard) => dashboard.isDefault) ?? dashboards[0];

      return {
        totalProjects: projects.length,
        activeProjects: projects.filter((project) => project.status === "active").length,
        totalTasks: normalizedTasks.length,
        completedTasks: normalizedTasks.filter((task) => task.status === "done").length,
        overdueTasks: overdueTasks.length,
        openTickets: tickets.filter((ticket) => ticket.status === "open").length,
        scheduledMeetings: meetings.filter((meeting) => meeting.status === "scheduled").length,
        teamSize: teamMembers.length,
        totalCapacity,
        assignedHours,
        utilizationPct: totalCapacity > 0 ? Math.round((assignedHours / totalCapacity) * 100) : 0,
        projects,
        tasks: normalizedTasks,
        tickets,
        meetings,
        chatChannels,
        workflows,
        dashboards,
        settings,
        defaultDashboard,
        activeWorkflow,
        tasksByStatus: {
          backlog: normalizedTasks.filter((task) => task.status === "backlog").length,
          todo: normalizedTasks.filter((task) => task.status === "todo").length,
          "in-progress": normalizedTasks.filter((task) => task.status === "in-progress").length,
          review: normalizedTasks.filter((task) => task.status === "review").length,
          done: normalizedTasks.filter((task) => task.status === "done").length,
        },
      };
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (project: Partial<WorkspaceProject> & { name: string }) => {
      const nextId = isSupabaseReady() ? generatePersistentEntityId("project") : makeId("project");
      const created = updateWorkspaceData((current) => {
        const record: WorkspaceProject = {
          id: nextId,
          name: project.name,
          description: project.description ?? "",
          status: (project.status as WorkspaceProject["status"]) ?? "active",
          progress: project.progress ?? 0,
          team: project.team ?? [],
          startDate: project.startDate ?? project.start_date ?? new Date().toISOString().slice(0, 10),
          endDate: project.endDate ?? project.end_date ?? "",
          tasksTotal: 0,
          tasksCompleted: 0,
          priority: (project.priority as WorkspaceProject["priority"]) ?? "medium",
          start_date: project.start_date ?? project.startDate,
          end_date: project.end_date ?? project.endDate,
          budget: project.budget ?? "",
          department: project.department ?? "",
          projectNature: project.projectNature ?? "",
          tags: project.tags ?? [],
          milestones: project.milestones ?? [],
          resources: project.resources ?? [],
          teamStructure: project.teamStructure ?? [],
          stakeholders: project.stakeholders ?? [],
          risks: project.risks ?? [],
          documents: project.documents ?? [],
          files: project.files ?? [],
          customFieldValues: project.customFieldValues ?? {},
          risk_level: project.risk_level ?? "medium",
          namespace: project.namespace ?? current.settings.namespace.slug,
          workflowId: project.workflowId ?? current.workflows.find((workflow) => workflow.entity === "task")?.id,
        };

        return appendAuditLog(
          { ...current, projects: [record, ...current.projects] },
          {
            action: "Project created",
            entityType: "project",
            entityId: record.id,
            detail: `${record.name} was created in ${record.namespace}.`,
          },
        );
      }).projects[0];

      try {
        await upsertRemoteProject(created);
        await upsertRemoteProjectDocuments(created.id, created.documents ?? []);
      } catch (error) {
        toast.error("Supabase project sync skipped", error);
      }

      return created;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceProject> & { id: string }) => {
      const updated = updateWorkspaceData((current) => {
        const existing = current.projects.find((project) => project.id === id);
        if (!existing) return current;

        const nextProjects = current.projects.map((project) => {
          if (project.id !== id) return project;
          const next = { ...project, ...updates };
          return {
            ...next,
            startDate: next.startDate ?? next.start_date ?? project.startDate,
            endDate: next.endDate ?? next.end_date ?? project.endDate,
            start_date: next.start_date ?? next.startDate ?? project.start_date,
            end_date: next.end_date ?? next.endDate ?? project.end_date,
          };
        });

        return appendAuditLog(
          { ...current, projects: nextProjects },
          {
            action: "Project updated",
            entityType: "project",
            entityId: id,
            detail: `${updates.name ?? existing.name} was updated: ${summarizeUpdatedFields(updates)}.`,
          },
        );
      }).projects.find((project) => project.id === id);

      if (updated) {
        try {
          await upsertRemoteProject(updated);
          await upsertRemoteProjectDocuments(updated.id, updated.documents ?? []);
        } catch (error) {
          toast.error("Supabase project update skipped", error);
        }
      }

      return updated;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const deleted = updateWorkspaceData((current) => {
        const existing = current.projects.find((project) => project.id === id);
        const next = {
          ...current,
          projects: current.projects.filter((project) => project.id !== id),
          tasks: current.tasks.filter((task) => (task.project_id ?? task.projectId) !== id),
          tickets: current.tickets.filter((ticket) => ticket.projectId !== id),
        };

        return existing
          ? appendAuditLog(next, {
              action: "Project deleted",
              entityType: "project",
              entityId: id,
              detail: `${existing.name} and its linked tasks and tickets were removed.`,
            })
          : next;
      });

      try {
        await deleteRemoteProject(id);
      } catch (error) {
        toast.error("Supabase project delete skipped", error);
      }

      return deleted;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (task: Partial<WorkspaceTask> & { title: string }) => {
      const nextId = isSupabaseReady() ? generatePersistentEntityId("task") : makeId("task");
      const created = updateWorkspaceData((current) => {
        const project = current.projects.find((item) => item.id === (task.project_id ?? task.projectId));
        const dueDate = task.due_date ?? task.dueDate ?? "";
        const record: WorkspaceTask = {
          id: nextId,
          title: task.title,
          description: task.description ?? "",
          status: (task.status as WorkspaceTask["status"]) ?? "todo",
          priority: (task.priority as WorkspaceTask["priority"]) ?? "medium",
          assignee: task.assignee ?? "",
          project_id: task.project_id ?? task.projectId ?? "",
          projectId: task.projectId ?? task.project_id ?? "",
          projectName: project?.name ?? "Unassigned",
          due_date: dueDate,
          dueDate,
          tags: task.tags ?? [],
          phase: task.phase ?? "Execution",
          parentTaskId: task.parentTaskId,
          progress: task.progress ?? 0,
          isMilestone: task.isMilestone ?? false,
          start_date: task.start_date ?? project?.start_date,
          end_date: task.end_date ?? dueDate,
          predecessors: task.predecessors ?? [],
          assignees: task.assignees ?? [],
          comments: task.comments ?? [],
          files: task.files ?? [],
          duration: task.duration ?? "3d",
          workloadHours: task.workloadHours ?? 24,
          workflowStage: task.workflowStage ?? task.status ?? "todo",
          timesheetEntries: task.timesheetEntries ?? [],
          customFieldValues: task.customFieldValues ?? {},
        };

        const nextTasks = [record, ...current.tasks];
        return appendAuditLog(
          { ...current, tasks: nextTasks, projects: recalcProjects(current.projects, nextTasks) },
          {
            action: "Task created",
            entityType: "task",
            entityId: record.id,
            detail: `${record.title} was created for ${record.projectName || "the workspace"} in ${record.phase}.`,
          },
        );
      }).tasks[0];

      try {
        await upsertRemoteTask(created);
      } catch (error) {
        toast.error(`Task save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }

      return created;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceTask> & { id: string }) => {
      const updated = updateWorkspaceData((current) => {
        const existing = current.tasks.find((task) => task.id === id);
        if (!existing) return current;

        const nextTasks = current.tasks.map((task) => {
          if (task.id !== id) return task;
          const projectId = updates.project_id ?? updates.projectId ?? task.project_id ?? task.projectId;
          const project = current.projects.find((item) => item.id === projectId);
          const dueDate = updates.due_date ?? updates.dueDate ?? task.due_date ?? task.dueDate;
          return {
            ...task,
            ...updates,
            project_id: projectId,
            projectId,
            projectName: updates.projectName ?? project?.name ?? task.projectName,
            due_date: dueDate,
            dueDate,
            parentTaskId: updates.parentTaskId ?? task.parentTaskId,
            workloadHours: updates.workloadHours ?? task.workloadHours,
            timesheetEntries: updates.timesheetEntries ?? task.timesheetEntries ?? [],
          };
        });

        return appendAuditLog(
          {
            ...current,
            tasks: nextTasks,
            projects: recalcProjects(current.projects, nextTasks),
          },
          {
            action: "Task updated",
            entityType: "task",
            entityId: id,
            detail: `${updates.title ?? existing.title} was updated: ${summarizeUpdatedFields(updates)}.`,
          },
        );
      }).tasks.find((task) => task.id === id);

      if (updated) {
        try {
          await upsertRemoteTask(updated);
        } catch (error) {
          toast.error(`Task update failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }

      return updated;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const deleted = updateWorkspaceData((current) => {
        const existing = current.tasks.find((task) => task.id === id);
        const nextTasks = current.tasks.filter((task) => task.id !== id);
        const next = {
          ...current,
          tasks: nextTasks,
          tickets: current.tickets.filter((ticket) => ticket.taskId !== id),
          projects: recalcProjects(current.projects, nextTasks),
        };

        return existing
          ? appendAuditLog(next, {
              action: "Task deleted",
              entityType: "task",
              entityId: id,
              detail: `${existing.title} and linked ticket references were removed.`,
            })
          : next;
      });

      try {
        await deleteRemoteTask(id);
      } catch (error) {
        toast.error("Supabase task delete skipped", error);
      }

      return deleted;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateTeamMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (member: Partial<WorkspaceTeamMember> & { name: string }) => {
      const nextId = isSupabaseReady() ? generatePersistentEntityId("member") : makeId("member");
      const created = updateWorkspaceData((current) => {
        const initials = member.name
          .split(" ")
          .map((part) => part[0]?.toUpperCase() ?? "")
          .join("")
          .slice(0, 2);

        const record: WorkspaceTeamMember = {
          id: nextId,
          name: member.name,
          role: member.role ?? "",
          avatar: member.avatar ?? initials,
          email: member.email ?? "",
          tasksAssigned: member.tasksAssigned ?? 0,
          tasksCompleted: member.tasksCompleted ?? 0,
          status: member.status ?? "online",
          phone: member.phone ?? "",
          department: member.department ?? "",
          avatarColor: member.avatarColor ?? "gradient-primary",
          assignedProjectIds: member.assignedProjectIds ?? [],
          capacityHours: member.capacityHours ?? 40,
          utilizationTarget: member.utilizationTarget ?? 85,
          privilegeRole: member.privilegeRole ?? "lead",
          customFieldValues: member.customFieldValues ?? {},
        };

        return appendAuditLog(
          { ...current, teamMembers: [...current.teamMembers, record] },
          {
            action: "Team member created",
            entityType: "team",
            entityId: record.id,
            detail: `${record.name} was added as ${record.role || "a team member"}.`,
          },
        );
      }).teamMembers.at(-1);

      if (created) {
        try {
          await upsertRemoteTeamMember(created);
        } catch (error) {
          toast.error("Supabase team member sync skipped", error);
        }
      }

      return created;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateTeamMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceTeamMember> & { id: string }) => {
      const updated = updateWorkspaceData((current) => {
        const existing = current.teamMembers.find((member) => member.id === id);
        if (!existing) return current;

        return appendAuditLog(
          {
            ...current,
            teamMembers: current.teamMembers.map((member) =>
              member.id === id ? { ...member, ...updates } : member,
            ),
          },
          {
            action: "Team member updated",
            entityType: "team",
            entityId: id,
            detail: `${updates.name ?? existing.name} was updated: ${summarizeUpdatedFields(updates)}.`,
          },
        );
      }).teamMembers.find((member) => member.id === id);

      if (updated) {
        try {
          await upsertRemoteTeamMember(updated);
        } catch (error) {
          toast.error("Supabase team member update skipped", error);
        }
      }

      return updated;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateUserAccount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (account: Partial<WorkspaceUserAccount> & { fullName: string; email: string }) =>
      updateWorkspaceData((current) => {
        const linkedTeamMember = account.teamMemberId
          ? current.teamMembers.find((member) => member.id === account.teamMemberId)
          : undefined;
        const record: WorkspaceUserAccount = {
          id: makeId("user"),
          fullName: account.fullName,
          email: account.email,
          roleId: account.roleId ?? linkedTeamMember?.privilegeRole ?? "viewer",
          status: account.status ?? "invited",
          authProvider: account.authProvider ?? "email",
          teamMemberId: account.teamMemberId ?? "",
          title: account.title ?? linkedTeamMember?.role ?? "",
          department: account.department ?? linkedTeamMember?.department ?? "",
          createdAt: account.createdAt ?? new Date().toISOString().slice(0, 10),
          lastAccessAt: account.lastAccessAt,
          invitedBy: account.invitedBy ?? current.settings.currentUser.displayName,
          notes: account.notes ?? "",
        };

        return appendAuditLog(
          {
            ...current,
            userAccounts: [record, ...current.userAccounts],
            teamMembers: current.teamMembers.map((member) =>
              member.id === record.teamMemberId
                ?  {
              
                    ...member,
                    email: record.email,
                    privilegeRole: record.roleId,
                  }
                : member,
            ),
          },
          {
            action: "User access created",
            entityType: "user",
            entityId: record.id,
            detail: `${record.fullName} was added with ${record.roleId} access.`,
          },
        );
      }).userAccounts[0],
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateUserAccount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceUserAccount> & { id: string }) =>
      updateWorkspaceData((current) => {
        const existing = current.userAccounts.find((account) => account.id === id);
        if (!existing) return current;
        const teamMemberId = updates.teamMemberId ?? existing?.teamMemberId ?? "";
        return appendAuditLog(
          {
            ...current,
            userAccounts: current.userAccounts.map((account) =>
              account.id === id
                ? {
                    ...account,
                    ...updates,
                    teamMemberId,
                  }
                : account,
            ),
            teamMembers: current.teamMembers.map((member) =>
              member.id === teamMemberId
                ? {
                    ...member,
                    email: updates.email ?? existing?.email ?? member.email,
                    privilegeRole: updates.roleId ?? existing?.roleId ?? member.privilegeRole,
                  }
                : member,
            ),
          },
          {
            action: "User access updated",
            entityType: "user",
            entityId: id,
            detail: `${updates.fullName ?? existing.fullName} was updated: ${summarizeUpdatedFields(updates)}.`,
          },
        );
      }).userAccounts.find((account) => account.id === id),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useDeleteUserAccount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      updateWorkspaceData((current) => {
        const existing = current.userAccounts.find((account) => account.id === id);
        if (!existing) return current;

        return appendAuditLog(
          {
            ...current,
            userAccounts: current.userAccounts.filter((account) => account.id !== id),
            teamMembers: current.teamMembers.map((member) =>
              member.id === existing.teamMemberId
                ? {
                    ...member,
                    email: null,
                  }
                : member,
            ),
          },
          {
            action: "User access removed",
            entityType: "user",
            entityId: id,
            detail: `${existing.fullName} was removed from workspace access.`,
          },
        );
      }).userAccounts.find((account) => account.id === id),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useRecordUserInvitation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, actorName }: { id: string; actorName?: string }) => {
      const sentAt = new Date().toISOString();
      return updateWorkspaceData((current) => {
        const existing = current.userAccounts.find((account) => account.id === id);
        if (!existing) return current;

        return appendAuditLog(
          {
            ...current,
            userAccounts: current.userAccounts.map((account) =>
              account.id === id
                ? {
                    ...account,
                    status: account.status === "suspended" ? account.status : "invited",
                    invitationSentAt: sentAt,
                  }
                : account,
            ),
          },
          {
            action: "Invitation email sent",
            entityType: "user",
            entityId: id,
            actorName,
            detail: `${existing.fullName} received a workspace invitation email at ${existing.email}.`,
          },
        );
      }).userAccounts.find((account) => account.id === id);
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useRecordUserPasswordReset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, actorName }: { id: string; actorName?: string }) => {
      const sentAt = new Date().toISOString();
      return updateWorkspaceData((current) => {
        const existing = current.userAccounts.find((account) => account.id === id);
        if (!existing) return current;

        return appendAuditLog(
          {
            ...current,
            userAccounts: current.userAccounts.map((account) =>
              account.id === id
                ? {
                    ...account,
                    passwordResetSentAt: sentAt,
                  }
                : account,
            ),
          },
          {
            action: "Password reset email sent",
            entityType: "user",
            entityId: id,
            actorName,
            detail: `${existing.fullName} received a password reset email at ${existing.email}.`,
          },
        );
      }).userAccounts.find((account) => account.id === id);
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useSendUserNotification() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      message,
      actorName,
    }: {
      id: string;
      message: string;
      actorName?: string;
    }) => {
      const sentAt = new Date().toISOString();
      return updateWorkspaceData((current) => {
        const existing = current.userAccounts.find((account) => account.id === id);
        if (!existing) return current;

        return appendAuditLog(
          {
            ...current,
            userAccounts: current.userAccounts.map((account) =>
              account.id === id
                ? {
                    ...account,
                    lastNotificationAt: sentAt,
                    notificationCount: (account.notificationCount ?? 0) + 1,
                  }
                : account,
            ),
          },
          {
            action: "User notification sent",
            entityType: "user",
            entityId: id,
            actorName,
            detail: `${existing.fullName} was notified: ${message.trim()}.`,
          },
        );
      }).userAccounts.find((account) => account.id === id);
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useRegisterUserAccess() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userAccountId,
      email,
      displayName,
      authUserId,
    }: {
      userAccountId?: string;
      email?: string;
      displayName?: string;
      authUserId?: string;
    }) => {
      const accessAt = new Date().toISOString();
      const normalizedEmail = (email ?? "").trim().toLowerCase();
      return updateWorkspaceData((current) => {
        const existing = current.userAccounts.find((account) =>
          userAccountId ? account.id === userAccountId : account.email.trim().toLowerCase() === normalizedEmail,
        );
        if (!existing) return current;

        return appendAuditLog(
          {
            ...current,
            userAccounts: current.userAccounts.map((account) =>
              account.id === existing.id
                ? {
                    ...account,
                    status: account.status === "suspended" ? "suspended" : "active",
                    lastAccessAt: accessAt,
                  }
                : account,
            ),
            settings: {
              ...current.settings,
              currentUser: {
                ...current.settings.currentUser,
                authUserId: authUserId ?? current.settings.currentUser.authUserId,
                userAccountId: existing.id,
                displayName: displayName ?? current.settings.currentUser.displayName,
              },
            },
          },
          {
            action: "Account access recorded",
            entityType: "user",
            entityId: existing.id,
            actorName: displayName ?? existing.fullName,
            detail: `${existing.fullName} accessed the application using ${existing.authProvider} authentication.`,
          },
        );
      }).userAccounts.find((account) => account.id === userAccountId || account.email.trim().toLowerCase() === normalizedEmail);
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (ticket: Partial<WorkspaceTicket> & { title: string }) =>
      updateWorkspaceData((current) => {
        const nextId = `TK-${String(current.tickets.length + 1).padStart(3, "0")}`;
        const record: WorkspaceTicket = {
          id: nextId,
          title: ticket.title,
          description: ticket.description ?? "",
          status: ticket.status ?? "open",
          priority: ticket.priority ?? "medium",
          assignee: ticket.assignee ?? "Unassigned",
          projectId: ticket.projectId,
          taskId: ticket.taskId,
          createdAt: ticket.createdAt ?? new Date().toISOString().slice(0, 10),
          sla: ticket.sla ?? "24h remaining",
          comments: ticket.comments ?? [],
          customFieldValues: ticket.customFieldValues ?? {},
        };
        return appendAuditLog(
          { ...current, tickets: [record, ...current.tickets] },
          {
            action: "Ticket created",
            entityType: "ticket",
            entityId: record.id,
            detail: `${record.id} - ${record.title} was opened for ${record.assignee}.`,
          },
        );
      }).tickets[0],
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceTicket> & { id: string }) =>
      updateWorkspaceData((current) => {
        const existing = current.tickets.find((ticket) => ticket.id === id);
        if (!existing) return current;

        return appendAuditLog(
          {
            ...current,
            tickets: current.tickets.map((ticket) => (ticket.id === id ? { ...ticket, ...updates } : ticket)),
          },
          {
            action: "Ticket updated",
            entityType: "ticket",
            entityId: id,
            detail: `${updates.title ?? existing.title} was updated: ${summarizeUpdatedFields(updates)}.`,
          },
        );
      }).tickets.find((ticket) => ticket.id === id),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateChatMessage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      authorName,
      authorId,
      message,
    }: {
      channelId: string;
      authorName: string;
      authorId?: string;
      message: string;
    }) =>
      updateWorkspaceData((current) => {
        const channel = current.chatChannels.find((item) => item.id === channelId);
        const next = {
          ...current,
          chatChannels: current.chatChannels.map((item) =>
            item.id === channelId
              ? {
                  ...item,
                  messages: [
                    ...item.messages,
                    { id: makeId("chat"), authorName, authorId, message, createdAt: new Date().toISOString() },
                  ],
                }
              : item,
          ),
        };

        return appendAuditLog(next, {
          action: "Chat message posted",
          entityType: "chat",
          entityId: channelId,
          actorName: authorName,
          detail: `A new message was posted in ${channel?.name ?? "team chat"}.`,
        });
      }).chatChannels.find((channel) => channel.id === channelId),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateChatChannel() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (channel: Partial<WorkspaceChatChannel> & { name: string; topic: string }) =>
      updateWorkspaceData((current) => {
        const record = {
          id: makeId("channel"),
          name: channel.name,
          topic: channel.topic,
          memberIds: channel.memberIds ?? [],
          messages: channel.messages ?? [],
          projectId: channel.projectId,
          kind: channel.kind ?? "general",
          readOnly: channel.readOnly ?? false,
          whatsappGroupUrl: channel.whatsappGroupUrl ?? "",
          quickLinks: channel.quickLinks ?? [],
        };

        return appendAuditLog(
          { ...current, chatChannels: [...current.chatChannels, record] },
          {
            action: "Chat channel created",
            entityType: "chat",
            entityId: record.id,
            detail: `${record.name} was created for collaboration.`,
          },
        );
      }).chatChannels.at(-1),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateChatChannel() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceChatChannel> & { id: string }) =>
      updateWorkspaceData((current) => ({
        ...current,
        chatChannels: current.chatChannels.map((channel) => (channel.id === id ? { ...channel, ...updates } : channel)),
      })).chatChannels.find((channel) => channel.id === id),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceWorkflow> & { id: string }) =>
      updateWorkspaceData((current) => ({
        ...current,
        workflows: current.workflows.map((workflow) => (workflow.id === id ? { ...workflow, ...updates } : workflow)),
      })).workflows.find((workflow) => workflow.id === id),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateDashboard() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceDashboard> & { id: string }) =>
      updateWorkspaceData((current) => ({
        ...current,
        dashboards: current.dashboards.map((dashboard) => {
          if (updates.isDefault) {
            return dashboard.id === id
              ? { ...dashboard, ...updates, isDefault: true }
              : { ...dashboard, isDefault: false };
          }

          return dashboard.id === id ? { ...dashboard, ...updates } : dashboard;
        }),
      })).dashboards.find((dashboard) => dashboard.id === id),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateDashboard() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (dashboard: Partial<WorkspaceDashboard> & { name: string }) =>
      updateWorkspaceData((current) => {
        const shouldBeDefault = dashboard.isDefault ?? current.dashboards.length === 0;
        const nextWidgets = (dashboard.widgets?.length ? dashboard.widgets : buildDashboardWidgets()).map((widget) => ({
          ...widget,
          id: makeId("widget"),
        }));

        const record: WorkspaceDashboard = {
          id: makeId("dashboard"),
          name: dashboard.name,
          isDefault: shouldBeDefault,
          widgets: nextWidgets,
        };

        return {
          ...current,
          dashboards: [
            record,
            ...current.dashboards.map((item) =>
              shouldBeDefault ? { ...item, isDefault: false } : item,
            ),
          ],
        };
      }).dashboards[0],
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateReportTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceReportTemplate> & { id: string }) =>
      updateWorkspaceData((current) => ({
        ...current,
        reportTemplates: current.reportTemplates.map((template) => (template.id === id ? { ...template, ...updates } : template)),
      })).reportTemplates.find((template) => template.id === id),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateMeeting() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (meeting: Partial<WorkspaceMeeting> & { title: string; startsAt: string; endsAt: string }) => {
      const nextId = isSupabaseReady() ? generatePersistentEntityId("meeting") : makeId("meeting");
      const created = updateWorkspaceData((current) => {
        const record = {
          id: nextId,
          title: meeting.title,
          type: meeting.type ?? "Planning",
          projectId: meeting.projectId,
          taskId: meeting.taskId,
          channelId: meeting.channelId,
          organizerId: meeting.organizerId,
          attendeeIds: meeting.attendeeIds ?? [],
          startsAt: meeting.startsAt,
          endsAt: meeting.endsAt,
          provider: meeting.provider ?? "workspace",
          joinUrl: meeting.joinUrl,
          notes: meeting.notes,
          status: meeting.status ?? "scheduled",
        };

        return appendAuditLog(
          { ...current, meetings: [record, ...current.meetings] },
          {
            action: "Meeting scheduled",
            entityType: "meeting",
            entityId: record.id,
            detail: `${record.title} was scheduled for ${new Date(record.startsAt).toLocaleString()}.`,
          },
        );
      }).meetings[0];

      try {
        await upsertRemoteMeeting(created);
      } catch (error) {
        toast.error("Supabase meeting sync skipped", error);
      }

      return created;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateMeeting() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceMeeting> & { id: string }) => {
      const updated = updateWorkspaceData((current) => {
        const existing = current.meetings.find((meeting) => meeting.id === id);
        if (!existing) return current;

        return appendAuditLog(
          {
            ...current,
            meetings: current.meetings.map((meeting) => (meeting.id === id ? { ...meeting, ...updates } : meeting)),
          },
          {
            action: "Meeting updated",
            entityType: "meeting",
            entityId: id,
            detail: `${updates.title ?? existing.title} was updated: ${summarizeUpdatedFields(updates)}.`,
          },
        );
      }).meetings.find((meeting) => meeting.id === id);

      if (updated) {
        try {
          await upsertRemoteMeeting(updated);
        } catch (error) {
          toast.error("Supabase meeting update skipped", error);
        }
      }

      return updated;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreatePersonalEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (event: Partial<WorkspacePersonalEvent> & { title: string; memberId: string; startsAt: string; endsAt: string }) => {
      const nextId = isSupabaseReady() ? generatePersistentEntityId("event") : makeId("event");
      const created = updateWorkspaceData((current) => {
        const record = {
          id: nextId,
          title: event.title,
          memberId: event.memberId,
          type: event.type ?? "personal",
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          notes: event.notes,
        };

        return appendAuditLog(
          { ...current, personalEvents: [record, ...current.personalEvents] },
          {
            action: "Personal event created",
            entityType: "event",
            entityId: record.id,
            detail: `${record.title} was added to the personal calendar.`,
          },
        );
      }).personalEvents[0];

      try {
        await upsertRemotePersonalEvent(created);
      } catch (error) {
        toast.error("Supabase personal event sync skipped", error);
      }

      return created;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdatePersonalEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspacePersonalEvent> & { id: string }) => {
      const updated = updateWorkspaceData((current) => {
        const existing = current.personalEvents.find((event) => event.id === id);
        if (!existing) return current;

        return appendAuditLog(
          {
            ...current,
            personalEvents: current.personalEvents.map((event) => (event.id === id ? { ...event, ...updates } : event)),
          },
          {
            action: "Personal event updated",
            entityType: "event",
            entityId: id,
            detail: `${updates.title ?? existing.title} was updated: ${summarizeUpdatedFields(updates)}.`,
          },
        );
      }).personalEvents.find((event) => event.id === id);

      if (updated) {
        try {
          await upsertRemotePersonalEvent(updated);
        } catch (error) {
          toast.error("Supabase personal event update skipped", error);
        }
      }

      return updated;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateWorkspaceSettings() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (settings: WorkspaceSettings) => {
      const nextSettings = updateWorkspaceData((current) =>
        appendAuditLog(
          {
            ...current,
            settings,
          },
          {
            action: "Settings updated",
            entityType: "settings",
            entityId: current.settings.namespace.slug,
            detail: `Workspace settings were updated: ${summarizeUpdatedFields(settings as unknown as Record<string, unknown>)}.`,
          },
        ),
      ).settings;

      try {
        await syncProfileFromSettings(nextSettings);
      } catch (error) {
        toast.error("Supabase profile sync skipped", error);
      }

      return nextSettings;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateStickyNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (note: Omit<WorkspaceStickyNote, "id" | "createdAt">) => {
      const nextId = isSupabaseReady() ? generatePersistentEntityId("note") : makeId("note");
      const created = updateWorkspaceData((current) => {
        const record = {
          id: nextId,
          createdAt: new Date().toISOString(),
          ...note,
        };

        return appendAuditLog(
          { ...current, stickyNotes: [record, ...current.stickyNotes] },
          {
            action: "Sticky note created",
            entityType: "sticky-note",
            entityId: record.id,
            actorName: note.ownerName,
            detail: `${record.title} was added to the personal workspace.`,
          },
        );
      }).stickyNotes[0];

      try {
        await upsertRemoteStickyNote(created);
      } catch (error) {
        toast.error("Supabase sticky note sync skipped", error);
      }

      return created;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateStickyNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceStickyNote> & { id: string }) => {
      const updated = updateWorkspaceData((current) => {
        const existing = current.stickyNotes.find((note) => note.id === id);
        if (!existing) return current;

        return appendAuditLog(
          {
            ...current,
            stickyNotes: current.stickyNotes.map((note) => (note.id === id ? { ...note, ...updates } : note)),
          },
          {
            action: "Sticky note updated",
            entityType: "sticky-note",
            entityId: id,
            actorName: updates.ownerName ?? existing.ownerName,
            detail: `${updates.title ?? existing.title} was updated: ${summarizeUpdatedFields(updates)}.`,
          },
        );
      }).stickyNotes.find((note) => note.id === id);

      if (updated) {
        try {
          await upsertRemoteStickyNote(updated);
        } catch (error) {
          toast.error("Supabase sticky note update skipped", error);
        }
      }

      return updated;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useDeleteStickyNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const updated = updateWorkspaceData((current) => {
        const existing = current.stickyNotes.find((note) => note.id === id);
        const next = {
          ...current,
          stickyNotes: current.stickyNotes.filter((note) => note.id !== id),
        };

        return existing
          ? appendAuditLog(next, {
              action: "Sticky note deleted",
              entityType: "sticky-note",
              entityId: id,
              actorName: existing.ownerName,
              detail: `${existing.title} was removed from the personal workspace.`,
            })
          : next;
      });

      try {
        await deleteRemoteStickyNote(id);
      } catch (error) {
        toast.error("Supabase sticky note delete skipped", error);
      }

      return updated;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

type ImportableEntityKey =
  | "projects"
  | "tasks"
  | "teamMembers"
  | "tickets"
  | "userAccounts"
  | "meetings"
  | "personalEvents"
  | "chatChannels"
  | "stickyNotes";

type ImportWorkspacePayload =
  | {
      entity: ImportableEntityKey;
      mode?: "merge" | "replace";
      records: WorkspaceData[ImportableEntityKey];
    }
  | {
      entity: "workspace";
      mode?: "merge" | "replace";
      records: Partial<WorkspaceData>;
    };

const mergeByIdentity = <T extends Record<string, any>>(current: T[], incoming: T[], identityKeys: Array<keyof T>) => {
  const next = [...current];

  for (const record of incoming) {
    const index = next.findIndex((item) =>
      identityKeys.some((key) => {
        const left = item[key];
        const right = record[key];
        return typeof left === "string" && typeof right === "string"
          ? left.trim().toLowerCase() === right.trim().toLowerCase()
          : left !== undefined && right !== undefined && left === right;
      }),
    );

    if (index >= 0) next[index] = { ...next[index], ...record };
    else next.push(record);
  }

  return next;
};

export function useImportWorkspaceData() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ImportWorkspacePayload) =>
      updateWorkspaceData((current) => {
        if (payload.entity === "workspace") {
          if (payload.mode === "replace") {
            return {
              ...current,
              ...payload.records,
            };
          }

          return {
            ...current,
            ...payload.records,
            projects: payload.records.projects ? mergeByIdentity(current.projects, payload.records.projects, ["id", "name"]) : current.projects,
            tasks: payload.records.tasks ? mergeByIdentity(current.tasks, payload.records.tasks, ["id", "title"]) : current.tasks,
            teamMembers: payload.records.teamMembers ? mergeByIdentity(current.teamMembers, payload.records.teamMembers, ["id", "email", "name"]) : current.teamMembers,
            tickets: payload.records.tickets ? mergeByIdentity(current.tickets, payload.records.tickets, ["id", "title"]) : current.tickets,
            userAccounts: payload.records.userAccounts ? mergeByIdentity(current.userAccounts, payload.records.userAccounts, ["id", "email", "fullName"]) : current.userAccounts,
            meetings: payload.records.meetings ? mergeByIdentity(current.meetings, payload.records.meetings, ["id", "title"]) : current.meetings,
            personalEvents: payload.records.personalEvents ? mergeByIdentity(current.personalEvents, payload.records.personalEvents, ["id", "title"]) : current.personalEvents,
            chatChannels: payload.records.chatChannels ? mergeByIdentity(current.chatChannels, payload.records.chatChannels, ["id", "name"]) : current.chatChannels,
            stickyNotes: payload.records.stickyNotes ? mergeByIdentity(current.stickyNotes, payload.records.stickyNotes, ["id", "title"]) : current.stickyNotes,
          };
        }

        const key = payload.entity;
        const incomingRecords = payload.records as Array<Record<string, any>>;
        const currentRecords = current[key] as Array<Record<string, any>>;

        const identityMap: Record<ImportableEntityKey, string[]> = {
          projects: ["id", "name"],
          tasks: ["id", "title"],
          teamMembers: ["id", "email", "name"],
          tickets: ["id", "title"],
          userAccounts: ["id", "email", "fullName"],
          meetings: ["id", "title"],
          personalEvents: ["id", "title"],
          chatChannels: ["id", "name"],
          stickyNotes: ["id", "title"],
        };

        return {
          ...current,
          [key]:
            payload.mode === "replace"
              ? incomingRecords
              : mergeByIdentity(currentRecords, incomingRecords, identityMap[key] as Array<string>),
        };
      }),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useImportRadarMatrix() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rows,
      sourceFileName,
    }: {
      rows: RadarImportRow[];
      sourceFileName?: string;
    }) =>
      updateWorkspaceData((current) => applyRadarRowsToWorkspace(current, rows, sourceFileName)),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}
