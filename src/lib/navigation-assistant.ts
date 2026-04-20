export interface NavigationAssistantAction {
  id: string;
  label: string;
  description: string;
  path: string;
}

export interface NavigationAssistantContext {
  title: string;
  description: string;
  actions: NavigationAssistantAction[];
}

const commonActions: NavigationAssistantAction[] = [
  { id: "assistant-home", label: "Dashboard", description: "Open the portfolio command center.", path: "/" },
  { id: "assistant-new-project", label: "Create Project", description: "Start a new project record.", path: "/projects?action=create" },
  { id: "assistant-new-task", label: "Create Task", description: "Add a new delivery task.", path: "/tasks?action=create" },
  { id: "assistant-documents", label: "Documents", description: "Review project files and templates.", path: "/documents" },
  { id: "assistant-ai", label: "AI Agent", description: "Open the full AI copilot workspace.", path: "/ai-chat" },
  { id: "assistant-monitor", label: "App Monitor", description: "Review history, health, and integrity checks.", path: "/app-monitor" },
];

const contextMap: Array<{ match: (pathname: string) => boolean; context: NavigationAssistantContext }> = [
  {
    match: (pathname) => pathname === "/",
    context: {
      title: "Dashboard Assistant",
      description: "Use this view to drill into portfolio status, lifecycle activity, and executive metrics.",
      actions: [
        { id: "dash-projects", label: "Open Projects", description: "Review the full project portfolio.", path: "/projects" },
        { id: "dash-reports", label: "Open Reports", description: "Generate delivery and executive reports.", path: "/reports" },
        { id: "dash-monitor", label: "Open App Monitor", description: "Check audit history and integrity signals.", path: "/app-monitor" },
      ],
    },
  },
  {
    match: (pathname) => pathname.startsWith("/projects"),
    context: {
      title: "Projects Assistant",
      description: "From here you can create projects, open linked tasks, documents, and community workspaces.",
      actions: [
        { id: "proj-create", label: "Create Project", description: "Open a fresh project form.", path: "/projects?action=create" },
        { id: "proj-schedule", label: "Open Schedule", description: "Plan dates, phases, and dependencies.", path: "/schedule" },
        { id: "proj-docs", label: "Open Documents", description: "Review generated PMI and SAP deliverables.", path: "/documents" },
        { id: "proj-chat", label: "Open Team Chat", description: "Coordinate work with the project team.", path: "/team-chat" },
      ],
    },
  },
  {
    match: (pathname) => pathname.startsWith("/tasks"),
    context: {
      title: "Tasks Assistant",
      description: "Manage activity execution, timesheets, and direct links back to projects and schedule planning.",
      actions: [
        { id: "task-create", label: "Create Task", description: "Add a new task or follow-up activity.", path: "/tasks?action=create" },
        { id: "task-schedule", label: "Open Schedule", description: "Adjust dependency-driven planning.", path: "/schedule" },
        { id: "task-tickets", label: "Open Tickets", description: "Review issues linked to tasks.", path: "/tickets" },
      ],
    },
  },
  {
    match: (pathname) => pathname.startsWith("/schedule"),
    context: {
      title: "Schedule Assistant",
      description: "Use the schedule to manage dependencies, date planning, and project execution sequencing.",
      actions: [
        { id: "sched-projects", label: "Open Projects", description: "Return to the project portfolio.", path: "/projects" },
        { id: "sched-tasks", label: "Open Tasks", description: "Review the synced execution list.", path: "/tasks" },
        { id: "sched-calendar", label: "Open Calendar", description: "Review date commitments by person and project.", path: "/calendar" },
      ],
    },
  },
  {
    match: (pathname) => pathname.startsWith("/documents"),
    context: {
      title: "Documents Assistant",
      description: "Use the document drive to review generated templates, attachments, and sign-off progress.",
      actions: [
        { id: "docs-projects", label: "Open Projects", description: "Generate or refresh project deliverables.", path: "/projects" },
        { id: "docs-chat", label: "Open Team Chat", description: "Discuss document review with the team.", path: "/team-chat" },
        { id: "docs-reports", label: "Open Reports", description: "Export status summaries and reporting packs.", path: "/reports" },
      ],
    },
  },
  {
    match: (pathname) => pathname.startsWith("/team-chat"),
    context: {
      title: "Team Chat Assistant",
      description: "Project group channels, quick links, and team coordination all live here.",
      actions: [
        { id: "chat-projects", label: "Open Projects", description: "Return to the related project workspace.", path: "/projects" },
        { id: "chat-docs", label: "Open Documents", description: "Open files and deliverables linked to the channel.", path: "/documents" },
        { id: "chat-schedule", label: "Open Schedule", description: "Check timeline impacts before replying.", path: "/schedule" },
      ],
    },
  },
  {
    match: (pathname) => pathname.startsWith("/app-monitor"),
    context: {
      title: "App Monitor Assistant",
      description: "Review audit logs, data integrity issues, and workspace governance from one place.",
      actions: [
        { id: "mon-settings", label: "Open Settings", description: "Adjust admin and integration controls.", path: "/settings" },
        { id: "mon-dashboard", label: "Open Dashboard", description: "Return to the portfolio summary.", path: "/" },
        { id: "mon-ai", label: "Ask AI Agent", description: "Open the full AI assistant for deeper analysis.", path: "/ai-chat" },
      ],
    },
  },
];

export const getNavigationAssistantContext = (pathname: string): NavigationAssistantContext => {
  const match = contextMap.find((item) => item.match(pathname));
  return (
    match?.context ?? {
      title: "Workspace Assistant",
      description: "Open any screen, create records quickly, or ask the AI copilot about current workspace data.",
      actions: commonActions.slice(0, 4),
    }
  );
};

export const getNavigationAssistantCommonActions = () => commonActions;

export const getNavigationAssistantPrompts = (pathname: string) => {
  if (pathname.startsWith("/projects")) {
    return [
      "Show me all project documents and links for the current portfolio",
      "Which projects are at risk and what should I open first?",
      "Find the project with the most open tasks and tickets",
    ];
  }

  if (pathname.startsWith("/schedule")) {
    return [
      "Show projects with the highest implementation activity by stage",
      "Find overdue schedule-related tasks and linked projects",
      "Open the critical execution areas I should review today",
    ];
  }

  if (pathname.startsWith("/documents")) {
    return [
      "Find all charter, BRD, and schedule plan documents",
      "Show pending document reviews and where to open them",
      "Which projects have PMI documents ready for sign-off?",
    ];
  }

  return [
    "What should I review first in this workspace today?",
    "Find projects, tasks, tickets, and documents related to ERP",
    "Show me where the highest-risk work is and give me links",
  ];
};
