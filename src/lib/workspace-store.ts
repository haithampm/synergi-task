import {
  projects as seedProjects,
  tasks as seedTasks,
  teamMembers as seedTeamMembers,
  type Project,
  type Task,
  type TeamMember,
} from "@/lib/mock-data";

export interface WorkspaceProject extends Project {
  start_date?: string;
  end_date?: string;
  budget?: string;
  department?: string;
  projectNature?: string;
  tags?: string[];
  files?: Array<{ name: string; size?: string; uploadedAt?: string }>;
  milestones?: Array<{ title: string; date?: string }>;
  resources?: WorkspaceProjectResource[];
  teamStructure?: WorkspaceProjectTeamNode[];
  stakeholders?: WorkspaceProjectStakeholder[];
  risks?: WorkspaceProjectRisk[];
  documents?: WorkspaceProjectDocument[];
  risk_level?: "low" | "medium" | "high";
  namespace?: string;
  workflowId?: string;
  customFieldValues?: Record<string, string | number | boolean>;
  radarLifecycle?: WorkspaceProjectRadarMetrics;
}

export interface WorkspaceProjectRadarStageCounts {
  planning: number;
  analysis: number;
  infra: number;
  design: number;
  development: number;
  uat: number;
  deployment: number;
  training: number;
  "go-live": number;
  support: number;
}

export interface WorkspaceProjectRadarMetrics {
  source: "csv-radar" | "manual";
  ownerName: string;
  totalActivities: number;
  completionPct?: number;
  importedAt: string;
  sourceFileName?: string;
  stageCounts: WorkspaceProjectRadarStageCounts;
}

export interface WorkspaceProjectResource {
  id: string;
  name: string;
  role: string;
  allocation: number;
  plannedHours: number;
  memberId?: string;
}

export interface WorkspaceProjectTeamNode {
  id: string;
  name: string;
  title: string;
  memberId?: string;
  reportsTo?: string;
  responsibilities?: string;
}

export interface WorkspaceProjectStakeholder {
  id: string;
  name: string;
  role: string;
  influence: "high" | "medium" | "low";
  interest: "high" | "medium" | "low";
  engagement: "manage closely" | "keep satisfied" | "keep informed" | "monitor";
  notes?: string;
}

export interface WorkspaceProjectRisk {
  id: string;
  title: string;
  description: string;
  category: string;
  probability: "high" | "medium" | "low";
  impact: "high" | "medium" | "low";
  owner: string;
  mitigation: string;
  status: "open" | "monitoring" | "mitigated" | "closed";
}

export interface WorkspaceProjectDocument {
  id: string;
  name: string;
  type: string;
  category: "template" | "attachment";
  content: string;
  uploadedAt: string;
  generated: boolean;
  phase?: "Initiation" | "Planning" | "Execution" | "Monitoring & Controlling" | "Closing";
  deliverableType?: string;
  documentNature?: "narrative" | "register" | "signoff" | "report" | "worksheet";
  outputFormat?: "doc" | "xlsx" | "pdf" | "txt";
  standardTemplate?: "PMI" | "SAP" | "PMO" | "Custom";
  reviewStatus?: "draft" | "in-review" | "approved" | "signed";
  linkedChannelId?: string;
  linkedChannelName?: string;
  folder?: string;
  access?: "private" | "project" | "shared";
  createdBy?: string;
  lastModifiedAt?: string;
  lastModifiedBy?: string;
  provider?: "workspace" | "onedrive";
  externalUrl?: string;
  metadata?: {
    size?: string;
    extension?: string;
    templateTheme?: string;
    templatePalette?: string;
    templateLayout?: string;
  };
  versions?: WorkspaceDocumentVersion[];
}

export interface WorkspaceDocumentVersion {
  id: string;
  editedAt: string;
  editedBy: string;
  summary: string;
  content: string;
}

export interface WorkspaceTask extends Task {
  due_date?: string;
  start_date?: string;
  end_date?: string;
  project_id?: string;
  parentTaskId?: string;
  phase?: string;
  progress?: number;
  isMilestone?: boolean;
  predecessors?: string[];
  assignee_id?: string;
  assignees?: string[];
  files?: Array<{ name: string; size?: string }>;
  comments?: Array<{ id: string; author: string; message: string; createdAt: string }>;
  duration?: string;
  workloadHours?: number;
  workflowStage?: string;
  timesheetEntries?: WorkspaceTimesheetEntry[];
  customFieldValues?: Record<string, string | number | boolean>;
}

export interface WorkspaceTimesheetEntry {
  id: string;
  date: string;
  member: string;
  hours: number;
  activity: string;
  notes?: string;
}

export interface WorkspaceTeamMember extends TeamMember {
  phone?: string;
  department?: string;
  avatarColor?: string;
  assignedProjectIds?: string[];
  capacityHours?: number;
  utilizationTarget?: number;
  privilegeRole?: string;
  customFieldValues?: Record<string, string | number | boolean>;
}

export interface WorkspaceUserAccount {
  id: string;
  fullName: string;
  email: string;
  roleId: string;
  status: "active" | "invited" | "suspended";
  authProvider: "email" | "google" | "hybrid";
  teamMemberId?: string;
  title?: string;
  department?: string;
  createdAt: string;
  lastAccessAt?: string;
  invitationSentAt?: string;
  passwordResetSentAt?: string;
  lastNotificationAt?: string;
  notificationCount?: number;
  invitedBy?: string;
  notes?: string;
}

export interface WorkspaceTicket {
  id: string;
  title: string;
  description: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  priority: "high" | "medium" | "low";
  assignee: string;
  projectId?: string;
  taskId?: string;
  createdAt: string;
  sla: string;
  comments: Array<{ id: string; author: string; message: string; createdAt: string }>;
  customFieldValues?: Record<string, string | number | boolean>;
}

export interface WorkspaceChatMessage {
  id: string;
  authorId?: string;
  authorName: string;
  message: string;
  createdAt: string;
  parentId?: string;
  mentions?: string[];
  attachments?: Array<{ name: string; url?: string }>;
  pinned?: boolean;
}

export interface WorkspaceChatChannel {
  id: string;
  name: string;
  topic: string;
  memberIds: string[];
  messages: WorkspaceChatMessage[];
  projectId?: string;
  kind?: "general" | "deliverables" | "announcements";
  readOnly?: boolean;
  whatsappGroupUrl?: string;
  quickLinks?: Array<{ id: string; label: string; type: "meeting" | "document" | "file" | "link"; url: string }>;
}

export interface WorkspaceMeeting {
  id: string;
  title: string;
  type: string;
  projectId?: string;
  taskId?: string;
  channelId?: string;
  organizerId?: string;
  attendeeIds: string[];
  startsAt: string;
  endsAt: string;
  provider: "workspace" | "outlook" | "teams";
  joinUrl?: string;
  notes?: string;
  status: "scheduled" | "completed" | "cancelled";
}

export interface WorkspacePersonalEvent {
  id: string;
  memberId: string;
  title: string;
  type: "personal" | "pto" | "focus" | "travel";
  startsAt: string;
  endsAt: string;
  notes?: string;
}

export interface WorkspaceProjectTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  defaultTaskPhases: string[];
  defaultRiskCategories: string[];
  defaultTags: string[];
  charterPrompt: string;
}

export interface WorkspaceAuditLog {
  id: string;
  action: string;
  entityType: "project" | "task" | "meeting" | "document" | "user" | "settings" | "ticket" | "chat" | "team" | "event" | "sticky-note";
  entityId: string;
  actorName: string;
  detail: string;
  createdAt: string;
}

export interface WorkspaceStickyNote {
  id: string;
  ownerUserAccountId?: string;
  ownerTeamMemberId?: string;
  ownerName: string;
  title: string;
  content: string;
  color: "amber" | "sky" | "emerald" | "rose";
  done: boolean;
  createdAt: string;
}

export interface WorkspaceConfigOption {
  id: string;
  label: string;
  value: string;
  active: boolean;
  order: number;
  color?: string;
}

export interface WorkspaceFieldConfig {
  key: string;
  label: string;
  options: WorkspaceConfigOption[];
}

export interface WorkspaceCustomFieldConfig {
  id: string;
  entity: "project" | "task" | "teamMember" | "ticket";
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox";
  placeholder?: string;
  helpText?: string;
  required: boolean;
  active: boolean;
  options?: WorkspaceConfigOption[];
}

export interface WorkspaceIntegrationConnection {
  providerLabel: string;
  enabled: boolean;
  connected: boolean;
  syncMode: "read" | "write" | "two-way";
  status: string;
  lastSyncAt?: string;
  scopes: string[];
  configuration?: {
    clientId?: string;
    tenantId?: string;
    redirectUri?: string;
    resourceUrl?: string;
  };
}

export interface WorkspaceWorkflowStage {
  id: string;
  name: string;
  slaHours: number;
  color: string;
}

export interface WorkspaceWorkflow {
  id: string;
  name: string;
  entity: "task" | "ticket" | "project";
  description: string;
  stages: WorkspaceWorkflowStage[];
  automationRules: string[];
}

export interface WorkspaceDashboardWidget {
  id: string;
  key: string;
  title: string;
  type: "metric" | "list" | "chart" | "workflow";
  enabled: boolean;
  size: "sm" | "md" | "lg";
}

export interface WorkspaceDashboard {
  id: string;
  name: string;
  isDefault: boolean;
  widgets: WorkspaceDashboardWidget[];
}

export interface WorkspaceReportTemplate {
  id: string;
  name: string;
  focus: "executive" | "resource" | "risk" | "schedule";
  description: string;
  columns: string[];
}

export interface WorkspacePermissionRole {
  id: string;
  name: string;
  permissions: string[];
}

