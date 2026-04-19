import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  makeId,
  readWorkspaceData,
  updateWorkspaceData,
  type WorkspaceChatChannel,
  type WorkspaceDashboard,
  type WorkspaceData,
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

const workspaceKeys = {
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

const invalidateWorkspace = (qc: ReturnType<typeof useQueryClient>) =>
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

export function useProjects() {
  return useQuery({
    queryKey: workspaceKeys.projects,
    queryFn: async () => readWorkspaceData().projects,
  });
}

export function useTasks(projectId?: string) {
  return useQuery({
    queryKey: workspaceKeys.tasks(projectId),
    queryFn: async () => {
      const { tasks, projects } = readWorkspaceData();
      const normalized = tasks.map((task) => normalizeTask(task, projects));
      return projectId ? normalized.filter((task) => task.project_id === projectId) : normalized;
    },
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
    queryFn: async () => readWorkspaceData().teamMembers,
  });
}

export function useWorkspaceSettings() {
  return useQuery({
    queryKey: workspaceKeys.settings,
    queryFn: async () => readWorkspaceData().settings,
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
    queryFn: async () => readWorkspaceData().stickyNotes,
  });
}

export function useMeetings(projectId?: string) {
  return useQuery({
    queryKey: [...workspaceKeys.meetings, projectId ?? "all"] as const,
    queryFn: async () => {
      const meetings = readWorkspaceData().meetings;
      return projectId ? meetings.filter((meeting) => meeting.projectId === projectId) : meetings;
    },
  });
}

export function usePersonalEvents(memberId?: string) {
  return useQuery({
    queryKey: [...workspaceKeys.personalEvents, memberId ?? "all"] as const,
    queryFn: async () => {
      const events = readWorkspaceData().personalEvents;
      return memberId ? events.filter((event) => event.memberId === memberId) : events;
    },
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
      const { projects, tasks, tickets, teamMembers, meetings, chatChannels, workflows, dashboards, settings } = readWorkspaceData();
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
    mutationFn: async (project: Partial<WorkspaceProject> & { name: string }) =>
      updateWorkspaceData((current) => {
        const record: WorkspaceProject = {
          id: makeId("project"),
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

        return { ...current, projects: [record, ...current.projects] };
      }).projects[0],
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceProject> & { id: string }) =>
      updateWorkspaceData((current) => ({
        ...current,
        projects: current.projects.map((project) => {
          if (project.id !== id) return project;
          const next = { ...project, ...updates };
          return {
            ...next,
            startDate: next.startDate ?? next.start_date ?? project.startDate,
            endDate: next.endDate ?? next.end_date ?? project.endDate,
            start_date: next.start_date ?? next.startDate ?? project.start_date,
            end_date: next.end_date ?? next.endDate ?? project.end_date,
          };
        }),
      })).projects.find((project) => project.id === id),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      updateWorkspaceData((current) => ({
        ...current,
        projects: current.projects.filter((project) => project.id !== id),
        tasks: current.tasks.filter((task) => (task.project_id ?? task.projectId) !== id),
        tickets: current.tickets.filter((ticket) => ticket.projectId !== id),
      })),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (task: Partial<WorkspaceTask> & { title: string }) =>
      updateWorkspaceData((current) => {
        const project = current.projects.find((item) => item.id === (task.project_id ?? task.projectId));
        const dueDate = task.due_date ?? task.dueDate ?? "";
        const record: WorkspaceTask = {
          id: makeId("task"),
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
        return { ...current, tasks: nextTasks, projects: recalcProjects(current.projects, nextTasks) };
      }).tasks[0],
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceTask> & { id: string }) =>
      updateWorkspaceData((current) => {
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

        return {
          ...current,
          tasks: nextTasks,
          projects: recalcProjects(current.projects, nextTasks),
        };
      }).tasks.find((task) => task.id === id),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      updateWorkspaceData((current) => {
        const nextTasks = current.tasks.filter((task) => task.id !== id);
        return {
          ...current,
          tasks: nextTasks,
          tickets: current.tickets.filter((ticket) => ticket.taskId !== id),
          projects: recalcProjects(current.projects, nextTasks),
        };
      }),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateTeamMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (member: Partial<WorkspaceTeamMember> & { name: string }) =>
      updateWorkspaceData((current) => {
        const initials = member.name
          .split(" ")
          .map((part) => part[0]?.toUpperCase() ?? "")
          .join("")
          .slice(0, 2);

        const record: WorkspaceTeamMember = {
          id: makeId("member"),
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

        return { ...current, teamMembers: [...current.teamMembers, record] };
      }).teamMembers.at(-1),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateTeamMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceTeamMember> & { id: string }) =>
      updateWorkspaceData((current) => ({
        ...current,
        teamMembers: current.teamMembers.map((member) =>
          member.id === id ? { ...member, ...updates } : member,
        ),
      })).teamMembers.find((member) => member.id === id),
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

        return {
          ...current,
          userAccounts: [record, ...current.userAccounts],
          teamMembers: current.teamMembers.map((member) =>
            member.id === record.teamMemberId
              ? {
                  ...member,
                  email: record.email,
                  privilegeRole: record.roleId,
                }
              : member,
          ),
        };
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
        const teamMemberId = updates.teamMemberId ?? existing?.teamMemberId ?? "";
        return {
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
        };
      }).userAccounts.find((account) => account.id === id),
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
        return { ...current, tickets: [record, ...current.tickets] };
      }).tickets[0],
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceTicket> & { id: string }) =>
      updateWorkspaceData((current) => ({
        ...current,
        tickets: current.tickets.map((ticket) => (ticket.id === id ? { ...ticket, ...updates } : ticket)),
      })).tickets.find((ticket) => ticket.id === id),
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
      updateWorkspaceData((current) => ({
        ...current,
        chatChannels: current.chatChannels.map((channel) =>
          channel.id === channelId
            ? {
                ...channel,
                messages: [
                  ...channel.messages,
                  { id: makeId("chat"), authorName, authorId, message, createdAt: new Date().toISOString() },
                ],
              }
            : channel,
        ),
      })).chatChannels.find((channel) => channel.id === channelId),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateChatChannel() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (channel: Partial<WorkspaceChatChannel> & { name: string; topic: string }) =>
      updateWorkspaceData((current) => ({
        ...current,
        chatChannels: [
          ...current.chatChannels,
          {
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
          },
        ],
      })).chatChannels.at(-1),
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
    mutationFn: async (meeting: Partial<WorkspaceMeeting> & { title: string; startsAt: string; endsAt: string }) =>
      updateWorkspaceData((current) => ({
        ...current,
        meetings: [
          {
            id: makeId("meeting"),
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
          },
          ...current.meetings,
        ],
      })).meetings[0],
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateMeeting() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceMeeting> & { id: string }) =>
      updateWorkspaceData((current) => ({
        ...current,
        meetings: current.meetings.map((meeting) => (meeting.id === id ? { ...meeting, ...updates } : meeting)),
      })).meetings.find((meeting) => meeting.id === id),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreatePersonalEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (event: Partial<WorkspacePersonalEvent> & { title: string; memberId: string; startsAt: string; endsAt: string }) =>
      updateWorkspaceData((current) => ({
        ...current,
        personalEvents: [
          {
            id: makeId("event"),
            title: event.title,
            memberId: event.memberId,
            type: event.type ?? "personal",
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            notes: event.notes,
          },
          ...current.personalEvents,
        ],
      })).personalEvents[0],
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdatePersonalEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspacePersonalEvent> & { id: string }) =>
      updateWorkspaceData((current) => ({
        ...current,
        personalEvents: current.personalEvents.map((event) => (event.id === id ? { ...event, ...updates } : event)),
      })).personalEvents.find((event) => event.id === id),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateWorkspaceSettings() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (settings: WorkspaceSettings) =>
      updateWorkspaceData((current) => ({
        ...current,
        settings,
      })).settings,
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useCreateStickyNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (note: Omit<WorkspaceStickyNote, "id" | "createdAt">) =>
      updateWorkspaceData((current) => ({
        ...current,
        stickyNotes: [
          {
            id: makeId("note"),
            createdAt: new Date().toISOString(),
            ...note,
          },
          ...current.stickyNotes,
        ],
      })).stickyNotes[0],
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useUpdateStickyNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkspaceStickyNote> & { id: string }) =>
      updateWorkspaceData((current) => ({
        ...current,
        stickyNotes: current.stickyNotes.map((note) => (note.id === id ? { ...note, ...updates } : note)),
      })).stickyNotes.find((note) => note.id === id),
    onSuccess: async () => invalidateWorkspace(qc),
  });
}

export function useDeleteStickyNote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) =>
      updateWorkspaceData((current) => ({
        ...current,
        stickyNotes: current.stickyNotes.filter((note) => note.id !== id),
      })),
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
