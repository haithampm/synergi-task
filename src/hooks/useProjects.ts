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
  createRemoteAuditLog,
  deleteRemoteTicket,
  deleteRemoteStickyNote,
  deleteRemoteProject,
  deleteRemoteTask,
  fetchMergedAuditLogs,
  fetchMergedChatChannels,
  fetchMergedDashboards,
  fetchMergedMeetings,
  fetchMergedPersonalEvents,
  fetchMergedProjectTemplates,
  fetchMergedProjects,
  fetchMergedReportTemplates,
  fetchMergedStickyNotes,
  fetchMergedTasks,
  fetchMergedTeamMembers,
  fetchMergedTickets,
  fetchMergedUserAccounts,
  fetchMergedWorkflows,
  generatePersistentEntityId,
  isSupabaseReady,
  mergeSettingsWithRemoteContext,
  syncRemoteWorkspaceState,
  syncWorkspaceSettings,
  syncWorkspaceUserAccount,
  upsertRemoteChatChannel,
  upsertRemoteChatMessage,
  upsertRemoteDashboard,
  upsertRemoteMeeting,
  upsertRemotePersonalEvent,
  upsertRemoteProject,
  upsertRemoteProjectDocuments,
  upsertRemoteStickyNote,
  upsertRemoteTask,
  upsertRemoteTicket,
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

const writeWorkspacePatch = (patch: Partial<WorkspaceData>) =>
  updateWorkspaceData((current) => ({
    ...current,
    ...patch,
  }));

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
    queryFn: async () => fetchMergedTickets(),
    ...liveSyncOptions,
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
    queryFn: async () => fetchMergedUserAccounts(),
    ...liveSyncOptions,
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
    queryFn: async () => fetchMergedChatChannels(),
    ...liveSyncOptions,
  });
}

export function useWorkflows() {
  return useQuery({
    queryKey: workspaceKeys.workflows,
    queryFn: async () => fetchMergedWorkflows(),
    ...liveSyncOptions,
  });
}

export function useDashboards() {
  return useQuery({
    queryKey: workspaceKeys.dashboards,
    queryFn: async () => fetchMergedDashboards(),
    ...liveSyncOptions,
  });
}

export function useReportTemplates() {
  return useQuery({
    queryKey: workspaceKeys.reports,
    queryFn: async () => fetchMergedReportTemplates(),
    ...liveSyncOptions,
  });
}