export interface WorkspaceSettings {
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
  };
  namespace: {
    organization: string;
    slug: string;
    portfolioOffice: string;
    timezone: string;
  };
  currentUser: {
    displayName: string;
    roleId: string;
    teamMemberId?: string;
    authUserId?: string;
    userAccountId?: string;
  };
  notifications: {
    email: boolean;
    push: boolean;
    reminders: boolean;
    digest: boolean;
    inApp: boolean;
  };
  appearance: {
    darkMode: boolean;
    compactView: boolean;
    language: "en" | "ar";
    sidebarCollapsed: boolean;
    sidebarAutoHide: boolean;
  };
  security: {
    twoFactor: boolean;
    passwordLastChangedAt?: string;
  };
  ai: {
    autoRiskScan: boolean;
    scheduleAdvisor: boolean;
    reportNarratives: boolean;
  };
  msProject: {
    defaultCalendar: string;
    autoSyncProjectDates: boolean;
    includeDependenciesInExport: boolean;
  };
  integrations: {
    outlook: WorkspaceIntegrationConnection;
    teams: WorkspaceIntegrationConnection;
    onedrive: WorkspaceIntegrationConnection;
    whatsapp: WorkspaceIntegrationConnection;
    googleCalendar: WorkspaceIntegrationConnection;
  };
  metadata: WorkspaceFieldConfig[];
  customFields: WorkspaceCustomFieldConfig[];
  branding: {
    appName: string;
    homeLabel: string;
  };
  privilegeRoles: WorkspacePermissionRole[];
}

export interface WorkspaceData {
  projects: WorkspaceProject[];
  tasks: WorkspaceTask[];
  teamMembers: WorkspaceTeamMember[];
  userAccounts: WorkspaceUserAccount[];
  stickyNotes: WorkspaceStickyNote[];
  meetings: WorkspaceMeeting[];
  personalEvents: WorkspacePersonalEvent[];
  tickets: WorkspaceTicket[];
  chatChannels: WorkspaceChatChannel[];
  workflows: WorkspaceWorkflow[];
  dashboards: WorkspaceDashboard[];
  reportTemplates: WorkspaceReportTemplate[];
  projectTemplates: WorkspaceProjectTemplate[];
  auditLogs: WorkspaceAuditLog[];
  settings: WorkspaceSettings;
}

const STORAGE_KEY = "synergi-workspace-data";
const STORAGE_META_KEY = "synergi-workspace-data-meta";
const REMOTE_STORAGE_SCHEMA_VERSION = "remote-cache-v1";
const fullCycleScenarioProjectId = "sample-full-cycle-program";
const projectStatuses = new Set<WorkspaceProject["status"]>(["active", "on-hold", "completed", "at-risk", "archived"]);
const teamMemberStatuses = new Set<WorkspaceTeamMember["status"]>(["online", "away", "offline"]);
const requestedProjectCatalogNames = [
  "EPM-IDT Phase 3",
  "EPM-Zein EPM III - HR",
  "EPM-Zein EPM III - Finance",
  "EPM-Cleaning",
  "HRM-Zein - Finance",
  "HRM-Zein - HR",
  "HRM-Revenue Collection",
  "HRM-Gardening",
  "HRM-Cleaning",
  "HRM-Archiving Project II",
  "HRM-Etmam Platform in Hail",
  "MOD-Housing",
  "JRM-Development and operation",
  "HBM-Strategic Management Office",
  "MM-Operation & Maintenance 940",
  "EPM-940 Phase 4",
  "Hafer AlBatin-Cleaning",
  "HRM-940",
  "Madina 940",
  "EPM-Smart City Phase 2",
  "EPM-Visual Distortion",
  "EPM-Smart Lighting",
  "EPM-Webportal",
  "HRM-Zain (Axionic)",
];

type WorkspaceRecord = Record<string, unknown>;

const isWorkspaceRecord = (value: unknown): value is WorkspaceRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasAnyKey = (value: WorkspaceRecord, keys: string[]) => keys.some((key) => key in value);
const normalizeWorkspaceName = (value?: string | null) => value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
const addDaysToIsoDate = (baseDate: Date, days: number) => {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
};

const createRequestedProjectCatalog = (): Project[] => {
  const seen = new Set<string>();
  const today = new Date();

  return requestedProjectCatalogNames.reduce<Project[]>((acc, name, index) => {
    const key = normalizeWorkspaceName(name);
    if (!key || seen.has(key)) return acc;
    seen.add(key);

    const prefix = name.split("-")[0]?.trim() || "PMO";
    const startDate = addDaysToIsoDate(today, index * 3);
    const endDate = addDaysToIsoDate(today, 90 + (index % 6) * 14);

    acc.push({
      id: `seed-${key.replace(/[^a-z0-9]+/g, "-")}`,
      name,
      description: `${name} delivery workspace`,
      status: "active",
      progress: 0,
      team: [],
      startDate,
      endDate,
      tasksTotal: 0,
      tasksCompleted: 0,
      priority: prefix === "EPM" ? "high" : "medium",
    });

    return acc;
  }, []);
};

const withMissingSeedProjects = (
  projects: Partial<WorkspaceProject>[],
  baselineProjects: WorkspaceProject[],
) => {
  const seen = new Set(projects.map((project) => normalizeWorkspaceName(project.name)).filter(Boolean));
  const missing = baselineProjects.filter((project) => {
    const key = normalizeWorkspaceName(project.name);
    return key && !seen.has(key);
  });

  return missing.length > 0 ? [...projects, ...missing] : projects;
};

const mergeMissingRecordsById = <T extends { id: string }>(records: T[], missingRecords: T[]) => {
  const existingIds = new Set(records.map((record) => record.id));
  return missingRecords.length ? [...records, ...missingRecords.filter((record) => !existingIds.has(record.id))] : records;
};

const looksLikeProjectRecord = (value: unknown): value is Partial<WorkspaceProject> => {
  if (!isWorkspaceRecord(value)) return false;

  if (typeof value.status === "string") {
    if (projectStatuses.has(value.status as WorkspaceProject["status"])) return true;
    if (teamMemberStatuses.has(value.status as WorkspaceTeamMember["status"])) return false;
  }

  return hasAnyKey(value, [
    "priority",
    "budget",
    "projectNature",
    "workflowId",
    "namespace",
    "milestones",
    "resources",
    "stakeholders",
    "risks",
    "documents",
    "start_date",
    "startDate",
    "end_date",
    "endDate",
  ]);
};

const looksLikeTeamMemberRecord = (value: unknown): value is Partial<WorkspaceTeamMember> => {
  if (!isWorkspaceRecord(value)) return false;

  if (typeof value.status === "string") {
    if (teamMemberStatuses.has(value.status as WorkspaceTeamMember["status"])) return true;
    if (projectStatuses.has(value.status as WorkspaceProject["status"])) return false;
  }

  return hasAnyKey(value, [
    "email",
    "role",
    "avatar",
    "avatarColor",
    "assignedProjectIds",
    "capacityHours",
    "utilizationTarget",
    "privilegeRole",
  ]);
};

const upsertWorkspaceRecord = <T extends { id?: string; name?: string; email?: string }>(
  records: T[],
  candidate: T,
) => {
  const existingIndex = records.findIndex((record) =>
    (candidate.id && record.id === candidate.id) ||
    (candidate.email && record.email === candidate.email) ||
    (candidate.name && record.name === candidate.name),
  );

  if (existingIndex >= 0) {
    records[existingIndex] = { ...records[existingIndex], ...candidate };
    return;
  }

  records.push(candidate);
};

const sanitizeWorkspaceCollections = (
  parsed: Partial<WorkspaceData>,
  baseline: WorkspaceData,
) => {
  const rawProjects = Array.isArray(parsed.projects)
    ? parsed.projects.filter(isWorkspaceRecord)
    : null;
  const rawTeamMembers = Array.isArray(parsed.teamMembers)
    ? parsed.teamMembers.filter(isWorkspaceRecord)
    : null;

  const sanitizedProjects = rawProjects === null
    ? null
    : rawProjects.reduce<Partial<WorkspaceProject>[]>((acc, record) => {
      if (looksLikeProjectRecord(record) && !looksLikeTeamMemberRecord(record)) {
        upsertWorkspaceRecord(acc, record);
      }
      return acc;
    }, []);

  const sanitizedTeamMembers = rawTeamMembers === null
    ? null
    : rawTeamMembers.reduce<Partial<WorkspaceTeamMember>[]>((acc, record) => {
      if (looksLikeTeamMemberRecord(record) && !looksLikeProjectRecord(record)) {
        upsertWorkspaceRecord(acc, record);
      }
      return acc;
    }, []);

  const misfiledTeamMembers = (rawProjects ?? []).filter((record) => looksLikeTeamMemberRecord(record) && !looksLikeProjectRecord(record));
  const misfiledProjects = (rawTeamMembers ?? []).filter((record) => looksLikeProjectRecord(record) && !looksLikeTeamMemberRecord(record));

  const repairedProjects = sanitizedProjects ?? [...baseline.projects];
  const repairedTeamMembers = sanitizedTeamMembers ?? [...baseline.teamMembers];

  misfiledTeamMembers.forEach((record) => upsertWorkspaceRecord(repairedTeamMembers, record));
  misfiledProjects.forEach((record) => upsertWorkspaceRecord(repairedProjects, record));

  const shouldRepair =
    misfiledTeamMembers.length > 0 ||
    misfiledProjects.length > 0 ||
    (rawProjects !== null && sanitizedProjects !== null && sanitizedProjects.length !== rawProjects.length) ||
    (rawTeamMembers !== null && sanitizedTeamMembers !== null && sanitizedTeamMembers.length !== rawTeamMembers.length);

  return {
    shouldRepair,
    projects: repairedProjects,
    teamMembers: repairedTeamMembers,
  };
};

