import { readWorkspaceData } from "@/lib/workspace-store";

export interface WorkspaceSearchResult {
  id: string;
  title: string;
  subtitle: string;
  section: string;
  path: string;
  preview?: string;
  keywords: string[];
}

const tokenize = (query: string) =>
  query
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06ff-]+/)
    .filter(Boolean);

const createHaystack = (values: Array<string | undefined>) => values.filter(Boolean).join(" ").toLowerCase();
const createProjectPath = (projectId?: string) => (projectId ? `/projects?projectId=${projectId}` : "/projects");
const createTaskPath = (projectId?: string, stage?: string, status?: string) => {
  const params = new URLSearchParams();
  if (projectId) params.set("projectId", projectId);
  if (stage) params.set("stage", stage);
  if (status) params.set("status", status);
  return params.size ? `/tasks?${params.toString()}` : "/tasks";
};
const createTicketPath = (projectId?: string) => (projectId ? `/tickets?projectId=${projectId}` : "/tickets");
const createDocumentPath = (projectId?: string) => (projectId ? `/documents?projectId=${projectId}` : "/documents");
const createChannelPath = (channelId?: string) => (channelId ? `/team-chat?channelId=${channelId}` : "/team-chat");

export const getWorkspaceSearchResults = (query: string) => {
  const terms = tokenize(query);
  const {
    projects,
    tasks,
    tickets,
    teamMembers,
    userAccounts,
    stickyNotes,
    meetings,
    personalEvents,
    chatChannels,
    workflows,
    dashboards,
    reportTemplates,
    projectTemplates,
    auditLogs,
    settings,
  } = readWorkspaceData();
  const taskProjectMap = new Map(tasks.map((task) => [task.id, task.project_id ?? task.projectId]));

  const results: WorkspaceSearchResult[] = [
    { id: "nav-dashboard", title: "Go to Dashboard", subtitle: "Open portfolio dashboard", section: "Navigation", path: "/", keywords: ["dashboard", "home"] },
    { id: "nav-projects", title: "Go to Projects", subtitle: "Open projects workspace", section: "Navigation", path: "/projects", keywords: ["projects", "portfolio"] },
    { id: "nav-tasks", title: "Go to Tasks", subtitle: "Open task board", section: "Navigation", path: "/tasks", keywords: ["tasks", "board"] },
    { id: "nav-calendar", title: "Go to Calendar", subtitle: "Open user and meeting calendar", section: "Navigation", path: "/calendar", keywords: ["calendar", "meetings", "outlook"] },
    { id: "nav-documents", title: "Go to Documents", subtitle: "Open project document drive", section: "Navigation", path: "/documents", keywords: ["documents", "onedrive", "files"] },
    { id: "nav-resources", title: "Go to Resources", subtitle: "Open resource allocation workspace", section: "Navigation", path: "/resources", keywords: ["resources", "capacity", "workload"] },
    { id: "nav-team", title: "Go to Team", subtitle: "Open team and resource center", section: "Navigation", path: "/team", keywords: ["team", "resources"] },
    { id: "nav-ai", title: "Go to AI Agent", subtitle: "Open AI workspace search", section: "Navigation", path: "/ai-chat", keywords: ["ai", "search", "assistant"] },
    { id: "nav-reports", title: "Go to Reports", subtitle: "Open dynamic reporting", section: "Navigation", path: "/reports", keywords: ["reports", "templates"] },
    { id: "nav-monitor", title: "Go to App Monitor", subtitle: "Open audit history and workspace monitoring", section: "Navigation", path: "/app-monitor", keywords: ["monitor", "audit", "history", "logs", "uat"] },
    { id: "nav-tickets", title: "Go to Tickets", subtitle: "Open support tickets", section: "Navigation", path: "/tickets", keywords: ["tickets", "issues"] },
    { id: "nav-schedule", title: "Go to Schedule", subtitle: "Open scheduling workspace", section: "Navigation", path: "/schedule", keywords: ["schedule", "gantt", "ms project"] },
    { id: "nav-import", title: "Go to Import / Export", subtitle: "Open import and export tools", section: "Navigation", path: "/import-export", keywords: ["import", "export", "xml"] },
    { id: "nav-settings", title: "Go to Settings", subtitle: "Open workspace settings", section: "Navigation", path: "/settings", keywords: ["settings", "language", "roles"] },
    { id: "action-project", title: "Create Project", subtitle: "Create a new project record", section: "Actions", path: "/projects?action=create", keywords: ["create", "project", "new"] },
    { id: "action-task", title: "Create Task", subtitle: "Create a new task item", section: "Actions", path: "/tasks?action=create", keywords: ["create", "task", "new"] },
    ...projects.map((project) => ({
      id: `project-${project.id}`,
      title: project.name,
      subtitle: `Project • ${project.status} • ${project.department || "No department"}`,
      section: "Project Search",
      path: createProjectPath(project.id),
      preview: project.description,
      keywords: [
        project.name,
        project.description,
        project.department,
        project.projectNature,
        ...(project.tags ?? []),
        ...(project.resources ?? []).flatMap((resource) => [resource.name, resource.role]),
        ...(project.teamStructure ?? []).flatMap((node) => [node.name, node.title, node.reportsTo, node.responsibilities]),
        ...(project.stakeholders ?? []).flatMap((stakeholder) => [stakeholder.name, stakeholder.role, stakeholder.notes]),
        ...(project.risks ?? []).flatMap((risk) => [risk.title, risk.description, risk.category, risk.owner, risk.mitigation]),
        ...(project.documents ?? []).flatMap((document) => [document.name, document.phase, document.deliverableType, document.reviewStatus, document.standardTemplate]),
        ...Object.values(project.customFieldValues ?? {}).map((value) => String(value)),
      ].filter(Boolean) as string[],
    })),
    ...projects.flatMap((project) =>
      (project.documents ?? []).map((document) => ({
        id: `document-${document.id}`,
        title: document.name,
        subtitle: `Document • ${project.name} • ${document.category}`,
        section: "Document Search",
        path: createDocumentPath(project.id),
        preview: document.content,
        keywords: [document.name, document.type, document.content, project.name, document.folder, document.provider, document.phase, document.deliverableType, document.outputFormat, document.reviewStatus, document.linkedChannelName, document.standardTemplate].filter(Boolean) as string[],
      })),
    ),
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      subtitle: `Task • ${task.status} • ${task.projectName || "Unassigned project"}`,
      section: "Task Search",
      path: createTaskPath(task.project_id ?? task.projectId, undefined, task.status),
      preview: task.description,
      keywords: [task.title, task.description, task.assignee, task.projectName, ...(task.tags ?? []), ...Object.values(task.customFieldValues ?? {}).map((value) => String(value))].filter(Boolean) as string[],
    })),
    ...tickets.map((ticket) => ({
      id: `ticket-${ticket.id}`,
      title: `${ticket.id} • ${ticket.title}`,
      subtitle: `Ticket • ${ticket.status} • ${ticket.assignee}`,
      section: "Ticket Search",
      path: createTicketPath(ticket.projectId ?? taskProjectMap.get(ticket.taskId ?? "")),
      preview: ticket.description,
      keywords: [ticket.id, ticket.title, ticket.description, ticket.assignee, ...Object.values(ticket.customFieldValues ?? {}).map((value) => String(value))].filter(Boolean) as string[],
    })),
    ...teamMembers.map((member) => ({
      id: `member-${member.id}`,
      title: member.name,
      subtitle: `Team • ${member.role} • ${member.department || "No department"}`,
      section: "Team Search",
      path: "/team",
      preview: `${member.capacityHours ?? 40}h capacity • ${member.utilizationTarget ?? 85}% target`,
      keywords: [member.name, member.role, member.department, member.email, member.privilegeRole, ...Object.values(member.customFieldValues ?? {}).map((value) => String(value))].filter(Boolean) as string[],
    })),
    ...userAccounts.map((account) => ({
      id: `user-${account.id}`,
      title: account.fullName,
      subtitle: `User • ${account.status} • ${account.email}`,
      section: "User Search",
      path: "/app-monitor",
      preview: `${account.roleId} • ${account.authProvider} • ${account.department || "No department"}`,
      keywords: [account.fullName, account.email, account.roleId, account.status, account.authProvider, account.title, account.department, account.notes].filter(Boolean) as string[],
    })),
    ...stickyNotes.map((note) => ({
      id: `sticky-${note.id}`,
      title: note.title,
      subtitle: `Sticky Note - ${note.ownerName}`,
      section: "Personal Search",
      path: "/sticky-notes",
      preview: note.content,
      keywords: [note.title, note.content, note.ownerName, note.color, note.done ? "done" : "open", "sticky", "note", "todo"].filter(Boolean) as string[],
    })),
    ...meetings.map((meeting) => ({
      id: `meeting-${meeting.id}`,
      title: meeting.title,
      subtitle: `Meeting • ${meeting.type} • ${meeting.provider}`,
      section: "Calendar Search",
      path: meeting.projectId ? `/calendar?projectId=${meeting.projectId}` : "/calendar",
      preview: `${meeting.startsAt} to ${meeting.endsAt}`,
      keywords: [meeting.title, meeting.type, meeting.provider, meeting.notes, meeting.joinUrl].filter(Boolean) as string[],
    })),
    ...personalEvents.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      subtitle: `Personal Event • ${event.type}`,
      section: "Calendar Search",
      path: "/calendar",
      preview: `${event.startsAt} to ${event.endsAt}`,
      keywords: [event.title, event.type, event.notes].filter(Boolean) as string[],
    })),
    ...chatChannels.map((channel) => ({
      id: `chat-${channel.id}`,
      title: channel.name,
      subtitle: `Chat • ${channel.messages.length} messages`,
      section: "Community Search",
      path: createChannelPath(channel.id),
      preview: channel.topic,
      keywords: [channel.name, channel.topic, channel.whatsappGroupUrl, ...channel.messages.flatMap((message) => [message.authorName, message.message])].filter(Boolean) as string[],
    })),
    ...workflows.map((workflow) => ({
      id: `workflow-${workflow.id}`,
      title: workflow.name,
      subtitle: `Workflow • ${workflow.entity}`,
      section: "Workflow Search",
      path: "/settings",
      preview: workflow.description,
      keywords: [workflow.name, workflow.description, workflow.entity, ...workflow.stages.map((stage) => stage.name), ...workflow.automationRules].filter(Boolean) as string[],
    })),
    ...dashboards.map((dashboard) => ({
      id: `dashboard-${dashboard.id}`,
      title: dashboard.name,
      subtitle: `Dashboard • ${dashboard.widgets.length} widgets`,
      section: "Dashboard Search",
      path: dashboard.isDefault ? "/" : `/?dashboard=${dashboard.id}`,
      preview: dashboard.widgets.map((widget) => widget.title).join(", "),
      keywords: [dashboard.name, ...dashboard.widgets.map((widget) => widget.title)].filter(Boolean) as string[],
    })),
    ...reportTemplates.map((template) => ({
      id: `report-${template.id}`,
      title: template.name,
      subtitle: `Report • ${template.focus}`,
      section: "Report Search",
      path: "/reports",
      preview: template.description,
      keywords: [template.name, template.focus, template.description, ...template.columns].filter(Boolean) as string[],
    })),
    ...projectTemplates.map((template) => ({
      id: `template-${template.id}`,
      title: template.name,
      subtitle: `Project Template • ${template.category}`,
      section: "Template Search",
      path: "/settings",
      preview: template.description,
      keywords: [template.name, template.category, template.description, ...template.defaultTaskPhases, ...template.defaultTags].filter(Boolean) as string[],
    })),
    ...auditLogs.map((log) => ({
      id: `audit-${log.id}`,
      title: log.action,
      subtitle: `Audit • ${log.entityType} • ${log.actorName}`,
      section: "Audit Search",
      path: "/app-monitor",
      preview: log.detail,
      keywords: [log.action, log.entityType, log.actorName, log.detail].filter(Boolean) as string[],
    })),
    {
      id: "system-namespace",
      title: settings.namespace.organization,
      subtitle: `Workspace • ${settings.namespace.slug}`,
      section: "System Search",
      path: "/settings",
      preview: `${settings.namespace.portfolioOffice} • ${settings.namespace.timezone}`,
      keywords: [settings.namespace.organization, settings.namespace.slug, settings.namespace.portfolioOffice, settings.namespace.timezone, settings.currentUser.displayName].filter(Boolean) as string[],
    },
  ];

  if (!terms.length) {
    return results.slice(0, 32);
  }

  return results
    .map((result) => ({
      result,
      score: terms.reduce((score, term) => {
        const haystack = createHaystack([result.title, result.subtitle, result.preview, ...result.keywords]);
        if (result.title.toLowerCase().includes(term)) return score + 6;
        if (result.subtitle.toLowerCase().includes(term)) return score + 4;
        if (haystack.includes(term)) return score + 2;
        return score;
      }, 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.result.title.localeCompare(right.result.title))
    .map(({ result }) => result)
    .slice(0, 40);
};

export const getAssistantLinkSuggestions = (query: string, limit = 6) => {
  const uniqueResults = new Map<string, WorkspaceSearchResult>();

  getWorkspaceSearchResults(query).forEach((result) => {
    if (!uniqueResults.has(result.id)) {
      uniqueResults.set(result.id, result);
    }
  });

  return Array.from(uniqueResults.values()).slice(0, limit);
};