export function useProjectTemplates() {
  return useQuery({
    queryKey: workspaceKeys.templates,
    queryFn: async () => fetchMergedProjectTemplates(),
    ...liveSyncOptions,
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: workspaceKeys.audit,
    queryFn: async () => fetchMergedAuditLogs(),
    ...liveSyncOptions,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: workspaceKeys.dashboard,
    queryFn: async () => {
      const local = readWorkspaceData();
      const [projects, tasks, teamMembers, meetings, tickets, chatChannels, dashboards] = await Promise.all([
        fetchMergedProjects(),
        fetchMergedTasks(),
        fetchMergedTeamMembers(),
        fetchMergedMeetings(),
        fetchMergedTickets(),
        fetchMergedChatChannels(),
        fetchMergedDashboards(),
      ]);
      const { workflows } = local;
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
        teamMembers,
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
      const current = readWorkspaceData();
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

      await upsertRemoteProject(record);
      await upsertRemoteProjectDocuments(record.id, record.documents ?? []);
      await createRemoteAuditLog({
        action: "Project created",
        entityType: "project",
        entityId: record.id,
        detail: `${record.name} was created in ${record.namespace}.`,
        actorName: current.settings.currentUser.displayName,
      });

      const [projects, auditLogs] = await Promise.all([fetchMergedProjects(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ projects, auditLogs });
      return projects.find((item) => item.id === record.id) ?? record;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceProject> & { id: string }) => {
      const existingProjects = await fetchMergedProjects();
      const existing = existingProjects.find((project) => project.id === id);
      if (!existing) {
        throw new Error("Project not found");
      }

      const updated: WorkspaceProject = {
        ...existing,
        ...updates,
        startDate: updates.startDate ?? updates.start_date ?? existing.startDate,
        endDate: updates.endDate ?? updates.end_date ?? existing.endDate,
        start_date: updates.start_date ?? updates.startDate ?? existing.start_date,
        end_date: updates.end_date ?? updates.endDate ?? existing.end_date,
      };

      await upsertRemoteProject(updated);
      await upsertRemoteProjectDocuments(updated.id, updated.documents ?? []);
      await createRemoteAuditLog({
        action: "Project updated",
        entityType: "project",
        entityId: id,
        detail: `${updates.name ?? existing.name} was updated: ${summarizeUpdatedFields(updates)}.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });

      const [projects, auditLogs] = await Promise.all([fetchMergedProjects(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ projects, auditLogs });
      return projects.find((project) => project.id === id) ?? updated;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const existingProjects = await fetchMergedProjects();
      const existing = existingProjects.find((project) => project.id === id);
      if (!existing) {
        throw new Error("Project not found");
      }

      await deleteRemoteProject(id);
      await createRemoteAuditLog({
        action: "Project archived",
        entityType: "project",
        entityId: id,
        detail: `${existing.name} was archived and removed from the active project list.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });

      const [projects, auditLogs] = await Promise.all([fetchMergedProjects(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ projects, auditLogs });
      return projects;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (task: Partial<WorkspaceTask> & { title: string }) => {
      const nextId = isSupabaseReady() ? generatePersistentEntityId("task") : makeId("task");
      const projects = await fetchMergedProjects();
      const project = projects.find((item) => item.id === (task.project_id ?? task.projectId));
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

      await upsertRemoteTask(record);
      await createRemoteAuditLog({
        action: "Task created",
        entityType: "task",
        entityId: record.id,
        detail: `${record.title} was created for ${record.projectName || "the workspace"} in ${record.phase}.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });

      const [tasks, nextProjects, auditLogs] = await Promise.all([
        fetchMergedTasks(),
        fetchMergedProjects(),
        fetchMergedAuditLogs(),
      ]);
      writeWorkspacePatch({ tasks, projects: nextProjects, auditLogs });
      return tasks.find((item) => item.id === record.id) ?? record;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceTask> & { id: string }) => {
      const existingTasks = await fetchMergedTasks();
      const existing = existingTasks.find((task) => task.id === id);
      if (!existing) {
        throw new Error("Task not found");
      }

      const projects = await fetchMergedProjects();
      const projectId = updates.project_id ?? updates.projectId ?? existing.project_id ?? existing.projectId;
      const project = projects.find((item) => item.id === projectId);
      const dueDate = updates.due_date ?? updates.dueDate ?? existing.due_date ?? existing.dueDate;
      const updated: WorkspaceTask = {
        ...existing,
        ...updates,
        project_id: projectId,
        projectId,
        projectName: updates.projectName ?? project?.name ?? existing.projectName,
        due_date: dueDate,
        dueDate,
        parentTaskId: updates.parentTaskId ?? existing.parentTaskId,
        workloadHours: updates.workloadHours ?? existing.workloadHours,
        timesheetEntries: updates.timesheetEntries ?? existing.timesheetEntries ?? [],
      };

      await upsertRemoteTask(updated);
      await createRemoteAuditLog({
        action: "Task updated",
        entityType: "task",
        entityId: id,
        detail: `${updates.title ?? existing.title} was updated: ${summarizeUpdatedFields(updates)}.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });

      const [tasks, nextProjects, auditLogs] = await Promise.all([
        fetchMergedTasks(),
        fetchMergedProjects(),
        fetchMergedAuditLogs(),
      ]);
      writeWorkspacePatch({ tasks, projects: nextProjects, auditLogs });
      return tasks.find((task) => task.id === id) ?? updated;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const existingTasks = await fetchMergedTasks();
      const existing = existingTasks.find((task) => task.id === id);
      if (!existing) {
        throw new Error("Task not found");
      }

      await deleteRemoteTask(id);
      await createRemoteAuditLog({
        action: "Task deleted",
        entityType: "task",
        entityId: id,
        detail: `${existing.title} and linked ticket references were removed.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });

      const [tasks, projects, tickets, auditLogs] = await Promise.all([
        fetchMergedTasks(),
        fetchMergedProjects(),
        fetchMergedTickets(),
        fetchMergedAuditLogs(),
      ]);
      writeWorkspacePatch({ tasks, projects, tickets, auditLogs });
      return tasks;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateTeamMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (member: Partial<WorkspaceTeamMember> & { name: string }) => {
      const nextId = isSupabaseReady() ? generatePersistentEntityId("member") : makeId("member");
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

      await upsertRemoteTeamMember(record);
      await createRemoteAuditLog({
        action: "Team member created",
        entityType: "team",
        entityId: record.id,
        detail: `${record.name} was added as ${record.role || "a team member"}.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });

      const [teamMembers, auditLogs] = await Promise.all([fetchMergedTeamMembers(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ teamMembers, auditLogs });
      return teamMembers.find((item) => item.id === record.id) ?? record;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateTeamMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceTeamMember> & { id: string }) => {
      const existingMembers = await fetchMergedTeamMembers();
      const existing = existingMembers.find((member) => member.id === id);
      if (!existing) {
        throw new Error("Team member not found");
      }

      const updated: WorkspaceTeamMember = { ...existing, ...updates };
      await upsertRemoteTeamMember(updated);
      await createRemoteAuditLog({
        action: "Team member updated",
        entityType: "team",
        entityId: id,
        detail: `${updates.name ?? existing.name} was updated: ${summarizeUpdatedFields(updates)}.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });

      const [teamMembers, auditLogs] = await Promise.all([fetchMergedTeamMembers(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ teamMembers, auditLogs });
      return teamMembers.find((member) => member.id === id) ?? updated;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateUserAccount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (_account: Partial<WorkspaceUserAccount> & { fullName: string; email: string }) => {
      throw new Error(
        "Creating brand-new workspace access still requires a server-side admin invitation flow. Existing linked accounts can be edited and persisted normally.",
      );
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateUserAccount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceUserAccount> & { id: string }) => {
      await syncWorkspaceUserAccount({ id, ...updates });
      const existing = (await fetchMergedUserAccounts()).find((account) => account.id === id);
      await createRemoteAuditLog({
        action: "User access updated",
        entityType: "user",
        entityId: id,
        detail: `${updates.fullName ?? existing?.fullName ?? "User"} was updated: ${summarizeUpdatedFields(updates)}.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
        payload: { userAccountId: id },
      });

      const [userAccounts, teamMembers, auditLogs] = await Promise.all([
        fetchMergedUserAccounts(),
        fetchMergedTeamMembers(),
        fetchMergedAuditLogs(),
      ]);
      writeWorkspacePatch({ userAccounts, teamMembers, auditLogs });
      return userAccounts.find((account) => account.id === id);
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useDeleteUserAccount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await syncWorkspaceUserAccount({ id, status: "suspended" });
      const existing = (await fetchMergedUserAccounts()).find((account) => account.id === id);
      await createRemoteAuditLog({
        action: "User access removed",
        entityType: "user",
        entityId: id,
        detail: `${existing?.fullName ?? "User"} access was suspended.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
        payload: { userAccountId: id },
      });

      const [userAccounts, teamMembers, auditLogs] = await Promise.all([
        fetchMergedUserAccounts(),
        fetchMergedTeamMembers(),
        fetchMergedAuditLogs(),
      ]);
      writeWorkspacePatch({ userAccounts, teamMembers, auditLogs });
      return userAccounts.find((account) => account.id === id);
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useRecordUserInvitation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, actorName }: { id: string; actorName?: string }) => {
      const existing = (await fetchMergedUserAccounts()).find((account) => account.id === id);
      if (!existing) return undefined;
      await createRemoteAuditLog({
        action: "Invitation email sent",
        entityType: "user",
        entityId: id,
        actorName,
        detail: `${existing.fullName} received a workspace invitation email at ${existing.email}.`,
        payload: { userAccountId: id },
      });
      const [userAccounts, auditLogs] = await Promise.all([fetchMergedUserAccounts(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ userAccounts, auditLogs });
      return userAccounts.find((account) => account.id === id);
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useRecordUserPasswordReset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, actorName }: { id: string; actorName?: string }) => {
      const existing = (await fetchMergedUserAccounts()).find((account) => account.id === id);
      if (!existing) return undefined;
      await createRemoteAuditLog({
        action: "Password reset email sent",
        entityType: "user",
        entityId: id,
        actorName,
        detail: `${existing.fullName} received a password reset email at ${existing.email}.`,
        payload: { userAccountId: id },
      });
      const [userAccounts, auditLogs] = await Promise.all([fetchMergedUserAccounts(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ userAccounts, auditLogs });
      return userAccounts.find((account) => account.id === id);
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
      const existing = (await fetchMergedUserAccounts()).find((account) => account.id === id);
      if (!existing) return undefined;
      await createRemoteAuditLog({
        action: "User notification sent",
        entityType: "user",
        entityId: id,
        actorName,
        detail: `${existing.fullName} was notified: ${message.trim()}.`,
        payload: { userAccountId: id, message: message.trim() },
      });
      const [userAccounts, auditLogs] = await Promise.all([fetchMergedUserAccounts(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ userAccounts, auditLogs });
      return userAccounts.find((account) => account.id === id);
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
      const normalizedEmail = (email ?? "").trim().toLowerCase();
      const userAccounts = await fetchMergedUserAccounts();
      const existing = userAccounts.find((account) =>
        userAccountId ? account.id === userAccountId : account.email.trim().toLowerCase() === normalizedEmail,
      );
      if (!existing) return undefined;

      await createRemoteAuditLog({
        action: "Account access recorded",
        entityType: "user",
        entityId: existing.id,
        actorName: displayName ?? existing.fullName,
        detail: `${existing.fullName} accessed the application using ${existing.authProvider} authentication.`,
        payload: { userAccountId: existing.id, authUserId: authUserId ?? null },
      });

      const [nextUserAccounts, auditLogs] = await Promise.all([fetchMergedUserAccounts(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({
        userAccounts: nextUserAccounts,
        auditLogs,
        settings: {
          ...readWorkspaceData().settings,
          currentUser: {
            ...readWorkspaceData().settings.currentUser,
            authUserId: authUserId ?? readWorkspaceData().settings.currentUser.authUserId,
            userAccountId: existing.id,
            displayName: displayName ?? readWorkspaceData().settings.currentUser.displayName,
          },
        },
      });
      return nextUserAccounts.find((account) => account.id === existing.id);
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (ticket: Partial<WorkspaceTicket> & { title: string }) => {
      const record = {
        id: ticket.id ?? generatePersistentEntityId("ticket"),
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
      } satisfies WorkspaceTicket;

      await upsertRemoteTicket(record);
      await createRemoteAuditLog({
        action: "Ticket created",
        entityType: "ticket",
        entityId: record.id,
        detail: `${record.id} - ${record.title} was opened for ${record.assignee}.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });
      const [tickets, auditLogs] = await Promise.all([fetchMergedTickets(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ tickets, auditLogs });
      return tickets.find((item) => item.id === record.id) ?? record;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceTicket> & { id: string }) => {
      const existingTickets = await fetchMergedTickets();
      const existingRemote = existingTickets.find((ticket) => ticket.id === id);
      if (!existingRemote) throw new Error("Ticket not found");

      await upsertRemoteTicket({ ...existingRemote, ...updates, id });
      await createRemoteAuditLog({
        action: "Ticket updated",
        entityType: "ticket",
        entityId: id,
        detail: `${updates.title ?? existingRemote.title} was updated: ${summarizeUpdatedFields(updates)}.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });
      const [tickets, auditLogs] = await Promise.all([fetchMergedTickets(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ tickets, auditLogs });
      return tickets.find((ticket) => ticket.id === id);
    },
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
    }) => {
      const record = {
        id: generatePersistentEntityId("chat"),
        channelId,
        authorId,
        authorName,
        message,
        createdAt: new Date().toISOString(),
      };

      await upsertRemoteChatMessage(record);
      await createRemoteAuditLog({
        action: "Chat message posted",
        entityType: "chat",
        entityId: channelId,
        actorName: authorName,
        detail: "A new message was posted in team chat.",
      });
      const [chatChannels, auditLogs] = await Promise.all([fetchMergedChatChannels(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ chatChannels, auditLogs });
      return chatChannels.find((channel) => channel.id === channelId);
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateChatChannel() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (channel: Partial<WorkspaceChatChannel> & { name: string; topic: string }) => {
      const remoteRecord: WorkspaceChatChannel = {
        id: generatePersistentEntityId("channel"),
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

      await upsertRemoteChatChannel(remoteRecord);
      await createRemoteAuditLog({
        action: "Chat channel created",
        entityType: "chat",
        entityId: remoteRecord.id,
        detail: `${remoteRecord.name} was created for collaboration.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });
      const [chatChannels, auditLogs] = await Promise.all([fetchMergedChatChannels(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ chatChannels, auditLogs });
      return chatChannels.find((channel) => channel.id === remoteRecord.id) ?? remoteRecord;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateChatChannel() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceChatChannel> & { id: string }) => {
      const existingChannels = await fetchMergedChatChannels();
      const existingRemote = existingChannels.find((channel) => channel.id === id);
      if (!existingRemote) throw new Error("Chat channel not found");

      await upsertRemoteChatChannel({ ...existingRemote, ...updates, id });
      await createRemoteAuditLog({
        action: "Chat channel updated",
        entityType: "chat",
        entityId: id,
        detail: `${updates.name ?? existingRemote.name} was updated: ${summarizeUpdatedFields(updates)}.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });
      const [chatChannels, auditLogs] = await Promise.all([fetchMergedChatChannels(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ chatChannels, auditLogs });
      return chatChannels.find((channel) => channel.id === id);
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceWorkflow> & { id: string }) => {
      const workflows = await fetchMergedWorkflows();
      const nextWorkflows = workflows.map((workflow) => (workflow.id === id ? { ...workflow, ...updates } : workflow));
      await syncRemoteWorkspaceState({ workflows: nextWorkflows });
      await createRemoteAuditLog({
        action: "Workflow updated",
        entityType: "settings",
        entityId: id,
        detail: `${updates.name ?? workflows.find((workflow) => workflow.id === id)?.name ?? "Workflow"} was updated: ${summarizeUpdatedFields(updates)}.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });
      const [mergedWorkflows, auditLogs] = await Promise.all([fetchMergedWorkflows(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ workflows: mergedWorkflows, auditLogs });
      return mergedWorkflows.find((workflow) => workflow.id === id);
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateDashboard() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceDashboard> & { id: string }) => {
      const existingDashboards = await fetchMergedDashboards();
      const existingRemote = existingDashboards.find((dashboard) => dashboard.id === id);
      if (!existingRemote) throw new Error("Dashboard not found");

      const nextDashboards = existingDashboards.map((dashboard) => {
        if (updates.isDefault) {
          return dashboard.id === id
            ? { ...dashboard, ...updates, isDefault: true }
            : { ...dashboard, isDefault: false };
        }

        return dashboard.id === id ? { ...dashboard, ...updates } : dashboard;
      });

      await Promise.all(nextDashboards.map((dashboard) => upsertRemoteDashboard(dashboard)));
      const dashboards = await fetchMergedDashboards();
      writeWorkspacePatch({ dashboards });
      return dashboards.find((dashboard) => dashboard.id === id);
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateDashboard() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (dashboard: Partial<WorkspaceDashboard> & { name: string }) => {
      const remoteRecord: WorkspaceDashboard = {
        id: generatePersistentEntityId("dashboard"),
        name: dashboard.name,
        isDefault: dashboard.isDefault ?? false,
        widgets: (dashboard.widgets?.length ? dashboard.widgets : buildDashboardWidgets()).map((widget) => ({
          ...widget,
          id: widget.id || makeId("widget"),
        })),
      };

      await upsertRemoteDashboard(remoteRecord);
      const dashboards = await fetchMergedDashboards();
      writeWorkspacePatch({ dashboards });
      return dashboards.find((item) => item.id === remoteRecord.id) ?? remoteRecord;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateReportTemplate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceReportTemplate> & { id: string }) => {
      const reportTemplates = await fetchMergedReportTemplates();
      const nextTemplates = reportTemplates.map((template) =>
        template.id === id ? { ...template, ...updates } : template,
      );
      await syncRemoteWorkspaceState({ reportTemplates: nextTemplates });
      await createRemoteAuditLog({
        action: "Report template updated",
        entityType: "settings",
        entityId: id,
        detail: `${updates.name ?? reportTemplates.find((template) => template.id === id)?.name ?? "Report template"} was updated: ${summarizeUpdatedFields(updates)}.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });
      const [mergedTemplates, auditLogs] = await Promise.all([fetchMergedReportTemplates(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ reportTemplates: mergedTemplates, auditLogs });
      return mergedTemplates.find((template) => template.id === id);
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateMeeting() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (meeting: Partial<WorkspaceMeeting> & { title: string; startsAt: string; endsAt: string }) => {
      const nextId = isSupabaseReady() ? generatePersistentEntityId("meeting") : makeId("meeting");
      const record: WorkspaceMeeting = {
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

      await upsertRemoteMeeting(record);
      await createRemoteAuditLog({
        action: "Meeting scheduled",
        entityType: "meeting",
        entityId: record.id,
        detail: `${record.title} was scheduled for ${new Date(record.startsAt).toLocaleString()}.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });
      const [meetings, auditLogs] = await Promise.all([fetchMergedMeetings(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ meetings, auditLogs });
      return meetings.find((item) => item.id === record.id) ?? record;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateMeeting() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceMeeting> & { id: string }) => {
      const meetings = await fetchMergedMeetings();
      const existing = meetings.find((meeting) => meeting.id === id);
      if (!existing) {
        throw new Error("Meeting not found");
      }

      const updated: WorkspaceMeeting = { ...existing, ...updates };
      await upsertRemoteMeeting(updated);
      await createRemoteAuditLog({
        action: "Meeting updated",
        entityType: "meeting",
        entityId: id,
        detail: `${updates.title ?? existing.title} was updated: ${summarizeUpdatedFields(updates)}.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });
      const [nextMeetings, auditLogs] = await Promise.all([fetchMergedMeetings(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ meetings: nextMeetings, auditLogs });
      return nextMeetings.find((meeting) => meeting.id === id) ?? updated;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreatePersonalEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (event: Partial<WorkspacePersonalEvent> & { title: string; memberId: string; startsAt: string; endsAt: string }) => {
      const nextId = isSupabaseReady() ? generatePersistentEntityId("event") : makeId("event");
      const record: WorkspacePersonalEvent = {
        id: nextId,
        title: event.title,
        memberId: event.memberId,
        type: event.type ?? "personal",
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        notes: event.notes,
      };

      await upsertRemotePersonalEvent(record);
      await createRemoteAuditLog({
        action: "Personal event created",
        entityType: "event",
        entityId: record.id,
        detail: `${record.title} was added to the personal calendar.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });
      const [personalEvents, auditLogs] = await Promise.all([fetchMergedPersonalEvents(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ personalEvents, auditLogs });
      return personalEvents.find((item) => item.id === record.id) ?? record;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdatePersonalEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspacePersonalEvent> & { id: string }) => {
      const personalEvents = await fetchMergedPersonalEvents();
      const existing = personalEvents.find((event) => event.id === id);
      if (!existing) {
        throw new Error("Personal event not found");
      }

      const updated: WorkspacePersonalEvent = { ...existing, ...updates };
      await upsertRemotePersonalEvent(updated);
      await createRemoteAuditLog({
        action: "Personal event updated",
        entityType: "event",
        entityId: id,
        detail: `${updates.title ?? existing.title} was updated: ${summarizeUpdatedFields(updates)}.`,
        actorName: readWorkspaceData().settings.currentUser.displayName,
      });
      const [nextPersonalEvents, auditLogs] = await Promise.all([fetchMergedPersonalEvents(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ personalEvents: nextPersonalEvents, auditLogs });
      return nextPersonalEvents.find((event) => event.id === id) ?? updated;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateWorkspaceSettings() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (settings: WorkspaceSettings) => {
      const nextSettings = await syncWorkspaceSettings(settings);
      await createRemoteAuditLog({
        action: "Settings updated",
        entityType: "settings",
        entityId: settings.namespace.slug,
        detail: `Workspace settings were updated: ${summarizeUpdatedFields(settings as unknown as Record<string, unknown>)}.`,
        actorName: settings.currentUser.displayName,
      });
      const [mergedSettings, workflows, reportTemplates, projectTemplates, auditLogs] = await Promise.all([
        mergeSettingsWithRemoteContext(nextSettings),
        fetchMergedWorkflows(),
        fetchMergedReportTemplates(),
        fetchMergedProjectTemplates(),
        fetchMergedAuditLogs(),
      ]);
      writeWorkspacePatch({
        settings: mergedSettings,
        workflows,
        reportTemplates,
        projectTemplates,
        auditLogs,
      });
      return mergedSettings;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateStickyNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (note: Omit<WorkspaceStickyNote, "id" | "createdAt">) => {
      const nextId = isSupabaseReady() ? generatePersistentEntityId("note") : makeId("note");
      const record: WorkspaceStickyNote = {
        id: nextId,
        createdAt: new Date().toISOString(),
        ...note,
      };

      await upsertRemoteStickyNote(record);
      await createRemoteAuditLog({
        action: "Sticky note created",
        entityType: "sticky-note",
        entityId: record.id,
        actorName: note.ownerName,
        detail: `${record.title} was added to the personal workspace.`,
      });
      const [stickyNotes, auditLogs] = await Promise.all([fetchMergedStickyNotes(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ stickyNotes, auditLogs });
      return stickyNotes.find((item) => item.id === record.id) ?? record;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateStickyNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceStickyNote> & { id: string }) => {
      const stickyNotes = await fetchMergedStickyNotes();
      const existing = stickyNotes.find((note) => note.id === id);
      if (!existing) {
        throw new Error("Sticky note not found");
      }

      const updated: WorkspaceStickyNote = { ...existing, ...updates };
      await upsertRemoteStickyNote(updated);
      await createRemoteAuditLog({
        action: "Sticky note updated",
        entityType: "sticky-note",
        entityId: id,
        actorName: updates.ownerName ?? existing.ownerName,
        detail: `${updates.title ?? existing.title} was updated: ${summarizeUpdatedFields(updates)}.`,
      });
      const [nextStickyNotes, auditLogs] = await Promise.all([fetchMergedStickyNotes(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ stickyNotes: nextStickyNotes, auditLogs });
      return nextStickyNotes.find((note) => note.id === id) ?? updated;
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useDeleteStickyNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const stickyNotes = await fetchMergedStickyNotes();
      const existing = stickyNotes.find((note) => note.id === id);
      if (!existing) {
        throw new Error("Sticky note not found");
      }

      await deleteRemoteStickyNote(id);
      await createRemoteAuditLog({
        action: "Sticky note deleted",
        entityType: "sticky-note",
        entityId: id,
        actorName: existing.ownerName,
        detail: `${existing.title} was removed from the personal workspace.`,
      });
      const [nextStickyNotes, auditLogs] = await Promise.all([fetchMergedStickyNotes(), fetchMergedAuditLogs()]);
      writeWorkspacePatch({ stickyNotes: nextStickyNotes, auditLogs });
      return nextStickyNotes;
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

const ensureRemoteImportMode = (mode: "merge" | "replace" | undefined) => {
  if (isSupabaseReady() && mode === "replace") {
    throw new Error(
      "Replace import is disabled in the connected production workspace until every destructive import path has a server-side archive or delete implementation.",
    );
  }
};

const importProjectsToRemote = async (projects: WorkspaceProject[]) => {
  for (const project of projects) {
    await upsertRemoteProject(project);
    await upsertRemoteProjectDocuments(project.id, project.documents ?? []);
  }

  return fetchMergedProjects();
};

const importTasksToRemote = async (tasks: WorkspaceTask[]) => {
  for (const task of tasks) {
    await upsertRemoteTask(task);
  }

  return fetchMergedTasks();
};

const importTeamMembersToRemote = async (teamMembers: WorkspaceTeamMember[]) => {
  for (const member of teamMembers) {
    await upsertRemoteTeamMember(member);
  }

  return fetchMergedTeamMembers();
};

const importTicketsToRemote = async (tickets: WorkspaceTicket[]) => {
  for (const ticket of tickets) {
    await upsertRemoteTicket(ticket);
  }

  return fetchMergedTickets();
};

const importUserAccountsToRemote = async (userAccounts: WorkspaceUserAccount[]) => {
  const existingAccounts = await fetchMergedUserAccounts();
  const existingIds = new Set(existingAccounts.map((account) => account.id));

  for (const account of userAccounts) {
    if (!existingIds.has(account.id)) {
      throw new Error(
        `Workspace account ${account.email} is not linked to a persisted membership yet. Create the membership through the server-side invitation flow first.`,
      );
    }
    await syncWorkspaceUserAccount(account);
  }

  return fetchMergedUserAccounts();
};

const importMeetingsToRemote = async (meetings: WorkspaceMeeting[]) => {
  for (const meeting of meetings) {
    await upsertRemoteMeeting(meeting);
  }

  return fetchMergedMeetings();
};

const importPersonalEventsToRemote = async (personalEvents: WorkspacePersonalEvent[]) => {
  for (const event of personalEvents) {
    await upsertRemotePersonalEvent(event);
  }

  return fetchMergedPersonalEvents();
};

const importChatChannelsToRemote = async (chatChannels: WorkspaceChatChannel[]) => {
  for (const channel of chatChannels) {
    await upsertRemoteChatChannel(channel);
    for (const message of channel.messages ?? []) {
      await upsertRemoteChatMessage({
        ...message,
        channelId: channel.id,
      });
    }
  }

  return fetchMergedChatChannels();
};

const importStickyNotesToRemote = async (stickyNotes: WorkspaceStickyNote[]) => {
  for (const note of stickyNotes) {
    await upsertRemoteStickyNote(note);
  }

  return fetchMergedStickyNotes();
};

const hasChangedRecord = <T extends { id: string }>(currentRecords: T[], nextRecord: T) => {
  const previous = currentRecords.find((record) => record.id === nextRecord.id);
  return !previous || JSON.stringify(previous) !== JSON.stringify(nextRecord);
};

export function useImportWorkspaceData() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ImportWorkspacePayload) => {
      if (!isSupabaseReady()) {
        return updateWorkspaceData((current) => {
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
        });
      }

      ensureRemoteImportMode(payload.mode);
      const current = readWorkspaceData();
      const patch: Partial<WorkspaceData> = {};

      if (payload.entity === "workspace") {
        const records = payload.records;

        if (records.teamMembers?.length) {
          patch.teamMembers = await importTeamMembersToRemote(records.teamMembers);
        }
        if (records.projects?.length) {
          patch.projects = await importProjectsToRemote(records.projects);
        }
        if (records.tasks?.length) {
          patch.tasks = await importTasksToRemote(records.tasks);
        }
        if (records.tickets?.length) {
          patch.tickets = await importTicketsToRemote(records.tickets);
        }
        if (records.meetings?.length) {
          patch.meetings = await importMeetingsToRemote(records.meetings);
        }
        if (records.personalEvents?.length) {
          patch.personalEvents = await importPersonalEventsToRemote(records.personalEvents);
        }
        if (records.chatChannels?.length) {
          patch.chatChannels = await importChatChannelsToRemote(records.chatChannels);
        }
        if (records.stickyNotes?.length) {
          patch.stickyNotes = await importStickyNotesToRemote(records.stickyNotes);
        }
        if (records.userAccounts?.length) {
          patch.userAccounts = await importUserAccountsToRemote(records.userAccounts);
        }
        if (records.dashboards?.length) {
          for (const dashboard of records.dashboards) {
            await upsertRemoteDashboard(dashboard);
          }
          patch.dashboards = await fetchMergedDashboards();
        }

        const presentationPatch: Record<string, unknown> = {};
        if (records.workflows?.length) presentationPatch.workflows = records.workflows;
        if (records.reportTemplates?.length) presentationPatch.reportTemplates = records.reportTemplates;
        if (records.projectTemplates?.length) presentationPatch.projectTemplates = records.projectTemplates;
        if (Object.keys(presentationPatch).length) {
          await syncRemoteWorkspaceState(presentationPatch);
          if (presentationPatch.workflows) patch.workflows = await fetchMergedWorkflows();
          if (presentationPatch.reportTemplates) patch.reportTemplates = await fetchMergedReportTemplates();
          if (presentationPatch.projectTemplates) patch.projectTemplates = await fetchMergedProjectTemplates();
        }

        if (records.settings) {
          const nextSettings = await syncWorkspaceSettings(records.settings);
          patch.settings = await mergeSettingsWithRemoteContext(nextSettings);
        } else if (Object.keys(presentationPatch).length) {
          patch.settings = await mergeSettingsWithRemoteContext(current.settings);
        }

        await createRemoteAuditLog({
          action: "Workspace import completed",
          entityType: "settings",
          entityId: current.settings.namespace.slug,
          detail: `Imported workspace package datasets: ${Object.keys(records)
            .filter((key) => key !== "auditLogs")
            .join(", ")}.`,
          actorName: current.settings.currentUser.displayName,
        });
        patch.auditLogs = await fetchMergedAuditLogs();
        writeWorkspacePatch(patch);
        return patch;
      }

      switch (payload.entity) {
        case "projects":
          patch.projects = await importProjectsToRemote(payload.records as WorkspaceProject[]);
          break;
        case "tasks":
          patch.tasks = await importTasksToRemote(payload.records as WorkspaceTask[]);
          break;
        case "teamMembers":
          patch.teamMembers = await importTeamMembersToRemote(payload.records as WorkspaceTeamMember[]);
          break;
        case "tickets":
          patch.tickets = await importTicketsToRemote(payload.records as WorkspaceTicket[]);
          break;
        case "userAccounts":
          patch.userAccounts = await importUserAccountsToRemote(payload.records as WorkspaceUserAccount[]);
          break;
        case "meetings":
          patch.meetings = await importMeetingsToRemote(payload.records as WorkspaceMeeting[]);
          break;
        case "personalEvents":
          patch.personalEvents = await importPersonalEventsToRemote(payload.records as WorkspacePersonalEvent[]);
          break;
        case "chatChannels":
          patch.chatChannels = await importChatChannelsToRemote(payload.records as WorkspaceChatChannel[]);
          break;
        case "stickyNotes":
          patch.stickyNotes = await importStickyNotesToRemote(payload.records as WorkspaceStickyNote[]);
          break;
      }

      await createRemoteAuditLog({
        action: "Dataset import completed",
        entityType:
          payload.entity === "teamMembers"
            ? "team"
            : payload.entity === "chatChannels"
              ? "chat"
              : payload.entity === "stickyNotes"
                ? "sticky-note"
                : payload.entity === "personalEvents"
                  ? "event"
                  : payload.entity === "userAccounts"
                    ? "user"
                    : payload.entity === "meetings"
                      ? "meeting"
                      : payload.entity === "tickets"
                        ? "ticket"
                        : payload.entity === "tasks"
                          ? "task"
                          : "project",
        entityId: payload.entity,
        detail: `Imported ${(payload.records as Array<unknown>).length} ${payload.entity} record(s) into the database-backed workspace.`,
        actorName: current.settings.currentUser.displayName,
      });
      patch.auditLogs = await fetchMergedAuditLogs();
      writeWorkspacePatch(patch);
      return patch;
    },
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
    }) => {
      if (!isSupabaseReady()) {
        return updateWorkspaceData((current) => applyRadarRowsToWorkspace(current, rows, sourceFileName));
      }

      const current = readWorkspaceData();
      const next = applyRadarRowsToWorkspace(current, rows, sourceFileName);
      const changedTeamMembers = next.teamMembers.filter((member) => hasChangedRecord(current.teamMembers, member));
      const changedProjects = next.projects.filter((project) => hasChangedRecord(current.projects, project));

      if (changedTeamMembers.length) {
        await importTeamMembersToRemote(changedTeamMembers);
      }
      if (changedProjects.length) {
        await importProjectsToRemote(changedProjects);
      }

      await createRemoteAuditLog({
        action: "Radar matrix import completed",
        entityType: "project",
        entityId: sourceFileName ?? "radar-import",
        detail: `Imported implementation radar metrics for ${rows.length} project(s).`,
        actorName: current.settings.currentUser.displayName,
      });

      const [projects, teamMembers, auditLogs] = await Promise.all([
        fetchMergedProjects(),
        fetchMergedTeamMembers(),
        fetchMergedAuditLogs(),
      ]);

      writeWorkspacePatch({
        projects,
        teamMembers,
        auditLogs,
      });

      return {
        projects,
        teamMembers,
        auditLogs,
      };
    },
    onSuccess: async () => invalidateWorkspace(qc),
  });
}