const defaultRoles: WorkspacePermissionRole[] = [
  {
    id: "admin",
    name: "Portfolio Admin",
    permissions: ["manage_projects", "manage_workflows", "manage_privileges", "view_reports", "manage_team", "manage_users", "manage_documents", "manage_integrations", "moderate_channels", "export", "view_dashboard", "manage_schedule", "manage_tasks", "manage_resources", "team_chat"],
  },
  {
    id: "pm",
    name: "Project Manager",
    permissions: ["manage_projects", "manage_tasks", "view_reports", "manage_schedule", "team_chat", "manage_documents", "share", "export"],
  },
  {
    id: "lead",
    name: "Team Lead",
    permissions: ["manage_tasks", "team_chat", "view_reports", "manage_resources", "share"],
  },
  {
    id: "viewer",
    name: "Executive Viewer",
    permissions: ["view_reports", "view_dashboard"],
  },
];

const createFieldConfig = (
  key: string,
  label: string,
  values: string[],
): WorkspaceFieldConfig => ({
  key,
  label,
  options: values.map((value, index) => ({
    id: `${key}-${index + 1}`,
    label: value,
    value: value.toLowerCase().replace(/\s+/g, "-"),
    active: true,
    order: index + 1,
  })),
});

const createCustomFieldConfig = ({
  entity,
  key,
  label,
  type,
  required = false,
  placeholder,
  helpText,
  options = [],
}: {
  entity: WorkspaceCustomFieldConfig["entity"];
  key: string;
  label: string;
  type: WorkspaceCustomFieldConfig["type"];
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
}): WorkspaceCustomFieldConfig => ({
  id: `custom-${entity}-${key}`,
  entity,
  key,
  label,
  type,
  required,
  active: true,
  placeholder,
  helpText,
  options: options.length
    ? options.map((value, index) => ({
        id: `${entity}-${key}-${index + 1}`,
        label: value,
        value: value.toLowerCase().replace(/\s+/g, "-"),
        active: true,
        order: index + 1,
      }))
    : undefined,
});

const defaultRedirectUri = typeof window !== "undefined" ? window.location.origin : "";

const defaultSettings: WorkspaceSettings = {
  profile: {
    firstName: "Admin",
    lastName: "User",
    email: "admin@company.com",
    avatarUrl: "",
  },
  namespace: {
    organization: "Synergi Task",
    slug: "synergi-main",
    portfolioOffice: "Enterprise PMO",
    timezone: "Asia/Riyadh",
  },
  currentUser: {
    displayName: "Admin User",
    roleId: "admin",
    teamMemberId: "",
    authUserId: "",
    userAccountId: "user-admin",
  },
  notifications: {
    email: true,
    push: true,
    reminders: true,
    digest: true,
    inApp: true,
  },
  appearance: {
    darkMode: false,
    compactView: false,
    language: "en",
    sidebarCollapsed: false,
    sidebarAutoHide: true,
  },
  security: {
    twoFactor: false,
    passwordLastChangedAt: "",
  },
  ai: {
    autoRiskScan: true,
    scheduleAdvisor: true,
    reportNarratives: true,
  },
  msProject: {
    defaultCalendar: "Standard",
    autoSyncProjectDates: true,
    includeDependenciesInExport: true,
  },
  integrations: {
    outlook: {
      providerLabel: "Outlook Calendar",
      enabled: true,
      connected: false,
      syncMode: "two-way",
      status: "Ready for Microsoft Graph OAuth connection",
      scopes: ["Calendars.ReadWrite", "offline_access"],
      configuration: {
        clientId: "",
        tenantId: "",
        redirectUri: defaultRedirectUri,
        resourceUrl: "https://graph.microsoft.com",
      },
    },
    teams: {
      providerLabel: "Microsoft Teams",
      enabled: true,
      connected: false,
      syncMode: "read",
      status: "Ready for meetings and channel deep links",
      scopes: ["OnlineMeetings.ReadWrite", "Chat.Read"],
      configuration: {
        clientId: "",
        tenantId: "",
        redirectUri: defaultRedirectUri,
        resourceUrl: "https://graph.microsoft.com",
      },
    },
    onedrive: {
      providerLabel: "OneDrive",
      enabled: true,
      connected: false,
      syncMode: "two-way",
      status: "Ready for project drive sync",
      scopes: ["Files.ReadWrite", "Sites.Read.All"],
      configuration: {
        clientId: "",
        tenantId: "",
        redirectUri: defaultRedirectUri,
        resourceUrl: "https://graph.microsoft.com",
      },
    },
    whatsapp: {
      providerLabel: "WhatsApp",
      enabled: true,
      connected: false,
      syncMode: "write",
      status: "External group links supported",
      scopes: ["external-link"],
      configuration: {
        clientId: "",
        tenantId: "",
        redirectUri: defaultRedirectUri,
        resourceUrl: "https://business.facebook.com",
      },
    },
    googleCalendar: {
      providerLabel: "Google Calendar",
      enabled: false,
      connected: false,
      syncMode: "read",
      status: "Planned extensibility",
      scopes: ["calendar.read"],
      configuration: {
        clientId: "",
        tenantId: "",
        redirectUri: defaultRedirectUri,
        resourceUrl: "https://www.googleapis.com",
      },
    },
  },
  metadata: [
    createFieldConfig("project-status", "Project Status", ["Active", "On hold", "Completed", "At risk"]),
    createFieldConfig("task-status", "Task Status", ["Backlog", "To Do", "In Progress", "Review", "Done"]),
    createFieldConfig("priority", "Priority", ["Urgent", "High", "Medium", "Low"]),
    createFieldConfig("risk-level", "Risk Level", ["High", "Medium", "Low"]),
    createFieldConfig("department", "Department", ["Project Delivery", "PMO", "Operations", "Technology"]),
    createFieldConfig("resource-type", "Resource Type", ["Project Manager", "Contributor", "Reviewer", "Observer", "External"]),
    createFieldConfig("meeting-type", "Meeting Type", ["Stand-up", "Planning", "Steering Committee", "Workshop", "Retrospective"]),
    createFieldConfig("document-type", "Document Type", ["Project Charter", "BRD", "Schedule Plan", "Scope Statement", "Minutes"]),
    createFieldConfig("project-tag", "Project Tags", ["Delivery", "Portfolio", "Data", "Transformation", "AI"]),
  ],
  customFields: [
    createCustomFieldConfig({
      entity: "project",
      key: "project-sponsor",
      label: "Project Sponsor",
      type: "text",
      placeholder: "Executive sponsor name",
      helpText: "Visible on the project form and available for reports.",
    }),
    createCustomFieldConfig({
      entity: "task",
      key: "task-workstream",
      label: "Workstream",
      type: "select",
      options: ["PMO", "Delivery", "Finance", "Operations", "Technology"],
    }),
    createCustomFieldConfig({
      entity: "teamMember",
      key: "member-location",
      label: "Location",
      type: "text",
      placeholder: "City or office",
    }),
    createCustomFieldConfig({
      entity: "ticket",
      key: "ticket-source",
      label: "Source",
      type: "select",
      options: ["Portal", "Email", "Phone", "WhatsApp", "Teams"],
    }),
  ],
  branding: {
    appName: "Synergi PM",
    homeLabel: "Portfolio Home",
  },
  privilegeRoles: defaultRoles,
};

const defaultTickets: WorkspaceTicket[] = [
  {
    id: "TK-001",
    title: "Login page not loading on mobile",
    description: "Users report blank screen on iOS Safari.",
    status: "open",
    priority: "high",
    assignee: "Bob Smith",
    projectId: "1",
    createdAt: "2026-04-05",
    sla: "4h remaining",
    comments: [],
    customFieldValues: {},
  },
  {
    id: "TK-002",
    title: "Dashboard charts rendering slowly",
    description: "Performance drops when the portfolio view loads larger datasets.",
    status: "in-progress",
    priority: "medium",
    assignee: "Hank Brown",
    projectId: "3",
    createdAt: "2026-04-04",
    sla: "12h remaining",
    comments: [],
    customFieldValues: {},
  },
  {
    id: "TK-003",
    title: "Export CSV feature broken",
    description: "Some exported files are generated with empty rows only.",
    status: "open",
    priority: "high",
    assignee: "Carol Davis",
    projectId: "2",
    createdAt: "2026-04-06",
    sla: "2h remaining",
    comments: [],
    customFieldValues: {},
  },
];

const defaultWorkflows: WorkspaceWorkflow[] = [
  {
    id: "wf-task-delivery",
    name: "Task Delivery Workflow",
    entity: "task",
    description: "Standard delivery path from planning to completion.",
    stages: [
      { id: "backlog", name: "Backlog", slaHours: 24, color: "bg-slate-500" },
      { id: "todo", name: "Ready", slaHours: 24, color: "bg-sky-500" },
      { id: "in-progress", name: "Execution", slaHours: 72, color: "bg-indigo-500" },
      { id: "review", name: "Review", slaHours: 24, color: "bg-amber-500" },
      { id: "done", name: "Done", slaHours: 0, color: "bg-emerald-500" },
    ],
    automationRules: [
      "Flag tasks that stay in Execution for more than 72 hours.",
      "Alert PM when a review-stage task is overdue.",
    ],
  },
  {
    id: "wf-ticket-response",
    name: "Support Escalation Workflow",
    entity: "ticket",
    description: "Tracks inbound support issues through resolution.",
    stages: [
      { id: "open", name: "Open", slaHours: 4, color: "bg-rose-500" },
      { id: "in-progress", name: "Assigned", slaHours: 8, color: "bg-orange-500" },
      { id: "resolved", name: "Resolved", slaHours: 0, color: "bg-emerald-500" },
      { id: "closed", name: "Closed", slaHours: 0, color: "bg-slate-500" },
    ],
    automationRules: [
      "Escalate tickets with less than 2 hours SLA remaining.",
    ],
  },
];

const defaultDashboards: WorkspaceDashboard[] = [
  {
    id: "dashboard-exec",
    name: "Executive Portfolio",
    isDefault: true,
    widgets: [
      { id: "widget-1", key: "portfolioHealth", title: "Portfolio Health", type: "metric", enabled: true, size: "md" },
      { id: "widget-2", key: "resourceUtilization", title: "Resource Utilization", type: "chart", enabled: true, size: "lg" },
      { id: "widget-3", key: "workflowSla", title: "Workflow SLA", type: "workflow", enabled: true, size: "md" },
      { id: "widget-4", key: "riskRadar", title: "Risk Radar", type: "list", enabled: true, size: "md" },
    ],
  },
];

const defaultReportTemplates: WorkspaceReportTemplate[] = [
  {
    id: "report-exec",
    name: "Executive Summary",
    focus: "executive",
    description: "High-level portfolio performance, risks, and delivery confidence.",
    columns: ["project", "status", "progress", "budget", "risk"],
  },
  {
    id: "report-resource",
    name: "Resource Utilization",
    focus: "resource",
    description: "Team capacity, assigned workload, and utilization variance.",
    columns: ["member", "capacity", "assignedHours", "utilization", "target"],
  },
  {
    id: "report-risk",
    name: "Risk Register Snapshot",
    focus: "risk",
    description: "Open issues, risk ratings, and overdue work by project.",
    columns: ["project", "risk", "overdueTasks", "openTickets"],
  },
  {
    id: "report-schedule",
    name: "Schedule Control",
    focus: "schedule",
    description: "Milestones, dependencies, total duration, and critical path activity.",
    columns: ["project", "start", "end", "duration", "dependencies"],
  },
];

const createDefaultTeamMembers = (): WorkspaceTeamMember[] =>
  seedTeamMembers.map((member, index) => ({
    ...member,
    phone: "",
    department: "Project Delivery",
    avatarColor: ["gradient-primary", "bg-blue-600", "bg-emerald-600", "bg-orange-500"][index % 4],
    assignedProjectIds: [],
    capacityHours: 40,
    utilizationTarget: 85,
    privilegeRole: index < 2 ? "pm" : "lead",
  }));

const createDefaultUserAccounts = (teamMembers: WorkspaceTeamMember[]): WorkspaceUserAccount[] => [
  {
    id: "user-admin",
    fullName: "Admin User",
    email: "admin@company.com",
    roleId: "admin",
    status: "active",
    authProvider: "hybrid",
    createdAt: "2026-04-01",
    invitationSentAt: "2026-04-01T07:45:00.000Z",
    lastAccessAt: "2026-04-17T08:00:00.000Z",
    lastNotificationAt: "2026-04-17T08:15:00.000Z",
    notificationCount: 3,
    invitedBy: "System",
    notes: "Default workspace administrator for user access and permission control.",
  },
  ...teamMembers.map((member, index) => ({
    id: `user-${member.id}`,
    fullName: member.name,
    email: member.email,
    roleId: member.privilegeRole ?? (index < 2 ? "pm" : "lead"),
    status: index < 4 ? "active" : "invited",
    authProvider: index % 2 === 0 ? "email" : "google",
    teamMemberId: member.id,
    title: member.role,
    department: member.department,
    createdAt: `2026-04-${String(Math.min(9 + index, 28)).padStart(2, "0")}`,
    invitationSentAt: `2026-04-${String(Math.min(9 + index, 28)).padStart(2, "0")}T08:00:00.000Z`,
    lastAccessAt: index < 3 ? `2026-04-1${index}T09:00:00.000Z` : undefined,
    lastNotificationAt: index < 3 ? `2026-04-1${index}T10:30:00.000Z` : undefined,
    notificationCount: index < 3 ? index + 1 : 0,
    invitedBy: "Admin User",
    notes: `Managed access profile for ${member.name}.`,
  })),
];

const createDefaultProjectTemplates = (): WorkspaceProjectTemplate[] => [
  {
    id: "template-enterprise",
    name: "Enterprise Delivery",
    category: "PMO",
    description: "Standard enterprise project delivery template with governance, risks, and reporting controls.",
    defaultTaskPhases: ["Discovery", "Planning", "Execution", "Testing", "Deployment"],
    defaultRiskCategories: ["Schedule", "Resource", "Scope", "Vendor", "Security"],
    defaultTags: ["delivery", "portfolio", "governance"],
    charterPrompt: "Create a charter, scope, schedule plan, risk register, and communication plan for an enterprise delivery project.",
  },
  {
    id: "template-product",
    name: "Digital Product Launch",
    category: "Product",
    description: "Cross-functional software release template with collaboration and release-readiness checkpoints.",
    defaultTaskPhases: ["Concept", "Backlog", "Sprint Delivery", "UAT", "Launch"],
    defaultRiskCategories: ["Adoption", "Delivery", "Quality", "Dependency"],
    defaultTags: ["product", "launch", "ai"],
    charterPrompt: "Create a product launch package with milestones, stakeholder map, sprint plan, and rollout risks.",
  },
];

const createDefaultMeetings = (projects: WorkspaceProject[], teamMembers: WorkspaceTeamMember[]): WorkspaceMeeting[] => [
  {
    id: "meeting-1",
    title: "Website Redesign Weekly Steering",
    type: "Steering Committee",
    projectId: projects[0]?.id,
    channelId: "chat-project-1",
    organizerId: teamMembers[0]?.id,
    attendeeIds: teamMembers.slice(0, 4).map((member) => member.id),
    startsAt: "2026-04-18T08:30:00.000Z",
    endsAt: "2026-04-18T09:15:00.000Z",
    provider: "teams",
    joinUrl: "https://teams.microsoft.com/l/meetup-join/website-redesign",
    notes: "Review status, risks, and approvals for the next milestone.",
    status: "scheduled",
  },
  {
    id: "meeting-2",
    title: "Mobile App v2 Sprint Planning",
    type: "Planning",
    projectId: projects[1]?.id,
    channelId: "chat-project-2",
    organizerId: teamMembers[3]?.id,
    attendeeIds: teamMembers.slice(3, 7).map((member) => member.id),
    startsAt: "2026-04-19T10:00:00.000Z",
    endsAt: "2026-04-19T11:00:00.000Z",
    provider: "outlook",
    joinUrl: "https://outlook.office.com/calendar/item/mobile-app-sprint-planning",
    notes: "Confirm sprint scope and resource commitments.",
    status: "scheduled",
  },
];

const createDefaultPersonalEvents = (teamMembers: WorkspaceTeamMember[]): WorkspacePersonalEvent[] => [
  {
    id: "event-1",
    memberId: teamMembers[0]?.id ?? "",
    title: "Focus Block",
    type: "focus",
    startsAt: "2026-04-18T11:00:00.000Z",
    endsAt: "2026-04-18T13:00:00.000Z",
    notes: "Reserved for design sign-off work.",
  },
  {
    id: "event-2",
    memberId: teamMembers[1]?.id ?? "",
    title: "Personal Leave",
    type: "pto",
    startsAt: "2026-04-20T08:00:00.000Z",
    endsAt: "2026-04-20T17:00:00.000Z",
    notes: "Unavailable for project work.",
  },
];

const createDefaultAuditLogs = (): WorkspaceAuditLog[] => [
  {
    id: "audit-1",
    action: "settings.updated",
    entityType: "settings",
    entityId: "workspace",
    actorName: "Admin User",
    detail: "Enabled AI schedule advisor and configured enterprise workspace defaults.",
    createdAt: "2026-04-16T08:00:00.000Z",
  },
  {
    id: "audit-2",
    action: "project.generatedDocuments",
    entityType: "project",
    entityId: "1",
    actorName: "Admin User",
    detail: "Generated PMI-aligned document package for Website Redesign.",
    createdAt: "2026-04-16T10:30:00.000Z",
  },
];

const createDefaultStickyNotes = (
  userAccounts: WorkspaceUserAccount[],
  teamMembers: WorkspaceTeamMember[],
): WorkspaceStickyNote[] => [
  {
    id: "note-1",
    ownerUserAccountId: userAccounts[0]?.id,
    ownerTeamMemberId: teamMembers[0]?.id,
    ownerName: userAccounts[0]?.fullName ?? "Admin User",
    title: "Steering follow-up",
    content: "Review generated charter, confirm key milestones, and prepare sponsor sign-off.",
    color: "amber",
    done: false,
    createdAt: "2026-04-17T07:30:00.000Z",
  },
  {
    id: "note-2",
    ownerUserAccountId: userAccounts[1]?.id,
    ownerTeamMemberId: teamMembers[1]?.id,
    ownerName: userAccounts[1]?.fullName ?? "Project Manager",
    title: "Cutover prep",
    content: "Validate dependencies in the schedule and send the deployment plan to the approvals channel.",
    color: "sky",
    done: false,
    createdAt: "2026-04-17T08:00:00.000Z",
  },
];

const createFullCycleScenario = (
  teamMembers: WorkspaceTeamMember[],
  userAccounts: WorkspaceUserAccount[],
) => {
  const projectId = "sample-full-cycle-program";
  const projectName = "Sample Full Cycle Program";
  const selectedMembers = teamMembers.slice(0, 4);
  const sampleProject: WorkspaceProject = {
    id: projectId,
    name: projectName,
    description: "A full-cycle sample project that links charter, plan, execution, approvals, issues, and reporting in one workspace record.",
    status: "active",
    progress: 58,
    team: selectedMembers.map((member) => member.name),
    startDate: "2026-04-15",
    endDate: "2026-07-30",
    tasksTotal: 4,
    tasksCompleted: 1,
    priority: "high",
    start_date: "2026-04-15",
    end_date: "2026-07-30",
    budget: "450000",
    department: "PMO",
    projectNature: "End-to-end PMO demonstration program spanning initiation, planning, execution, governance, and go-live readiness.",
    tags: ["sample", "full-cycle", "pmo", "delivery"],
    files: [{ name: "sample-full-cycle-overview.docx", size: "Generated", uploadedAt: "2026-04-15T08:00:00.000Z" }],
    milestones: [
      { title: "Charter Approved", date: "2026-04-18" },
      { title: "Baseline Approved", date: "2026-04-25" },
      { title: "Pilot Go-Live", date: "2026-06-15" },
      { title: "Project Closeout", date: "2026-07-30" },
    ],
    resources: selectedMembers.map((member, index) => ({
      id: `${projectId}-resource-${member.id}`,
      name: member.name,
      role: index === 0 ? "Project Manager" : member.role,
      allocation: index === 0 ? 60 : 35,
      plannedHours: index === 0 ? 120 : 80,
      memberId: member.id,
    })),
    teamStructure: [
      {
        id: `${projectId}-team-sponsor`,
        name: "Admin User",
        title: "Project Sponsor",
        reportsTo: "",
        responsibilities: "Owns strategic direction and approvals.",
      },
      ...selectedMembers.map((member, index) => ({
        id: `${projectId}-team-${member.id}`,
        name: member.name,
        title: index === 0 ? "Project Manager" : member.role,
        memberId: member.id,
        reportsTo: index === 0 ? "Admin User" : selectedMembers[0]?.name,
        responsibilities: index === 0 ? "Lead planning and execution." : "Deliver assigned workstream outcomes.",
      })),
    ],
    stakeholders: [
      {
        id: `${projectId}-stakeholder-steerco`,
        name: "Executive Steering Committee",
        role: "Governance Board",
        influence: "high",
        interest: "high",
        engagement: "manage closely",
        notes: "Provides major stage approvals and escalation decisions.",
      },
      {
        id: `${projectId}-stakeholder-ops`,
        name: "Operations Leadership",
        role: "Business Owner",
        influence: "medium",
        interest: "high",
        engagement: "keep satisfied",
        notes: "Reviews business readiness and adoption impact.",
      },
    ],
    risks: [
      {
        id: `${projectId}-risk-dependency`,
        title: "Approval gate delay",
        description: "Sign-off documents may be delayed if review comments accumulate.",
        category: "Governance",
        probability: "medium",
        impact: "high",
        owner: "Project Manager",
        mitigation: "Track sign-off actions daily and use approvals channel for escalations.",
        status: "monitoring",
      },
      {
        id: `${projectId}-risk-capacity`,
        title: "Shared team capacity pressure",
        description: "Key resources are supporting other portfolio initiatives in parallel.",
        category: "Resource",
        probability: "medium",
        impact: "medium",
        owner: "PMO",
        mitigation: "Review resource load weekly and rebalance assignments.",
        status: "open",
      },
    ],
    documents: [
      {
        id: `${projectId}-charter`,
        name: `${projectName} Project Charter`,
        type: "project-charter",
        category: "template",
        content: "Project charter with objectives, assumptions, approvals, and scope summary.",
        uploadedAt: "2026-04-15T08:00:00.000Z",
        generated: true,
        phase: "Initiation",
        deliverableType: "Project Charter",
        documentNature: "narrative",
        outputFormat: "doc",
        standardTemplate: "PMI",
        reviewStatus: "approved",
        linkedChannelId: "chat-sample-full-cycle",
        linkedChannelName: "Sample Full Cycle Community",
        folder: "Initiation",
        access: "project",
        createdBy: "Admin User",
        lastModifiedAt: "2026-04-16T09:00:00.000Z",
        lastModifiedBy: "Admin User",
        provider: "workspace",
        metadata: { extension: "docx", size: "Generated" },
        versions: [],
      },
      {
        id: `${projectId}-schedule-plan`,
        name: `${projectName} Schedule Plan`,
        type: "schedule-plan",
        category: "template",
        content: "Baseline schedule, dependencies, milestones, and critical path notes.",
        uploadedAt: "2026-04-16T09:30:00.000Z",
        generated: true,
        phase: "Planning",
        deliverableType: "Schedule Plan",
        documentNature: "worksheet",
        outputFormat: "xlsx",
        standardTemplate: "PMI",
        reviewStatus: "in-review",
        linkedChannelId: "chat-sample-full-cycle",
        linkedChannelName: "Sample Full Cycle Community",
        folder: "Planning",
        access: "project",
        createdBy: "Admin User",
        lastModifiedAt: "2026-04-17T10:00:00.000Z",
        lastModifiedBy: selectedMembers[0]?.name ?? "Admin User",
        provider: "workspace",
        metadata: { extension: "xlsx", size: "Generated" },
        versions: [],
      },
      {
        id: `${projectId}-signoff`,
        name: `${projectName} Sign-Off Sheet`,
        type: "sign-off-sheet",
        category: "template",
        content: "Formal acceptance and closeout sign-off sheet.",
        uploadedAt: "2026-04-18T11:00:00.000Z",
        generated: true,
        phase: "Closing",
        deliverableType: "Sign-off Sheet",
        documentNature: "signoff",
        outputFormat: "pdf",
        standardTemplate: "PMI",
        reviewStatus: "draft",
        linkedChannelId: "chat-sample-full-cycle-approvals",
        linkedChannelName: "Sample Full Cycle Approvals",
        folder: "Closing",
        access: "project",
        createdBy: "Admin User",
        provider: "workspace",
        metadata: { extension: "pdf", size: "Generated" },
        versions: [],
      },
    ],
    risk_level: "medium",
    namespace: "synergi-main",
    workflowId: "wf-task-delivery",
    customFieldValues: {
      "project-sponsor": "Admin User",
    },
  };

  const sampleTasks: WorkspaceTask[] = [
    {
      id: `${projectId}-task-charter`,
      title: "Approve project charter",
      description: "Complete charter review and secure sponsor approval.",
      status: "done",
      priority: "high",
      assignee: selectedMembers[0]?.name ?? "Unassigned",
      projectId,
      project_id: projectId,
      projectName,
      dueDate: "2026-04-18",
      due_date: "2026-04-18",
      tags: ["initiation", "governance"],
      phase: "Discovery",
      progress: 100,
      isMilestone: true,
      start_date: "2026-04-15",
      end_date: "2026-04-18",
      predecessors: [],
      assignees: selectedMembers[0] ? [selectedMembers[0].id] : [],
      comments: [],
      files: [],
      duration: "4d",
      workloadHours: 16,
      workflowStage: "done",
      timesheetEntries: [
        {
          id: `${projectId}-timesheet-1`,
          date: "2026-04-17",
          member: selectedMembers[0]?.name ?? "Admin User",
          hours: 4,
          activity: "Reviewed charter feedback and finalized approval package.",
          notes: "Sponsor accepted the charter without major changes.",
        },
      ],
      customFieldValues: {
        "task-workstream": "PMO",
      },
    },
    {
      id: `${projectId}-task-baseline`,
      title: "Baseline the delivery schedule",
      description: "Build the integrated schedule, dependencies, and approval baseline.",
      status: "in-progress",
      priority: "high",
      assignee: selectedMembers[1]?.name ?? "Unassigned",
      projectId,
      project_id: projectId,
      projectName,
      dueDate: "2026-04-25",
      due_date: "2026-04-25",
      tags: ["planning", "schedule"],
      phase: "Planning",
      progress: 55,
      isMilestone: false,
      start_date: "2026-04-18",
      end_date: "2026-04-25",
      predecessors: [`${projectId}-task-charter`],
      assignees: selectedMembers[1] ? [selectedMembers[1].id] : [],
      comments: [],
      files: [],
      duration: "6d",
      workloadHours: 32,
      workflowStage: "in-progress",
      timesheetEntries: [
        {
          id: `${projectId}-timesheet-2`,
          date: "2026-04-20",
          member: selectedMembers[1]?.name ?? "Unassigned",
          hours: 6,
          activity: "Updated dependency logic and baseline dates.",
          notes: "Waiting on one integration review item.",
        },
      ],
      customFieldValues: {
        "task-workstream": "Delivery",
      },
    },
    {
      id: `${projectId}-task-uat`,
      title: "Prepare pilot UAT plan",
      description: "Finalize pilot readiness checklist, users, and support playbook.",
      status: "todo",
      priority: "medium",
      assignee: selectedMembers[2]?.name ?? "Unassigned",
      projectId,
      project_id: projectId,
      projectName,
      dueDate: "2026-05-10",
      due_date: "2026-05-10",
      tags: ["execution", "uat"],
      phase: "Execution",
      progress: 0,
      isMilestone: false,
      start_date: "2026-04-28",
      end_date: "2026-05-10",
      predecessors: [`${projectId}-task-baseline`],
      assignees: selectedMembers[2] ? [selectedMembers[2].id] : [],
      comments: [],
      files: [],
      duration: "8d",
      workloadHours: 40,
      workflowStage: "todo",
      timesheetEntries: [],
      customFieldValues: {
        "task-workstream": "Operations",
      },
    },
    {
      id: `${projectId}-task-closeout`,
      title: "Collect closeout approvals",
      description: "Prepare sign-off sheet and collect final acceptance approvals.",
      status: "backlog",
      priority: "medium",
      assignee: selectedMembers[0]?.name ?? "Unassigned",
      projectId,
      project_id: projectId,
      projectName,
      dueDate: "2026-07-30",
      due_date: "2026-07-30",
      tags: ["closing", "approvals"],
      phase: "Deployment",
      progress: 0,
      isMilestone: false,
      start_date: "2026-07-20",
      end_date: "2026-07-30",
      predecessors: [`${projectId}-task-uat`],
      assignees: selectedMembers[0] ? [selectedMembers[0].id] : [],
      comments: [],
      files: [],
      duration: "5d",
      workloadHours: 20,
      workflowStage: "backlog",
      timesheetEntries: [],
      customFieldValues: {
        "task-workstream": "PMO",
      },
    },
  ];

  const sampleTicket: WorkspaceTicket = {
    id: "TK-SAMPLE-001",
    title: "Schedule export validation issue",
    description: "The pilot project needs one more validation step before exporting the updated XML baseline.",
    status: "open",
    priority: "high",
    assignee: selectedMembers[1]?.name ?? "Unassigned",
    projectId,
    taskId: `${projectId}-task-baseline`,
    createdAt: "2026-04-20",
    sla: "8h remaining",
    comments: [
      {
        id: "TK-SAMPLE-001-comment-1",
        author: "Admin User",
        message: "Track this in the sample full-cycle scenario so the issue flow remains visible.",
        createdAt: "2026-04-20T10:00:00.000Z",
      },
    ],
    customFieldValues: {
      "ticket-source": "Portal",
    },
  };

  const sampleMeeting: WorkspaceMeeting = {
    id: "meeting-sample-full-cycle",
    title: `${projectName} Weekly Governance`,
    type: "Steering Committee",
    projectId,
    taskId: `${projectId}-task-baseline`,
    channelId: "chat-sample-full-cycle",
    organizerId: selectedMembers[0]?.id,
    attendeeIds: selectedMembers.map((member) => member.id),
    startsAt: "2026-04-22T09:00:00.000Z",
    endsAt: "2026-04-22T10:00:00.000Z",
    provider: "teams",
    joinUrl: "https://teams.microsoft.com/l/meetup-join/sample-full-cycle",
    notes: "Review schedule baseline, issue log, and sign-off actions.",
    status: "scheduled",
  };

  const sampleChannels: WorkspaceChatChannel[] = [
    {
      id: "chat-sample-full-cycle",
      name: "Sample Full Cycle Community",
      topic: "Daily delivery coordination, schedule updates, and shared decisions.",
      memberIds: selectedMembers.map((member) => member.id),
      projectId,
      kind: "general",
      whatsappGroupUrl: "https://chat.whatsapp.com/sample-full-cycle",
      quickLinks: [
        { id: "sample-docs", label: "Project Documents", type: "document", url: `/documents?projectId=${projectId}` },
        { id: "sample-schedule", label: "Schedule", type: "file", url: `/schedule?projectId=${projectId}` },
        { id: "sample-meeting", label: "Governance Meeting", type: "meeting", url: "https://teams.microsoft.com/l/meetup-join/sample-full-cycle" },
      ],
      messages: [
        {
          id: "chat-sample-full-cycle-msg-1",
          authorName: "Admin User",
          message: "This sample project links planning, execution, issue management, reporting, and approvals end to end.",
          createdAt: "2026-04-20T08:00:00.000Z",
          pinned: true,
        },
      ],
    },
    {
      id: "chat-sample-full-cycle-approvals",
      name: "Sample Full Cycle Approvals",
      topic: "Formal sign-off, decision tracking, and closeout approvals.",
      memberIds: selectedMembers.map((member) => member.id),
      projectId,
      kind: "announcements",
      readOnly: true,
      messages: [
        {
          id: "chat-sample-full-cycle-approvals-msg-1",
          authorName: "Admin User",
          message: "Use this channel for approval notices and final sign-off communications.",
          createdAt: "2026-04-20T08:30:00.000Z",
          pinned: true,
        },
      ],
      quickLinks: [
        { id: "sample-signoff", label: "Sign-Off Sheet", type: "document", url: `/documents?projectId=${projectId}` },
      ],
    },
  ];

  const sampleStickyNote: WorkspaceStickyNote = {
    id: "note-sample-full-cycle",
    ownerUserAccountId: userAccounts[0]?.id,
    ownerTeamMemberId: selectedMembers[0]?.id,
    ownerName: userAccounts[0]?.fullName ?? "Admin User",
    title: "Sample project walkthrough",
    content: "Use Sample Full Cycle Program to verify project, tasks, tickets, schedule, documents, chat, and reports together.",
    color: "emerald",
    done: false,
    createdAt: "2026-04-20T07:00:00.000Z",
  };

  const sampleEvent: WorkspacePersonalEvent = {
    id: "event-sample-full-cycle-focus",
    memberId: selectedMembers[0]?.id ?? "",
    title: "Sample Program Focus Window",
    type: "focus",
    startsAt: "2026-04-21T12:00:00.000Z",
    endsAt: "2026-04-21T14:00:00.000Z",
    notes: "Reserved to review the sample program schedule and issue log.",
  };

  const sampleAuditLog: WorkspaceAuditLog = {
    id: "audit-sample-full-cycle",
    action: "project.sampleScenarioLoaded",
    entityType: "project",
    entityId: projectId,
    actorName: "System",
    detail: "Loaded the full-cycle sample scenario with linked delivery, collaboration, and reporting records.",
    createdAt: "2026-04-20T07:30:00.000Z",
  };

  return {
    project: sampleProject,
    tasks: sampleTasks,
    ticket: sampleTicket,
    meeting: sampleMeeting,
    channels: sampleChannels,
    stickyNote: sampleStickyNote,
    personalEvent: sampleEvent,
    auditLog: sampleAuditLog,
  };
};

export const initialWorkspaceData = (): WorkspaceData => {
  const defaultTeamMembers = createDefaultTeamMembers();
  const defaultUserAccounts = createDefaultUserAccounts(defaultTeamMembers);
  const defaultProjectTemplates = createDefaultProjectTemplates();
  const defaultStickyNotes = createDefaultStickyNotes(defaultUserAccounts, defaultTeamMembers);
  const seededPortfolioProjects = [...seedProjects, ...createRequestedProjectCatalog()];
  const fullCycleScenario = createFullCycleScenario(defaultTeamMembers, defaultUserAccounts);

  return ({
  projects: [...seededPortfolioProjects.map((project) => ({
    ...project,
    start_date: project.startDate,
    end_date: project.endDate,
    budget: project.priority === "high" ? "250000" : "120000",
    department: "Project Delivery",
    projectNature: project.name.toLowerCase().includes("data") ? "Platform modernization and data transformation initiative" : "Digital delivery and business transformation initiative",
    tags: project.name.toLowerCase().includes("data") ? ["data", "platform"] : ["delivery", "portfolio"],
    files: [],
    milestones: [
      { title: "Kickoff", date: project.startDate },
      { title: "Target Finish", date: project.endDate },
    ],
    resources: seedTeamMembers.slice(0, 2).map((member, index) => ({
      id: `${project.id}-resource-${member.id}`,
      name: member.name,
      role: index === 0 ? "Project Manager" : member.role,
      allocation: index === 0 ? 60 : 40,
      plannedHours: index === 0 ? 80 : 56,
      memberId: member.id,
    })),
    teamStructure: seedTeamMembers.slice(0, 3).map((member, index) => ({
      id: `${project.id}-team-${member.id}`,
      name: member.name,
      title: index === 0 ? "Project Sponsor" : index === 1 ? "Project Manager" : member.role,
      memberId: member.id,
      reportsTo: index === 0 ? "" : seedTeamMembers[0]?.name,
      responsibilities: index === 0 ? "Approvals and executive sponsorship" : index === 1 ? "Delivery planning and coordination" : "Specialist execution support",
    })),
    stakeholders: [
      {
        id: `${project.id}-stakeholder-1`,
        name: "Executive Steering Committee",
        role: "Sponsor Group",
        influence: "high",
        interest: "high",
        engagement: "manage closely",
        notes: "Monthly steering review and major decision approvals.",
      },
      {
        id: `${project.id}-stakeholder-2`,
        name: "Business Operations",
        role: "Business Owner",
        influence: "medium",
        interest: "high",
        engagement: "keep informed",
        notes: "Owns acceptance and operating readiness.",
      },
    ],
    risks: [
      {
        id: `${project.id}-risk-1`,
        title: "Schedule dependency slippage",
        description: "Upstream approvals could delay critical delivery milestones.",
        category: "Schedule",
        probability: "medium",
        impact: "high",
        owner: "Project Manager",
        mitigation: "Review dependencies weekly and escalate blocked approvals.",
        status: "open",
      },
      {
        id: `${project.id}-risk-2`,
        title: "Resource contention",
        description: "Shared specialists may be over-allocated across concurrent initiatives.",
        category: "Resource",
        probability: "medium",
        impact: "medium",
        owner: "PMO",
        mitigation: "Rebalance workloads during weekly resource planning.",
        status: "monitoring",
      },
    ],
    customFieldValues: {},
    documents: [
      {
        id: `${project.id}-charter`,
        name: `${project.name} Project Charter`,
        type: "project-charter",
        category: "template",
        content: `Project charter for ${project.name}.`,
        uploadedAt: new Date().toISOString(),
        generated: true,
        folder: "PMI Templates",
        access: "project",
        createdBy: "Admin User",
        lastModifiedAt: new Date().toISOString(),
        lastModifiedBy: "Admin User",
        provider: "workspace",
        metadata: { size: "Generated", extension: "md" },
        versions: [
          {
            id: `${project.id}-charter-v1`,
            editedAt: new Date().toISOString(),
            editedBy: "Admin User",
            summary: "Initial AI-generated charter",
            content: `Project charter for ${project.name}.`,
          },
        ],
      },
    ],
    risk_level: project.status === "at-risk" ? "high" : project.priority,
    namespace: "synergi-main",
    workflowId: "wf-task-delivery",
  })), fullCycleScenario.project],
  tasks: [...seedTasks.map((task, index) => ({
    ...task,
    due_date: task.dueDate,
    project_id: task.projectId,
    phase: ["Discovery", "Planning", "Execution", "Testing", "Deployment"][index % 5],
    progress: task.status === "done" ? 100 : task.status === "review" ? 80 : task.status === "in-progress" ? 45 : 0,
    isMilestone: false,
    predecessors: index > 0 ? [String(index)] : [],
    assignees: [],
    comments: [],
    files: [],
    duration: `${(index % 4) + 2}d`,
    workloadHours: ((index % 4) + 2) * 8,
    workflowStage: task.status,
    customFieldValues: {},
    timesheetEntries: index < 3 ? [
      {
        id: `timesheet-${task.id}`,
        date: new Date().toISOString().slice(0, 10),
        member: task.assignee,
        hours: 4,
        activity: `Worked on ${task.title.toLowerCase()}`,
        notes: "Daily delivery update captured from the team.",
      },
    ] : [],
  })), ...fullCycleScenario.tasks],
  teamMembers: defaultTeamMembers.map((member) => ({
    ...member,
    customFieldValues: member.customFieldValues ?? {},
  })),
  userAccounts: defaultUserAccounts,
  stickyNotes: [...defaultStickyNotes, fullCycleScenario.stickyNote],
  meetings: [...createDefaultMeetings(seedProjects as WorkspaceProject[], defaultTeamMembers), fullCycleScenario.meeting],
  personalEvents: [...createDefaultPersonalEvents(defaultTeamMembers), fullCycleScenario.personalEvent],
  tickets: [...defaultTickets.map((ticket) => ({
    ...ticket,
    customFieldValues: ticket.customFieldValues ?? {},
  })), fullCycleScenario.ticket],
  chatChannels: [
    {
      id: "chat-pmo",
      name: "PMO Control Room",
      topic: "Portfolio blockers, approvals, and weekly planning",
      memberIds: seedTeamMembers.slice(0, 4).map((member) => member.id),
      messages: [
        {
          id: "msg-1",
          authorName: "Alice Chen",
          message: "Need final signoff on the redesign milestone before Friday.",
          createdAt: "2026-04-16T09:00:00.000Z",
          pinned: true,
        },
        {
          id: "msg-2",
          authorName: "Bob Smith",
          message: "API gateway deployment is done. I can pick up one more urgent ticket.",
          createdAt: "2026-04-16T10:30:00.000Z",
        },
      ],
      quickLinks: [
        { id: "ql-1", label: "Portfolio Dashboard", type: "link", url: "/" },
        { id: "ql-2", label: "Weekly Status Report", type: "document", url: "/reports" },
      ],
    },
    {
      id: "chat-schedule",
      name: "Schedule Coordination",
      topic: "Dependencies, critical path, and resource balancing",
      memberIds: seedTeamMembers.map((member) => member.id),
      messages: [
        {
          id: "msg-3",
          authorName: "Grace Kim",
          message: "Data pipeline migration now drives two downstream tasks. Please update predecessors.",
          createdAt: "2026-04-16T11:15:00.000Z",
        },
      ],
    },
    {
      id: "chat-project-1",
      name: "Website Redesign Community",
      topic: "Project community, announcements, documents, and meeting links",
      memberIds: defaultTeamMembers.slice(0, 4).map((member) => member.id),
      projectId: "1",
      whatsappGroupUrl: "https://chat.whatsapp.com/project-website-redesign",
      quickLinks: [
        { id: "ql-project-1-doc", label: "Project Charter", type: "document", url: "/documents?projectId=1" },
        { id: "ql-project-1-meeting", label: "Weekly Steering", type: "meeting", url: "https://teams.microsoft.com/l/meetup-join/website-redesign" },
      ],
      messages: [
        {
          id: "msg-project-1-1",
          authorName: "Admin User",
          message: "Welcome to the project community. Use this channel for discussions, documents, and meeting access.",
          createdAt: "2026-04-16T08:00:00.000Z",
          pinned: true,
        },
      ],
    },
    {
      id: "chat-project-2",
      name: "Mobile App v2 Community",
      topic: "Sprint updates, linked files, and team discussion",
      memberIds: defaultTeamMembers.slice(3, 7).map((member) => member.id),
      projectId: "2",
      readOnly: false,
      whatsappGroupUrl: "https://chat.whatsapp.com/project-mobile-app-v2",
      quickLinks: [
        { id: "ql-project-2-doc", label: "Sprint Docs", type: "document", url: "/documents?projectId=2" },
      ],
      messages: [],
    },
    ...fullCycleScenario.channels,
  ],
  workflows: defaultWorkflows,
  dashboards: defaultDashboards,
  reportTemplates: defaultReportTemplates,
  projectTemplates: defaultProjectTemplates,
  auditLogs: [...createDefaultAuditLogs(), fullCycleScenario.auditLog],
  settings: defaultSettings,
  });
};

const cloneWorkspaceValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const isRemoteWorkspaceConfigured = () =>
  typeof import.meta !== "undefined" &&
  Boolean(import.meta.env.VITE_SUPABASE_URL) &&
  Boolean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

const initialConnectedWorkspaceData = (): WorkspaceData => ({
  projects: [],
  tasks: [],
  teamMembers: [],
  userAccounts: [],
  stickyNotes: [],
  meetings: [],
  personalEvents: [],
  tickets: [],
  chatChannels: [],
  workflows: cloneWorkspaceValue(defaultWorkflows),
  dashboards: cloneWorkspaceValue(defaultDashboards),
  reportTemplates: cloneWorkspaceValue(defaultReportTemplates),
  projectTemplates: cloneWorkspaceValue(createDefaultProjectTemplates()),
  auditLogs: [],
  settings: cloneWorkspaceValue(defaultSettings),
});

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readWorkspaceStorageMeta = () => {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(STORAGE_META_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as { remoteSchemaVersion?: string } | null;
  } catch {
    return null;
  }
};

const writeWorkspaceStorageMeta = (connectedMode: boolean) => {
  if (!canUseStorage()) return;

  if (connectedMode) {
    window.localStorage.setItem(
      STORAGE_META_KEY,
      JSON.stringify({ remoteSchemaVersion: REMOTE_STORAGE_SCHEMA_VERSION }),
    );
    return;
  }

  window.localStorage.removeItem(STORAGE_META_KEY);
};

const getCollectionSeed = <T extends Record<string, unknown>>(records: T[], index: number): Partial<T> =>
  records.length ? records[index % records.length] : {};

export const readWorkspaceData = (): WorkspaceData => {
  const connectedMode = isRemoteWorkspaceConfigured();
  if (!canUseStorage()) {
    return connectedMode ? initialConnectedWorkspaceData() : initialWorkspaceData();
  }

  const baseline = connectedMode ? initialConnectedWorkspaceData() : initialWorkspaceData();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    writeWorkspaceData(baseline);
    return baseline;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WorkspaceData>;
    const storageMeta = readWorkspaceStorageMeta();
    const useStoredCollections =
      !connectedMode || storageMeta?.remoteSchemaVersion === REMOTE_STORAGE_SCHEMA_VERSION;
    const cachedParsed = useStoredCollections ? parsed : {};
    const sanitizedCollections = sanitizeWorkspaceCollections(cachedParsed, baseline);
    const repairedProjects = connectedMode
      ? sanitizedCollections.projects
      : withMissingSeedProjects(sanitizedCollections.projects, baseline.projects);
    const shouldSyncSeedProjects = !connectedMode && repairedProjects.length !== sanitizedCollections.projects.length;
    const sampleScenarioTasks = baseline.tasks.filter((task) => (task.project_id ?? task.projectId) === fullCycleScenarioProjectId);
    const repairedTasks = connectedMode
      ? (cachedParsed.tasks ?? baseline.tasks)
      : mergeMissingRecordsById(cachedParsed.tasks ?? baseline.tasks, sampleScenarioTasks);
    const sampleScenarioTickets = baseline.tickets.filter((ticket) => ticket.projectId === fullCycleScenarioProjectId);
    const repairedTickets = connectedMode
      ? (cachedParsed.tickets ?? baseline.tickets)
      : mergeMissingRecordsById(cachedParsed.tickets ?? baseline.tickets, sampleScenarioTickets);
    const sampleScenarioMeetings = baseline.meetings.filter((meeting) => meeting.projectId === fullCycleScenarioProjectId);
    const repairedMeetings = connectedMode
      ? (cachedParsed.meetings ?? baseline.meetings)
      : mergeMissingRecordsById(cachedParsed.meetings ?? baseline.meetings, sampleScenarioMeetings);
    const sampleScenarioChannels = baseline.chatChannels.filter((channel) => channel.projectId === fullCycleScenarioProjectId);
    const repairedChatChannels = connectedMode
      ? (cachedParsed.chatChannels ?? baseline.chatChannels)
      : mergeMissingRecordsById(cachedParsed.chatChannels ?? baseline.chatChannels, sampleScenarioChannels);
    const sampleScenarioStickyNotes = baseline.stickyNotes.filter((note) => note.id === "note-sample-full-cycle");
    const repairedStickyNotes = connectedMode
      ? (cachedParsed.stickyNotes ?? baseline.stickyNotes)
      : mergeMissingRecordsById(cachedParsed.stickyNotes ?? baseline.stickyNotes, sampleScenarioStickyNotes);
    const sampleScenarioEvents = baseline.personalEvents.filter((event) => event.id === "event-sample-full-cycle-focus");
    const repairedPersonalEvents = connectedMode
      ? (cachedParsed.personalEvents ?? baseline.personalEvents)
      : mergeMissingRecordsById(cachedParsed.personalEvents ?? baseline.personalEvents, sampleScenarioEvents);
    const sampleScenarioAuditLogs = baseline.auditLogs.filter((log) => log.entityId === fullCycleScenarioProjectId);
    const repairedAuditLogs = connectedMode
      ? (cachedParsed.auditLogs ?? baseline.auditLogs)
      : mergeMissingRecordsById(cachedParsed.auditLogs ?? baseline.auditLogs, sampleScenarioAuditLogs);
    const shouldSyncSampleScenario =
      !connectedMode &&
      (repairedTasks.length !== (cachedParsed.tasks ?? baseline.tasks).length ||
        repairedTickets.length !== (cachedParsed.tickets ?? baseline.tickets).length ||
        repairedMeetings.length !== (cachedParsed.meetings ?? baseline.meetings).length ||
        repairedChatChannels.length !== (cachedParsed.chatChannels ?? baseline.chatChannels).length ||
        repairedStickyNotes.length !== (cachedParsed.stickyNotes ?? baseline.stickyNotes).length ||
        repairedPersonalEvents.length !== (cachedParsed.personalEvents ?? baseline.personalEvents).length ||
        repairedAuditLogs.length !== (cachedParsed.auditLogs ?? baseline.auditLogs).length);
    const hydrated: WorkspaceData = {
      ...baseline,
      ...parsed,
      projects: repairedProjects.map((project, index) => ({
        ...getCollectionSeed(baseline.projects, index),
        ...project,
        projectNature: project.projectNature ?? "",
        tags: project.tags ?? [],
        files: project.files ?? [],
        milestones: project.milestones ?? [],
        resources: project.resources ?? [],
        teamStructure: project.teamStructure ?? [],
        stakeholders: project.stakeholders ?? [],
        risks: project.risks ?? [],
        customFieldValues: project.customFieldValues ?? {},
        radarLifecycle: project.radarLifecycle
          ? {
              source: project.radarLifecycle.source ?? "csv-radar",
              ownerName: project.radarLifecycle.ownerName ?? "",
              totalActivities: project.radarLifecycle.totalActivities ?? 0,
              completionPct: project.radarLifecycle.completionPct,
              importedAt: project.radarLifecycle.importedAt ?? "",
              sourceFileName: project.radarLifecycle.sourceFileName,
              stageCounts: {
                planning: project.radarLifecycle.stageCounts?.planning ?? 0,
                analysis: project.radarLifecycle.stageCounts?.analysis ?? 0,
                infra: project.radarLifecycle.stageCounts?.infra ?? 0,
                design: project.radarLifecycle.stageCounts?.design ?? 0,
                development: project.radarLifecycle.stageCounts?.development ?? 0,
                uat: project.radarLifecycle.stageCounts?.uat ?? 0,
                deployment: project.radarLifecycle.stageCounts?.deployment ?? 0,
                training: project.radarLifecycle.stageCounts?.training ?? 0,
                "go-live": project.radarLifecycle.stageCounts?.["go-live"] ?? 0,
                support: project.radarLifecycle.stageCounts?.support ?? 0,
              },
            }
          : undefined,
        documents: (project.documents ?? []).map((document, docIndex) => ({
          ...(baseline.projects.length
            ? baseline.projects[index % baseline.projects.length]?.documents?.[
                docIndex % Math.max(1, baseline.projects[index % baseline.projects.length]?.documents?.length ?? 1)
              ] ?? {}
            : {}),
          ...document,
          standardTemplate: document.standardTemplate ?? "PMI",
          reviewStatus: document.reviewStatus ?? "draft",
          outputFormat: document.outputFormat ?? "doc",
          documentNature: document.documentNature ?? "narrative",
          versions: document.versions ?? [],
        })),
      })),
      tasks: repairedTasks.map((task) => ({
        ...task,
        parentTaskId: task.parentTaskId ?? undefined,
        tags: task.tags ?? [],
        predecessors: task.predecessors ?? [],
        assignees: task.assignees ?? [],
        comments: task.comments ?? [],
        files: task.files ?? [],
        customFieldValues: task.customFieldValues ?? {},
        timesheetEntries: task.timesheetEntries ?? [],
      })),
      teamMembers: sanitizedCollections.teamMembers.map((member, index) => ({
        ...getCollectionSeed(baseline.teamMembers, index),
        ...member,
        assignedProjectIds: member.assignedProjectIds ?? [],
        customFieldValues: member.customFieldValues ?? {},
      })),
      userAccounts: (cachedParsed.userAccounts ?? baseline.userAccounts).map((account, index) => ({
        ...getCollectionSeed(baseline.userAccounts, index),
        ...account,
      })),
      stickyNotes: repairedStickyNotes.map((note, index) => ({
        ...getCollectionSeed(baseline.stickyNotes, index),
        ...note,
      })),
      meetings: repairedMeetings.map((meeting, index) => ({
        ...getCollectionSeed(baseline.meetings, index),
        ...meeting,
      })),
      personalEvents: repairedPersonalEvents.map((event, index) => ({
        ...getCollectionSeed(baseline.personalEvents, index),
        ...event,
      })),
      tickets: repairedTickets.map((ticket) => ({
        ...ticket,
        comments: ticket.comments ?? [],
        customFieldValues: ticket.customFieldValues ?? {},
      })),
      chatChannels: repairedChatChannels.map((channel) => ({
        ...channel,
        kind: channel.kind ?? "general",
        memberIds: channel.memberIds ?? [],
        messages: (channel.messages ?? []).map((message) => ({
          ...message,
          mentions: message.mentions ?? [],
          attachments: message.attachments ?? [],
        })),
        quickLinks: channel.quickLinks ?? [],
      })),
      workflows: cachedParsed.workflows ?? baseline.workflows,
      dashboards: cachedParsed.dashboards ?? baseline.dashboards,
      reportTemplates: cachedParsed.reportTemplates ?? baseline.reportTemplates,
      projectTemplates: cachedParsed.projectTemplates ?? baseline.projectTemplates,
      auditLogs: repairedAuditLogs,
      settings: parsed.settings
        ? {
            ...baseline.settings,
            ...parsed.settings,
            profile: { ...baseline.settings.profile, ...parsed.settings.profile },
            namespace: { ...baseline.settings.namespace, ...parsed.settings.namespace },
            currentUser: { ...baseline.settings.currentUser, ...parsed.settings.currentUser },
            notifications: { ...baseline.settings.notifications, ...parsed.settings.notifications },
            appearance: { ...baseline.settings.appearance, ...parsed.settings.appearance },
            security: { ...baseline.settings.security, ...parsed.settings.security },
            ai: { ...baseline.settings.ai, ...parsed.settings.ai },
            msProject: { ...baseline.settings.msProject, ...parsed.settings.msProject },
            integrations: {
              ...baseline.settings.integrations,
              ...parsed.settings.integrations,
              outlook: { ...baseline.settings.integrations.outlook, ...parsed.settings.integrations?.outlook, configuration: { ...baseline.settings.integrations.outlook.configuration, ...parsed.settings.integrations?.outlook?.configuration } },
              teams: { ...baseline.settings.integrations.teams, ...parsed.settings.integrations?.teams, configuration: { ...baseline.settings.integrations.teams.configuration, ...parsed.settings.integrations?.teams?.configuration } },
              onedrive: { ...baseline.settings.integrations.onedrive, ...parsed.settings.integrations?.onedrive, configuration: { ...baseline.settings.integrations.onedrive.configuration, ...parsed.settings.integrations?.onedrive?.configuration } },
              whatsapp: { ...baseline.settings.integrations.whatsapp, ...parsed.settings.integrations?.whatsapp, configuration: { ...baseline.settings.integrations.whatsapp.configuration, ...parsed.settings.integrations?.whatsapp?.configuration } },
              googleCalendar: { ...baseline.settings.integrations.googleCalendar, ...parsed.settings.integrations?.googleCalendar, configuration: { ...baseline.settings.integrations.googleCalendar.configuration, ...parsed.settings.integrations?.googleCalendar?.configuration } },
            },
            branding: { ...baseline.settings.branding, ...parsed.settings.branding },
            metadata: parsed.settings.metadata ?? baseline.settings.metadata,
            customFields: parsed.settings.customFields ?? baseline.settings.customFields,
            privilegeRoles: parsed.settings.privilegeRoles ?? baseline.settings.privilegeRoles,
          }
        : baseline.settings,
    };

    if (
      sanitizedCollections.shouldRepair ||
      shouldSyncSeedProjects ||
      shouldSyncSampleScenario ||
      (connectedMode && !useStoredCollections)
    ) {
      writeWorkspaceData(hydrated);
    }

    return hydrated;
  } catch {
    writeWorkspaceData(baseline);
    return baseline;
  }
};

export const writeWorkspaceData = (data: WorkspaceData) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  writeWorkspaceStorageMeta(isRemoteWorkspaceConfigured());
};

export const updateWorkspaceData = (updater: (current: WorkspaceData) => WorkspaceData) => {
  const next = updater(readWorkspaceData());
  writeWorkspaceData(next);
  return next;
};

export const makeId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
