import {
  getSupabaseConfigStatus,
  isSupabaseOperational,
  supabase,
} from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  readWorkspaceData,
  type WorkspaceChatChannel,
  type WorkspaceChatMessage,
  type WorkspaceDashboard,
  type WorkspaceDocumentVersion,
  type WorkspaceMeeting,
  type WorkspacePersonalEvent,
  type WorkspaceProject,
  type WorkspaceProjectDocument,
  type WorkspaceSettings,
  type WorkspaceStickyNote,
  type WorkspaceTask,
  type WorkspaceTeamMember,
  type WorkspaceTicket,
  type WorkspaceUserAccount,
} from "@/lib/workspace-store";
import {
  mergeWorkspaceUserAccounts,
  normalizeWorkspaceRoleId,
  toRemoteWorkspaceRoleId,
} from "@/lib/workspace-access";

type RemoteProfile = Tables<"profiles">;
type RemoteProject = Tables<"projects">;
type RemoteTask = Tables<"tasks">;
type RemoteTicket = Tables<"tickets">;
type RemoteChatChannel = Tables<"chat_channels">;
type RemoteChatMessage = Tables<"chat_messages">;
type RemoteDashboard = Tables<"dashboards">;
type RemoteProjectDocument = Tables<"project_documents">;
type RemoteWorkspace = Tables<"workspaces">;
type RemoteWorkspaceMembership = Tables<"workspace_memberships">;
type RemoteTeamMember = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  profile_id: string | null;
  name: string;
  email: string | null;
  role_title: string | null;
  department: string | null;
  privilege_role: string;
  capacity_hours: number;
  utilization_target: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
type RemoteMeeting = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  task_id: string | null;
  channel_id: string | null;
  title: string;
  provider: string;
  starts_at: string;
  ends_at: string;
  join_url: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
};
type RemotePersonalEvent = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  title: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  created_at: string;
};
type RemoteStickyNote = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  title: string | null;
  content: string;
  color: string;
  done: boolean;
  created_at: string;
  updated_at: string;
};

export type RemoteWorkspaceContext = {
  profile: RemoteProfile | null;
  workspace: RemoteWorkspace | null;
  membership: RemoteWorkspaceMembership | null;
};

export type SupabaseConnectionHealth = {
  activeProjectRef: string | null;
  configured: boolean;
  connected: boolean;
  authenticated: boolean;
  issues: string[];
  latencyMs: number | null;
  linkedProjectRef: string | null;
  operational: boolean;
  workspaceId: string | null;
  message: string;
};

const supabaseConfigured = isSupabaseOperational();

const normalizeText = (value?: string | null) =>
  value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";

const hashSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return hash >>> 0;
};

const toStableUuid = (seed: string) => {
  const part1 = hashSeed(`${seed}:1`).toString(16).padStart(8, "0");
  const part2 = hashSeed(`${seed}:2`).toString(16).padStart(8, "0").slice(0, 4);
  const rawPart3 = hashSeed(`${seed}:3`) & 0x0fff;
  const part3 = (rawPart3 | 0x4000).toString(16).padStart(4, "0");
  const rawPart4 = hashSeed(`${seed}:4`) & 0x3fff;
  const part4 = (rawPart4 | 0x8000).toString(16).padStart(4, "0");
  const part5 =
    `${hashSeed(`${seed}:5`).toString(16).padStart(8, "0")}${hashSeed(`${seed}:6`)
      .toString(16)
      .padStart(8, "0")}`.slice(0, 12);
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
};

const isUuid = (value?: string | null) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

const createFallbackProject = (id: string, name: string): WorkspaceProject => ({
  id,
  name,
  description: "",
  status: "active",
  progress: 0,
  team: [],
  startDate: "",
  endDate: "",
  tasksTotal: 0,
  tasksCompleted: 0,
  priority: "medium",
  start_date: "",
  end_date: "",
  budget: "",
  department: "",
  projectNature: "",
  tags: [],
  files: [],
  milestones: [],
  resources: [],
  teamStructure: [],
  stakeholders: [],
  risks: [],
  documents: [],
  risk_level: "medium",
  namespace: "",
  customFieldValues: {},
});

const createFallbackTask = (id: string, title: string): WorkspaceTask => ({
  id,
  title,
  description: "",
  status: "todo",
  priority: "medium",
  assignee: "",
  projectId: "",
  projectName: "Unassigned",
  dueDate: "",
  due_date: "",
  tags: [],
  phase: "Execution",
  progress: 0,
  predecessors: [],
  assignees: [],
  comments: [],
  files: [],
  duration: "3d",
  workloadHours: 24,
  customFieldValues: {},
  timesheetEntries: [],
});

const createFallbackTeamMember = (id: string, name: string): WorkspaceTeamMember => ({
  id,
  name,
  role: "",
  avatar: name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase(),
  email: "",
  tasksAssigned: 0,
  tasksCompleted: 0,
  status: "online",
  department: "",
  avatarColor: "gradient-primary",
  assignedProjectIds: [],
  capacityHours: 40,
  utilizationTarget: 85,
  privilegeRole: "team_member",
  customFieldValues: {},
});

const createFallbackMeeting = (id: string, title: string): WorkspaceMeeting => ({
  id,
  title,
  type: "Planning",
  attendeeIds: [],
  startsAt: new Date().toISOString(),
  endsAt: new Date().toISOString(),
  provider: "workspace",
  status: "scheduled",
});

const createFallbackPersonalEvent = (id: string, title: string): WorkspacePersonalEvent => ({
  id,
  memberId: "",
  title,
  type: "personal",
  startsAt: new Date().toISOString(),
  endsAt: new Date().toISOString(),
});

const createFallbackStickyNote = (id: string, title: string): WorkspaceStickyNote => ({
  id,
  ownerName: "Workspace User",
  title,
  content: "",
  color: "amber",
  done: false,
  createdAt: new Date().toISOString(),
});

const createFallbackDocument = (id: string, name: string): WorkspaceProjectDocument => ({
  id,
  name,
  type: "document",
  category: "attachment",
  content: "",
  uploadedAt: new Date().toISOString(),
  generated: false,
  outputFormat: "doc",
  standardTemplate: "Custom",
  reviewStatus: "draft",
  provider: "workspace",
  metadata: {},
  versions: [],
});

const parseBudget = (value?: string | null) => {
  const numeric = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : null;
};

const assertNoSupabaseError = (error: { message: string } | null, context: string) => {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
};

const toDisplayBudget = (value: number | null, fallback?: string) =>
  value === null || value === undefined ? fallback ?? "" : String(value);

const splitDisplayName = (displayName?: string | null) => {
  const trimmed = displayName?.trim() ?? "";
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
};

const buildAvatar = (name: string, existing?: string) =>
  existing ||
  name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

const getRemoteDocumentId = (projectId: string, document: WorkspaceProjectDocument) =>
  isUuid(document.id)
    ? document.id
    : toStableUuid(
        `${projectId}:${document.id}:${document.name}:${document.type}:${document.category}`,
      );

const getRemoteVersionId = (
  documentId: string,
  version: WorkspaceDocumentVersion,
  index: number,
) =>
  isUuid(version.id)
    ? version.id
    : toStableUuid(`${documentId}:${version.id}:${version.editedAt}:${index}`);

export const generatePersistentEntityId = (fallbackPrefix: string) =>
  globalThis.crypto?.randomUUID?.() ?? `${fallbackPrefix}-${Math.random().toString(36).slice(2, 10)}`;

export const isSupabaseReady = () => supabaseConfigured;

export const checkSupabaseConnection = async (): Promise<SupabaseConnectionHealth> => {
  const config = getSupabaseConfigStatus();

  if (!config.hasEnv) {
    return {
      activeProjectRef: config.activeProjectRef,
      configured: false,
      connected: false,
      authenticated: false,
      issues: config.issues,
      latencyMs: null,
      linkedProjectRef: config.linkedProjectRef,
      operational: false,
      workspaceId: null,
      message: config.issues[0] ?? "Supabase environment variables are missing.",
    };
  }

  if (!config.isOperational) {
    return {
      activeProjectRef: config.activeProjectRef,
      configured: true,
      connected: false,
      authenticated: false,
      issues: config.issues,
      latencyMs: null,
      linkedProjectRef: config.linkedProjectRef,
      operational: false,
      workspaceId: null,
      message: config.issues[0] ?? "Supabase configuration is not aligned with the linked project.",
    };
  }

  const startedAt = Date.now();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    return {
      activeProjectRef: config.activeProjectRef,
      configured: true,
      connected: false,
      authenticated: false,
      issues: config.issues,
      latencyMs: Date.now() - startedAt,
      linkedProjectRef: config.linkedProjectRef,
      operational: true,
      workspaceId: null,
      message: `Supabase session check failed: ${sessionError.message}`,
    };
  }

  const { error: probeError, status } = await supabase
    .from("workspaces")
    .select("id", { head: true, count: "exact" })
    .limit(1);

  const latencyMs = Date.now() - startedAt;
  const authenticated = Boolean(sessionData.session?.user?.id);
  if (!probeError) {
    const workspaceId = authenticated ? await getRemoteWorkspaceId() : null;
    return {
      activeProjectRef: config.activeProjectRef,
      configured: true,
      connected: true,
      authenticated,
      issues: config.issues,
      latencyMs,
      linkedProjectRef: config.linkedProjectRef,
      operational: true,
      workspaceId,
      message: authenticated
        ? "Connected to Supabase with an authenticated session."
        : "Connected to Supabase without an authenticated session.",
    };
  }

  if (status === 401 || status === 403) {
    return {
      activeProjectRef: config.activeProjectRef,
      configured: true,
      connected: true,
      authenticated: false,
      issues: config.issues,
      latencyMs,
      linkedProjectRef: config.linkedProjectRef,
      operational: true,
      workspaceId: null,
      message: "Supabase is reachable, but a signed-in user session is required.",
    };
  }

  return {
    activeProjectRef: config.activeProjectRef,
    configured: true,
    connected: false,
    authenticated,
    issues: config.issues,
    latencyMs,
    linkedProjectRef: config.linkedProjectRef,
    operational: true,
    workspaceId: null,
    message: `Supabase connection probe failed: ${probeError.message}`,
  };
};

const getAuthenticatedUserId = async () => {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.user.id ?? null;
};

const getRemoteWorkspaceId = async () => {
  const context = await fetchRemoteWorkspaceContext();
  return context?.membership?.workspace_id ?? context?.workspace?.id ?? null;
};

export const fetchRemoteWorkspaceContext = async (): Promise<RemoteWorkspaceContext | null> => {
  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("workspace_memberships")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  let workspace: RemoteWorkspace | null = null;
  if (membership?.workspace_id) {
    const workspaceResult = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", membership.workspace_id)
      .maybeSingle();
    workspace = workspaceResult.data ?? null;
  }

  return {
    profile: profile ?? null,
    membership: membership ?? null,
    workspace,
  };
};

export const mergeSettingsWithRemoteContext = async (
  localSettings: WorkspaceSettings,
): Promise<WorkspaceSettings> => {
  const context = await fetchRemoteWorkspaceContext();
  if (!context) return localSettings;

  const profileNames = splitDisplayName(context.profile?.display_name);

  return {
    ...localSettings,
    profile: {
      ...localSettings.profile,
      firstName: profileNames.firstName || localSettings.profile.firstName,
      lastName: profileNames.lastName || localSettings.profile.lastName,
      avatarUrl: context.profile?.avatar_url ?? localSettings.profile.avatarUrl,
      email: localSettings.profile.email,
    },
    namespace: {
      ...localSettings.namespace,
      organization: context.workspace?.name ?? localSettings.namespace.organization,
      slug: context.workspace?.slug ?? localSettings.namespace.slug,
      portfolioOffice: context.workspace?.portfolio_office ?? localSettings.namespace.portfolioOffice,
      timezone: context.workspace?.timezone ?? localSettings.namespace.timezone,
    },
    currentUser: {
      ...localSettings.currentUser,
      displayName: context.profile?.display_name ?? localSettings.currentUser.displayName,
      roleId: context.membership?.role ?? localSettings.currentUser.roleId,
      authUserId: context.profile?.user_id ?? localSettings.currentUser.authUserId,
    },
  };
};

const mapRemoteProjectToWorkspace = (
  remote: RemoteProject,
  existing?: WorkspaceProject,
): WorkspaceProject => ({
  ...(existing ?? createFallbackProject(remote.id, remote.name)),
  id: remote.id,
  name: remote.name,
  description: remote.description ?? existing?.description ?? "",
  status: (remote.status as WorkspaceProject["status"]) ?? existing?.status ?? "active",
  progress: remote.progress ?? existing?.progress ?? 0,
  priority: (remote.priority as WorkspaceProject["priority"]) ?? existing?.priority ?? "medium",
  startDate: remote.start_date ?? existing?.startDate ?? "",
  endDate: remote.end_date ?? existing?.endDate ?? "",
  start_date: remote.start_date ?? existing?.start_date ?? "",
  end_date: remote.end_date ?? existing?.end_date ?? "",
  budget: toDisplayBudget(remote.budget, existing?.budget),
  risk_level: (remote.risk_level as WorkspaceProject["risk_level"]) ?? existing?.risk_level ?? "medium",
  department: remote.department ?? existing?.department ?? "",
  projectNature: remote.project_nature ?? existing?.projectNature ?? "",
  tags: remote.tags ?? existing?.tags ?? [],
  namespace: remote.namespace ?? existing?.namespace ?? "",
  workflowId: remote.workflow_id ?? existing?.workflowId,
  customFieldValues:
    (remote.custom_field_values as Record<string, string | number | boolean> | null) ??
    existing?.customFieldValues ??
    {},
  radarLifecycle:
    (remote.radar_lifecycle as WorkspaceProject["radarLifecycle"] | null) ??
    existing?.radarLifecycle,
});

const mergeProjectsByIdentity = (
  localProjects: WorkspaceProject[],
  remoteProjects: RemoteProject[],
) => {
  const remainingLocal = [...localProjects];
  const mergedRemote = remoteProjects.map((remote) => {
    const localIndex = remainingLocal.findIndex(
      (project) =>
        project.id === remote.id ||
        normalizeText(project.name) === normalizeText(remote.name),
    );
    const existing = localIndex >= 0 ? remainingLocal.splice(localIndex, 1)[0] : undefined;
    return mapRemoteProjectToWorkspace(remote, existing);
  });

  return [...mergedRemote, ...remainingLocal];
};

const mapRemoteTaskToWorkspace = (
  remote: RemoteTask,
  localProjects: WorkspaceProject[],
  existing?: WorkspaceTask,
): WorkspaceTask => {
  const project = localProjects.find((item) => item.id === remote.project_id);
  const durationDays = remote.duration_days ? Number(remote.duration_days) : null;
  return {
    ...(existing ?? createFallbackTask(remote.id, remote.title)),
    id: remote.id,
    title: remote.title,
    description: remote.description ?? existing?.description ?? "",
    status: (remote.status as WorkspaceTask["status"]) ?? existing?.status ?? "todo",
    priority: (remote.priority as WorkspaceTask["priority"]) ?? existing?.priority ?? "medium",
    project_id: remote.project_id ?? existing?.project_id ?? "",
    projectId: remote.project_id ?? existing?.projectId ?? "",
    projectName: project?.name ?? existing?.projectName ?? "Unassigned",
    due_date: remote.due_date ?? existing?.due_date ?? "",
    dueDate: remote.due_date ?? existing?.dueDate ?? "",
    start_date: remote.start_date ?? existing?.start_date,
    end_date: remote.end_date ?? existing?.end_date,
    parentTaskId: remote.parent_task_id ?? existing?.parentTaskId,
    phase: remote.phase ?? existing?.phase ?? "Execution",
    progress: remote.progress ?? existing?.progress ?? 0,
    isMilestone: remote.is_milestone ?? existing?.isMilestone ?? false,
    predecessors: remote.depends_on ?? existing?.predecessors ?? [],
    tags: remote.tags ?? existing?.tags ?? [],
    workloadHours: remote.workload_hours ?? existing?.workloadHours ?? remote.estimated_hours ?? 0,
    duration:
      durationDays !== null && Number.isFinite(durationDays)
        ? `${durationDays}d`
        : existing?.duration ?? "3d",
    customFieldValues:
      (remote.custom_field_values as Record<string, string | number | boolean> | null) ??
      existing?.customFieldValues ??
      {},
  };
};

const mapRemoteDocumentToWorkspace = (
  remote: RemoteProjectDocument,
  existing?: WorkspaceProjectDocument,
): WorkspaceProjectDocument => {
  const metadata = (remote.metadata ?? {}) as Record<string, unknown>;
  const localId = String(metadata.localId ?? remote.id);
  const storedVersions = Array.isArray(metadata.versions)
    ? (metadata.versions as WorkspaceDocumentVersion[])
    : [];
  const nestedMetadata =
    metadata.documentMetadata && typeof metadata.documentMetadata === "object"
      ? (metadata.documentMetadata as WorkspaceProjectDocument["metadata"])
      : existing?.metadata ?? {};

  return {
    ...(existing ?? createFallbackDocument(localId, remote.name)),
    id: localId,
    name: remote.name,
    type: remote.type,
    category: remote.category as WorkspaceProjectDocument["category"],
    content: remote.content ?? existing?.content ?? "",
    uploadedAt: String(metadata.uploadedAt ?? remote.created_at),
    generated: remote.generated_by_ai || Boolean(metadata.generated),
    phase: (metadata.phase as WorkspaceProjectDocument["phase"] | undefined) ?? existing?.phase,
    deliverableType:
      (metadata.deliverableType as string | undefined) ??
      existing?.deliverableType,
    documentNature:
      (metadata.documentNature as WorkspaceProjectDocument["documentNature"] | undefined) ??
      existing?.documentNature,
    outputFormat:
      (remote.output_format as WorkspaceProjectDocument["outputFormat"]) ??
      existing?.outputFormat ??
      "doc",
    standardTemplate:
      (metadata.standardTemplate as WorkspaceProjectDocument["standardTemplate"] | undefined) ??
      existing?.standardTemplate,
    reviewStatus:
      (remote.review_status as WorkspaceProjectDocument["reviewStatus"]) ??
      existing?.reviewStatus ??
      "draft",
    linkedChannelId:
      (metadata.linkedChannelId as string | undefined) ??
      existing?.linkedChannelId,
    linkedChannelName:
      (metadata.linkedChannelName as string | undefined) ??
      existing?.linkedChannelName,
    folder: remote.folder ?? existing?.folder,
    access:
      (metadata.access as WorkspaceProjectDocument["access"] | undefined) ??
      existing?.access,
    createdBy:
      (metadata.createdBy as string | undefined) ??
      existing?.createdBy,
    lastModifiedAt:
      (metadata.lastModifiedAt as string | undefined) ??
      remote.updated_at ??
      existing?.lastModifiedAt,
    lastModifiedBy:
      (metadata.lastModifiedBy as string | undefined) ??
      existing?.lastModifiedBy,
    provider:
      (remote.provider as WorkspaceProjectDocument["provider"]) ??
      existing?.provider ??
      "workspace",
    externalUrl: remote.external_url ?? existing?.externalUrl,
    metadata: nestedMetadata,
    versions: storedVersions,
  };
};

const mergeTasksByIdentity = (
  localTasks: WorkspaceTask[],
  remoteTasks: RemoteTask[],
  localProjects: WorkspaceProject[],
) => {
  const remainingLocal = [...localTasks];
  const mergedRemote = remoteTasks.map((remote) => {
    const localIndex = remainingLocal.findIndex(
      (task) =>
        task.id === remote.id ||
        (normalizeText(task.title) === normalizeText(remote.title) &&
          (task.project_id ?? task.projectId ?? "") === (remote.project_id ?? "")),
    );
    const existing = localIndex >= 0 ? remainingLocal.splice(localIndex, 1)[0] : undefined;
    return mapRemoteTaskToWorkspace(remote, localProjects, existing);
  });

  return [...mergedRemote, ...remainingLocal];
};

const mergeDocumentsByIdentity = (
  localDocuments: WorkspaceProjectDocument[],
  remoteDocuments: RemoteProjectDocument[],
) => {
  const remainingLocal = [...localDocuments];
  const mergedRemote = remoteDocuments.map((remote) => {
    const metadata = (remote.metadata ?? {}) as Record<string, unknown>;
    const remoteLocalId = String(metadata.localId ?? remote.id);
    const localIndex = remainingLocal.findIndex(
      (document) =>
        document.id === remoteLocalId ||
        (normalizeText(document.name) === normalizeText(remote.name) &&
          normalizeText(document.type) === normalizeText(remote.type)),
    );
    const existing = localIndex >= 0 ? remainingLocal.splice(localIndex, 1)[0] : undefined;
    return mapRemoteDocumentToWorkspace(remote, existing);
  });

  return [...mergedRemote, ...remainingLocal];
};

const mapRemoteTeamMemberToWorkspace = (
  remote: RemoteTeamMember,
  existing?: WorkspaceTeamMember,
): WorkspaceTeamMember => {
  const metadata = (remote.metadata ?? {}) as Record<string, unknown>;
  return {
    ...(existing ?? createFallbackTeamMember(remote.id, remote.name)),
    id: remote.id,
    name: remote.name,
    role: remote.role_title ?? existing?.role ?? "",
    avatar: buildAvatar(remote.name, existing?.avatar),
    email: remote.email ?? existing?.email ?? "",
    status: (String(metadata.status ?? existing?.status ?? "online") as WorkspaceTeamMember["status"]),
    phone: String(metadata.phone ?? existing?.phone ?? ""),
    department: remote.department ?? existing?.department ?? "",
    avatarColor: String(metadata.avatarColor ?? existing?.avatarColor ?? "gradient-primary"),
    assignedProjectIds: Array.isArray(metadata.assignedProjectIds)
      ? (metadata.assignedProjectIds as string[])
      : (existing?.assignedProjectIds ?? []),
    capacityHours: remote.capacity_hours ?? existing?.capacityHours ?? 40,
    utilizationTarget: remote.utilization_target ?? existing?.utilizationTarget ?? 85,
    privilegeRole: remote.privilege_role ?? existing?.privilegeRole ?? "team_member",
    customFieldValues:
      (metadata.customFieldValues as Record<string, string | number | boolean> | undefined) ??
      existing?.customFieldValues ??
      {},
  };
};

const mergeTeamMembersByIdentity = (
  localMembers: WorkspaceTeamMember[],
  remoteMembers: RemoteTeamMember[],
) => {
  const remainingLocal = [...localMembers];
  const mergedRemote = remoteMembers.map((remote) => {
    const localIndex = remainingLocal.findIndex(
      (member) =>
        member.id === remote.id ||
        normalizeText(member.email) === normalizeText(remote.email) ||
        normalizeText(member.name) === normalizeText(remote.name),
    );
    const existing = localIndex >= 0 ? remainingLocal.splice(localIndex, 1)[0] : undefined;
    return mapRemoteTeamMemberToWorkspace(remote, existing);
  });

  return [...mergedRemote, ...remainingLocal];
};

const mapRemoteMeetingToWorkspace = (
  remote: RemoteMeeting,
  existing?: WorkspaceMeeting,
): WorkspaceMeeting => ({
  ...(existing ?? createFallbackMeeting(remote.id, remote.title)),
  id: remote.id,
  title: remote.title,
  projectId: remote.project_id ?? existing?.projectId,
  taskId: remote.task_id ?? existing?.taskId,
  channelId: remote.channel_id ?? existing?.channelId,
  organizerId: remote.created_by ?? existing?.organizerId,
  attendeeIds: existing?.attendeeIds ?? [],
  startsAt: remote.starts_at,
  endsAt: remote.ends_at,
  provider: (remote.provider as WorkspaceMeeting["provider"]) ?? existing?.provider ?? "workspace",
  joinUrl: remote.join_url ?? existing?.joinUrl,
  status: (remote.status as WorkspaceMeeting["status"]) ?? existing?.status ?? "scheduled",
  type: existing?.type ?? "Planning",
  notes: existing?.notes,
});

const mergeMeetingsByIdentity = (
  localMeetings: WorkspaceMeeting[],
  remoteMeetings: RemoteMeeting[],
) => {
  const remainingLocal = [...localMeetings];
  const mergedRemote = remoteMeetings.map((remote) => {
    const localIndex = remainingLocal.findIndex((meeting) => meeting.id === remote.id);
    const existing = localIndex >= 0 ? remainingLocal.splice(localIndex, 1)[0] : undefined;
    return mapRemoteMeetingToWorkspace(remote, existing);
  });

  return [...mergedRemote, ...remainingLocal];
};

const mapRemotePersonalEventToWorkspace = (
  remote: RemotePersonalEvent,
  existing?: WorkspacePersonalEvent,
): WorkspacePersonalEvent => ({
  ...(existing ?? createFallbackPersonalEvent(remote.id, remote.title)),
  id: remote.id,
  memberId: remote.user_id ?? existing?.memberId ?? "",
  title: remote.title,
  type: (remote.kind as WorkspacePersonalEvent["type"]) ?? existing?.type ?? "personal",
  startsAt: remote.starts_at,
  endsAt: remote.ends_at,
  notes: remote.notes ?? existing?.notes,
});

const mergePersonalEventsByIdentity = (
  localEvents: WorkspacePersonalEvent[],
  remoteEvents: RemotePersonalEvent[],
) => {
  const remainingLocal = [...localEvents];
  const mergedRemote = remoteEvents.map((remote) => {
    const localIndex = remainingLocal.findIndex((event) => event.id === remote.id);
    const existing = localIndex >= 0 ? remainingLocal.splice(localIndex, 1)[0] : undefined;
    return mapRemotePersonalEventToWorkspace(remote, existing);
  });

  return [...mergedRemote, ...remainingLocal];
};

const mapRemoteStickyNoteToWorkspace = (
  remote: RemoteStickyNote,
  existing?: WorkspaceStickyNote,
): WorkspaceStickyNote => ({
  ...(existing ?? createFallbackStickyNote(remote.id, remote.title ?? "Quick note")),
  id: remote.id,
  ownerUserAccountId: remote.user_id ?? existing?.ownerUserAccountId,
  ownerName: existing?.ownerName ?? "Workspace User",
  title: remote.title ?? existing?.title ?? "Quick note",
  content: remote.content,
  color: (remote.color as WorkspaceStickyNote["color"]) ?? existing?.color ?? "amber",
  done: remote.done,
  createdAt: remote.created_at,
});

const mergeStickyNotesByIdentity = (
  localNotes: WorkspaceStickyNote[],
  remoteNotes: RemoteStickyNote[],
) => {
  const remainingLocal = [...localNotes];
  const mergedRemote = remoteNotes.map((remote) => {
    const localIndex = remainingLocal.findIndex((note) => note.id === remote.id);
    const existing = localIndex >= 0 ? remainingLocal.splice(localIndex, 1)[0] : undefined;
    return mapRemoteStickyNoteToWorkspace(remote, existing);
  });

  return [...mergedRemote, ...remainingLocal];
};

const mapRemoteTicketToWorkspace = (
  remote: RemoteTicket,
  existing?: WorkspaceTicket,
): WorkspaceTicket => ({
  ...(existing ?? {
    id: remote.id,
    title: remote.title,
    description: "",
    status: "open",
    priority: "medium",
    assignee: "Unassigned",
    createdAt: remote.created_at,
    sla: "",
    comments: [],
    customFieldValues: {},
  }),
  id: remote.id,
  title: remote.title,
  description: remote.description ?? existing?.description ?? "",
  status: (remote.status as WorkspaceTicket["status"]) ?? existing?.status ?? "open",
  priority: (remote.priority as WorkspaceTicket["priority"]) ?? existing?.priority ?? "medium",
  assignee: existing?.assignee ?? "Unassigned",
  projectId: remote.project_id ?? existing?.projectId,
  taskId: remote.task_id ?? existing?.taskId,
  createdAt: remote.created_at,
  sla:
    remote.sla_deadline
      ? `Due ${new Date(remote.sla_deadline).toLocaleString()}`
      : existing?.sla ?? "No SLA set",
  comments: existing?.comments ?? [],
  customFieldValues:
    (remote.custom_field_values as Record<string, string | number | boolean> | null) ??
    existing?.customFieldValues ??
    {},
});

const mergeTicketsByIdentity = (
  localTickets: WorkspaceTicket[],
  remoteTickets: RemoteTicket[],
) => {
  const remainingLocal = [...localTickets];
  const mergedRemote = remoteTickets.map((remote) => {
    const localIndex = remainingLocal.findIndex((ticket) => ticket.id === remote.id);
    const existing = localIndex >= 0 ? remainingLocal.splice(localIndex, 1)[0] : undefined;
    return mapRemoteTicketToWorkspace(remote, existing);
  });

  return [...mergedRemote, ...remainingLocal];
};

const mapRemoteChatMessageToWorkspace = (
  remote: RemoteChatMessage,
  teamMembers: WorkspaceTeamMember[],
  userAccounts: WorkspaceUserAccount[],
  existing?: WorkspaceChatMessage,
): WorkspaceChatMessage => {
  const author =
    teamMembers.find((member) => member.id === existing?.authorId) ??
    userAccounts.find((account) => normalizeText(account.email) === normalizeText(existing?.authorName));

  return {
    ...(existing ?? {
      id: remote.id,
      authorName: "Workspace User",
      message: remote.message,
      createdAt: remote.created_at,
    }),
    id: remote.id,
    authorId: remote.author_user_id ?? existing?.authorId,
    authorName: (author as WorkspaceTeamMember | undefined)?.name ?? (author as WorkspaceUserAccount | undefined)?.fullName ?? existing?.authorName ?? "Workspace User",
    message: remote.message,
    createdAt: remote.created_at,
    parentId: remote.parent_message_id ?? existing?.parentId,
    mentions: remote.mentions ?? existing?.mentions ?? [],
    attachments: Array.isArray(remote.attachments)
      ? (remote.attachments as Array<{ name: string; url?: string }>)
      : existing?.attachments ?? [],
    pinned: remote.pinned ?? existing?.pinned ?? false,
  };
};

const mapRemoteChatChannelToWorkspace = (
  remote: RemoteChatChannel,
  messages: WorkspaceChatMessage[],
  existing?: WorkspaceChatChannel,
): WorkspaceChatChannel => ({
  ...(existing ?? {
    id: remote.id,
    name: remote.name,
    topic: remote.topic ?? "",
    memberIds: [],
    messages: [],
  }),
  id: remote.id,
  name: remote.name,
  topic: remote.topic ?? existing?.topic ?? "",
  memberIds: existing?.memberIds ?? [],
  messages,
  projectId: remote.project_id ?? existing?.projectId,
  kind: remote.kind ?? existing?.kind ?? "general",
  readOnly: remote.read_only ?? existing?.readOnly ?? false,
  whatsappGroupUrl: remote.whatsapp_group_url ?? existing?.whatsappGroupUrl ?? "",
  quickLinks: Array.isArray(remote.quick_links)
    ? (remote.quick_links as WorkspaceChatChannel["quickLinks"])
    : existing?.quickLinks ?? [],
});

const mapRemoteDashboardToWorkspace = (
  remote: RemoteDashboard,
  existing?: WorkspaceDashboard,
): WorkspaceDashboard => {
  const layout = Array.isArray(remote.layout) ? remote.layout : existing?.widgets ?? [];
  return {
    ...(existing ?? { id: remote.id, name: remote.name, isDefault: remote.is_default, widgets: [] }),
    id: remote.id,
    name: remote.name,
    isDefault: remote.is_default,
    widgets: layout as WorkspaceDashboard["widgets"],
  };
};

const mergeDashboardsByIdentity = (
  localDashboards: WorkspaceDashboard[],
  remoteDashboards: RemoteDashboard[],
) => {
  const remainingLocal = [...localDashboards];
  const mergedRemote = remoteDashboards.map((remote) => {
    const localIndex = remainingLocal.findIndex((dashboard) => dashboard.id === remote.id);
    const existing = localIndex >= 0 ? remainingLocal.splice(localIndex, 1)[0] : undefined;
    return mapRemoteDashboardToWorkspace(remote, existing);
  });

  return [...mergedRemote, ...remainingLocal];
};

const buildRemoteWorkspaceUserAccounts = (
  memberships: RemoteWorkspaceMembership[],
  profiles: RemoteProfile[],
  teamMembers: WorkspaceTeamMember[],
  localAccounts: WorkspaceUserAccount[],
  workspaceEmailFallback?: string | null,
) =>
  memberships.map((membership) => {
    const profile = profiles.find((item) => item.user_id === membership.user_id);
    const linkedMember =
      teamMembers.find((member) => member.id === profile?.id || member.id === membership.user_id) ??
      teamMembers.find((member) => normalizeText(member.email) === normalizeText(workspaceEmailFallback)) ??
      teamMembers.find((member) => normalizeText(member.email) === normalizeText(localAccounts.find((account) => account.id === membership.id)?.email));
    const existing = localAccounts.find(
      (account) =>
        account.id === membership.id ||
        normalizeText(account.email) === normalizeText(linkedMember?.email) ||
        normalizeText(account.fullName) === normalizeText(profile?.display_name) ||
        normalizeText(account.fullName) === normalizeText(linkedMember?.name),
    );

    const fullName =
      profile?.display_name ??
      linkedMember?.name ??
      existing?.fullName ??
      membership.user_id;

    return {
      id: membership.id,
      fullName,
      email: linkedMember?.email ?? existing?.email ?? workspaceEmailFallback ?? "",
      roleId: normalizeWorkspaceRoleId(membership.role),
      status: membership.status === "active" ? "active" : membership.status === "suspended" ? "suspended" : "invited",
      authProvider: existing?.authProvider ?? "email",
      teamMemberId: linkedMember?.id ?? existing?.teamMemberId,
      title: membership.title ?? linkedMember?.role ?? existing?.title ?? "",
      department: linkedMember?.department ?? profile?.department ?? existing?.department ?? "",
      createdAt: membership.joined_at,
      lastAccessAt: existing?.lastAccessAt,
      invitationSentAt: existing?.invitationSentAt,
      passwordResetSentAt: existing?.passwordResetSentAt,
      lastNotificationAt: existing?.lastNotificationAt,
      notificationCount: existing?.notificationCount,
      invitedBy: existing?.invitedBy,
      notes: existing?.notes,
    } satisfies WorkspaceUserAccount;
  });

export const fetchMergedProjects = async () => {
  const local = readWorkspaceData().projects;
  const userId = await getAuthenticatedUserId();
  const workspaceId = await getRemoteWorkspaceId();
  if (!userId) return local;

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error || !data) return local;

  const mergedProjects = mergeProjectsByIdentity(local, data);
  if (!workspaceId) return mergedProjects;

  const { data: remoteDocuments, error: documentError } = await supabase
    .from("project_documents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (documentError || !remoteDocuments) return mergedProjects;

  const documentsByProject = remoteDocuments.reduce<Record<string, RemoteProjectDocument[]>>(
    (acc, document) => {
      if (!document.project_id) return acc;
      acc[document.project_id] = acc[document.project_id] ?? [];
      acc[document.project_id].push(document);
      return acc;
    },
    {},
  );

  return mergedProjects.map((project) => ({
    ...project,
    documents: mergeDocumentsByIdentity(
      project.documents ?? [],
      documentsByProject[project.id] ?? [],
    ),
  }));
};

export const fetchMergedTasks = async (projectId?: string) => {
  const localData = readWorkspaceData();
  const mergedProjects = await fetchMergedProjects();
  const localTasks = projectId
    ? localData.tasks.filter((task) => (task.project_id ?? task.projectId) === projectId)
    : localData.tasks;
  const userId = await getAuthenticatedUserId();
  if (!userId) return localTasks;

  let query = supabase.from("tasks").select("*").order("updated_at", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;

  if (error || !data) return localTasks;
  return mergeTasksByIdentity(localTasks, data, mergedProjects);
};

export const fetchMergedTeamMembers = async () => {
  const localMembers = readWorkspaceData().teamMembers;
  const workspaceId = await getRemoteWorkspaceId();
  if (!workspaceId) return localMembers;

  const { data, error } = await supabase
    .from("team_members" as never)
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error || !data) return localMembers;
  return mergeTeamMembersByIdentity(localMembers, data as unknown as RemoteTeamMember[]);
};

export const fetchMergedUserAccounts = async () => {
  const localData = readWorkspaceData();
  const workspaceId = await getRemoteWorkspaceId();
  const userId = await getAuthenticatedUserId();
  if (!workspaceId || !userId) return localData.userAccounts;

  const [membershipsResult, profilesResult, teamMembers] = await Promise.all([
    supabase
      .from("workspace_memberships")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("joined_at", { ascending: true }),
    supabase.from("profiles").select("*"),
    fetchMergedTeamMembers(),
  ]);

  if (membershipsResult.error || !membershipsResult.data || profilesResult.error || !profilesResult.data) {
    return localData.userAccounts;
  }

  const remoteAccounts = buildRemoteWorkspaceUserAccounts(
    membershipsResult.data,
    profilesResult.data,
    teamMembers,
    localData.userAccounts,
    localData.settings.profile.email,
  );

  return mergeWorkspaceUserAccounts(localData.userAccounts, remoteAccounts);
};

export const fetchMergedTickets = async () => {
  const localTickets = readWorkspaceData().tickets;
  const workspaceId = await getRemoteWorkspaceId();
  if (!workspaceId) return localTickets;

  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error || !data) return localTickets;
  return mergeTicketsByIdentity(localTickets, data);
};

export const fetchMergedChatChannels = async () => {
  const localChannels = readWorkspaceData().chatChannels;
  const workspaceId = await getRemoteWorkspaceId();
  if (!workspaceId) return localChannels;

  const channelsResult = await supabase
    .from("chat_channels")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (channelsResult.error || !channelsResult.data) {
    return localChannels;
  }

  const channelIds = channelsResult.data.map((channel) => channel.id);
  const [messagesResult, teamMembers, userAccounts] = await Promise.all([
    channelIds.length
      ? supabase
          .from("chat_messages")
          .select("*")
          .in("channel_id", channelIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    fetchMergedTeamMembers(),
    fetchMergedUserAccounts(),
  ]);

  if (messagesResult.error || !messagesResult.data) return localChannels;

  const remoteMessagesByChannel = messagesResult.data.reduce<Record<string, WorkspaceChatMessage[]>>(
    (acc, message) => {
      acc[message.channel_id] = acc[message.channel_id] ?? [];
      const existingMessage = localChannels
        .flatMap((channel) => channel.messages)
        .find((item) => item.id === message.id);
      acc[message.channel_id].push(
        mapRemoteChatMessageToWorkspace(message, teamMembers, userAccounts, existingMessage),
      );
      return acc;
    },
    {},
  );

  const remainingLocal = [...localChannels];
  const mergedRemote = channelsResult.data.map((channel) => {
    const localIndex = remainingLocal.findIndex((item) => item.id === channel.id);
    const existing = localIndex >= 0 ? remainingLocal.splice(localIndex, 1)[0] : undefined;
    return mapRemoteChatChannelToWorkspace(
      channel,
      remoteMessagesByChannel[channel.id] ?? existing?.messages ?? [],
      existing,
    );
  });

  return [...mergedRemote, ...remainingLocal];
};

export const fetchMergedDashboards = async () => {
  const localDashboards = readWorkspaceData().dashboards;
  const workspaceId = await getRemoteWorkspaceId();
  if (!workspaceId) return localDashboards;

  const { data, error } = await supabase
    .from("dashboards")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error || !data) return localDashboards;
  return mergeDashboardsByIdentity(localDashboards, data);
};

export const fetchMergedMeetings = async (projectId?: string) => {
  const localData = readWorkspaceData();
  const localMeetings = projectId
    ? localData.meetings.filter((meeting) => meeting.projectId === projectId)
    : localData.meetings;
  const workspaceId = await getRemoteWorkspaceId();
  if (!workspaceId) return localMeetings;

  let query = supabase
    .from("meetings" as never)
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);

  const { data, error } = await query;
  if (error || !data) return localMeetings;
  return mergeMeetingsByIdentity(localMeetings, data as unknown as RemoteMeeting[]);
};

export const fetchMergedPersonalEvents = async () => {
  const localEvents = readWorkspaceData().personalEvents;
  const workspaceId = await getRemoteWorkspaceId();
  if (!workspaceId) return localEvents;

  const { data, error } = await supabase
    .from("personal_events" as never)
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error || !data) return localEvents;
  return mergePersonalEventsByIdentity(localEvents, data as unknown as RemotePersonalEvent[]);
};

export const fetchMergedStickyNotes = async () => {
  const localNotes = readWorkspaceData().stickyNotes;
  const workspaceId = await getRemoteWorkspaceId();
  if (!workspaceId) return localNotes;

  const { data, error } = await supabase
    .from("sticky_notes" as never)
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error || !data) return localNotes;
  return mergeStickyNotesByIdentity(localNotes, data as unknown as RemoteStickyNote[]);
};

export const syncProfileFromSettings = async (settings: WorkspaceSettings) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) return;

  const displayName = `${settings.profile.firstName} ${settings.profile.lastName}`.trim();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        display_name: displayName || settings.currentUser.displayName,
        avatar_url: settings.profile.avatarUrl ?? null,
        department: settings.namespace.portfolioOffice ?? null,
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();
  assertNoSupabaseError(error, "Failed to sync profile settings");
  if (!data) throw new Error("Profile save returned no row -- RLS may have blocked the write");
  return data;
};

export const upsertRemoteProject = async (project: WorkspaceProject) => {
  const userId = await getAuthenticatedUserId();
  const workspaceId = await getRemoteWorkspaceId();
  if (!userId) return;

  const { data, error } = await supabase
    .from("projects")
    .upsert(
      {
        id: project.id,
        name: project.name,
        description: project.description ?? null,
        status: project.status,
        progress: project.progress ?? 0,
        priority: project.priority,
        owner_id: userId,
        start_date: project.start_date ?? project.startDate ?? null,
        end_date: project.end_date ?? project.endDate ?? null,
        budget: parseBudget(project.budget),
        risk_level: project.risk_level ?? null,
        ai_summary: project.description ?? null,
        workspace_id: workspaceId,
        namespace: project.namespace ?? null,
        department: project.department ?? null,
        project_nature: project.projectNature ?? null,
        tags: project.tags ?? [],
        workflow_id: project.workflowId ?? null,
        custom_field_values: project.customFieldValues ?? {},
        radar_lifecycle: project.radarLifecycle ?? {},
      },
      { onConflict: "id" },
    )
    .select()
    .single();
  assertNoSupabaseError(error, "Failed to upsert project");
  if (!data) throw new Error("Project save returned no row -- RLS may have blocked the write");
  return data;
};

export const upsertRemoteProjectDocuments = async (
  projectId: string,
  documents: WorkspaceProjectDocument[],
) => {
  const workspaceId = await getRemoteWorkspaceId();
  const userId = await getAuthenticatedUserId();
  if (!workspaceId) return;

  const { data: existingDocuments } = await supabase
    .from("project_documents")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId);

  const remoteIds = documents.map((document) => getRemoteDocumentId(projectId, document));
  const idsToDelete =
    existingDocuments
      ?.map((document) => document.id)
      .filter((id) => !remoteIds.includes(id)) ?? [];

  if (idsToDelete.length) {
    const { error } = await supabase.from("project_documents").delete().in("id", idsToDelete);
    assertNoSupabaseError(error, "Failed to delete stale project documents");
  }

  if (documents.length === 0) return;

  const { error } = await supabase.from("project_documents").upsert(
    documents.map((document) => {
      const remoteId = getRemoteDocumentId(projectId, document);
      const versions = (document.versions ?? []).map((version, index) => ({
        ...version,
        id: getRemoteVersionId(remoteId, version, index),
      }));

      return {
        id: remoteId,
        workspace_id: workspaceId,
        project_id: projectId,
        folder: document.folder ?? null,
        name: document.name,
        type: document.type,
        category: document.category,
        review_status: document.reviewStatus ?? "draft",
        output_format: document.outputFormat ?? "doc",
        provider: document.provider ?? "workspace",
        external_url: document.externalUrl ?? null,
        metadata: {
          localId: document.id,
          phase: document.phase ?? null,
          deliverableType: document.deliverableType ?? null,
          documentNature: document.documentNature ?? null,
          standardTemplate: document.standardTemplate ?? null,
          access: document.access ?? null,
          createdBy: document.createdBy ?? null,
          lastModifiedAt: document.lastModifiedAt ?? null,
          lastModifiedBy: document.lastModifiedBy ?? null,
          linkedChannelId: document.linkedChannelId ?? null,
          linkedChannelName: document.linkedChannelName ?? null,
          uploadedAt: document.uploadedAt,
          generated: document.generated ?? false,
          documentMetadata: document.metadata ?? {},
          versions,
        },
        content: document.content ?? "",
        generated_by_ai: document.generated ?? false,
        created_by: userId ?? null,
      };
    }),
    { onConflict: "id" },
  );
  assertNoSupabaseError(error, "Failed to upsert project documents");
};

export const deleteRemoteProject = async (projectId: string) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) return;
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  assertNoSupabaseError(error, "Failed to delete project");
};

export const upsertRemoteTask = async (task: WorkspaceTask) => {
  const userId = await getAuthenticatedUserId();
  const workspaceId = await getRemoteWorkspaceId();
  if (!userId) return;

  const durationDays =
    Number.parseFloat(String(task.duration ?? "").replace(/[^\d.]/g, "")) || null;

  const { data, error } = await supabase
    .from("tasks")
    .upsert(
      {
        id: task.id,
        title: task.title,
        description: task.description ?? null,
        status: task.status,
        priority: task.priority,
        assignee_id: null,
        workspace_id: workspaceId,
        project_id: task.project_id ?? task.projectId ?? null,
        due_date: task.due_date ?? task.dueDate ?? null,
        start_date: task.start_date ?? null,
        end_date: task.end_date ?? null,
        parent_task_id: task.parentTaskId ?? null,
        phase: task.phase ?? null,
        progress: task.progress ?? 0,
        is_milestone: task.isMilestone ?? false,
        tags: task.tags ?? [],
        depends_on: task.predecessors ?? [],
        estimated_hours: task.workloadHours ?? null,
        actual_hours: null,
        workload_hours: task.workloadHours ?? null,
        duration_days: durationDays,
        custom_field_values: task.customFieldValues ?? {},
        ai_generated: false,
        created_by: userId,
      },
      { onConflict: "id" },
    )
    .select()
    .single();
  assertNoSupabaseError(error, "Failed to upsert task");
  if (!data) throw new Error("Task save returned no row -- RLS may have blocked the write");
  return data;

};

export const deleteRemoteTask = async (taskId: string) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) return;
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  assertNoSupabaseError(error, "Failed to delete task");
};

export const upsertRemoteTicket = async (ticket: WorkspaceTicket) => {
  const workspaceId = await getRemoteWorkspaceId();
  if (!workspaceId) return;

  const { data, error } = await supabase
    .from("tickets")
    .upsert(
      {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description ?? null,
        status: ticket.status,
        priority: ticket.priority,
        project_id: ticket.projectId ?? null,
        task_id: ticket.taskId ?? null,
        workspace_id: workspaceId,
        custom_field_values: ticket.customFieldValues ?? {},
      },
      { onConflict: "id" },
    )
    .select()
    .single();
  assertNoSupabaseError(error, "Failed to upsert ticket");
  if (!data) throw new Error("Ticket save returned no row -- RLS may have blocked the write");
  return data;
};

export const deleteRemoteTicket = async (ticketId: string) => {
  const { error } = await supabase.from("tickets").delete().eq("id", ticketId);
  assertNoSupabaseError(error, "Failed to delete ticket");
};

export const upsertRemoteChatChannel = async (channel: WorkspaceChatChannel) => {
  const workspaceId = await getRemoteWorkspaceId();
  const userId = await getAuthenticatedUserId();
  if (!workspaceId) return;

  const { data, error } = await supabase
    .from("chat_channels")
    .upsert(
      {
        id: channel.id,
        workspace_id: workspaceId,
        created_by: userId ?? null,
        name: channel.name,
        topic: channel.topic ?? null,
        project_id: channel.projectId ?? null,
        kind: channel.kind ?? "general",
        read_only: channel.readOnly ?? false,
        whatsapp_group_url: channel.whatsappGroupUrl ?? null,
        quick_links: channel.quickLinks ?? [],
      },
      { onConflict: "id" },
    )
    .select()
    .single();
  assertNoSupabaseError(error, "Failed to upsert chat channel");
  if (!data) throw new Error("Chat channel save returned no row -- RLS may have blocked the write");
  return data;
};

export const upsertRemoteChatMessage = async (
  message: WorkspaceChatMessage & { channelId: string },
) => {
  const userId = await getAuthenticatedUserId();
  const { data, error } = await supabase
    .from("chat_messages")
    .upsert(
      {
        id: message.id,
        channel_id: message.channelId,
        author_user_id: userId ?? null,
        message: message.message,
        parent_message_id: message.parentId ?? null,
        mentions: message.mentions ?? [],
        attachments: message.attachments ?? [],
        pinned: message.pinned ?? false,
      },
      { onConflict: "id" },
    )
    .select()
    .single();
  assertNoSupabaseError(error, "Failed to upsert chat message");
  if (!data) throw new Error("Chat message save returned no row -- RLS may have blocked the write");
  return data;
};

export const upsertRemoteDashboard = async (dashboard: WorkspaceDashboard) => {
  const workspaceId = await getRemoteWorkspaceId();
  const userId = await getAuthenticatedUserId();
  if (!workspaceId) return;

  const { data, error } = await supabase
    .from("dashboards")
    .upsert(
      {
        id: dashboard.id,
        workspace_id: workspaceId,
        created_by: userId ?? null,
        name: dashboard.name,
        is_default: dashboard.isDefault,
        layout: dashboard.widgets ?? [],
      },
      { onConflict: "id" },
    )
    .select()
    .single();
  assertNoSupabaseError(error, "Failed to upsert dashboard");
  if (!data) throw new Error("Dashboard save returned no row -- RLS may have blocked the write");
  return data;
};

export const syncWorkspaceUserAccount = async (
  account: Partial<WorkspaceUserAccount> & { id: string },
) => {
  const workspaceId = await getRemoteWorkspaceId();
  if (!workspaceId) return;

  const { data: memberships, error: membershipError } = await supabase
    .from("workspace_memberships")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", account.id)
    .limit(1);
  assertNoSupabaseError(membershipError, "Failed to load workspace membership");

  const membership = memberships?.[0];
  if (!membership) {
    throw new Error("This workspace account is not linked to a remote membership yet.");
  }

  const remoteRole = toRemoteWorkspaceRoleId(account.roleId ?? membership.role);

  const { error: updateMembershipError } = await supabase
    .from("workspace_memberships")
    .update({
      role: remoteRole as never,
      status: account.status ?? membership.status,
      title: account.title ?? membership.title,
    })
    .eq("id", membership.id);
  assertNoSupabaseError(updateMembershipError, "Failed to update workspace membership");

  const remoteTeamMembers = await fetchMergedTeamMembers();
  const linkedMember = remoteTeamMembers.find(
    (member) =>
      member.id === account.teamMemberId ||
      normalizeText(member.email) === normalizeText(account.email),
  );

  if (linkedMember) {
    await upsertRemoteTeamMember({
      ...linkedMember,
      name: account.fullName ?? linkedMember.name,
      email: account.email ?? linkedMember.email,
      role: account.title ?? linkedMember.role,
      department: account.department ?? linkedMember.department,
      privilegeRole: account.roleId ?? linkedMember.privilegeRole,
    });
  }
};

export const upsertRemoteTeamMember = async (member: WorkspaceTeamMember) => {
  const workspaceId = await getRemoteWorkspaceId();
  if (!workspaceId) return;

  const { error } = await supabase.from("team_members" as never).upsert(
    {
      id: member.id,
      workspace_id: workspaceId,
      name: member.name,
      email: member.email || null,
      role_title: member.role || null,
      department: member.department || null,
      privilege_role: toRemoteWorkspaceRoleId(member.privilegeRole ?? "team_member"),
      capacity_hours: member.capacityHours ?? 40,
      utilization_target: member.utilizationTarget ?? 85,
      metadata: {
        phone: member.phone ?? null,
        avatarColor: member.avatarColor ?? "gradient-primary",
        assignedProjectIds: member.assignedProjectIds ?? [],
        customFieldValues: member.customFieldValues ?? {},
        status: member.status ?? "online",
      },
    } as never,
    { onConflict: "id" },
  );
  assertNoSupabaseError(error, "Failed to upsert team member");
};

export const upsertRemoteMeeting = async (meeting: WorkspaceMeeting) => {
  const workspaceId = await getRemoteWorkspaceId();
  const userId = await getAuthenticatedUserId();
  if (!workspaceId) return;

  const { error } = await supabase.from("meetings" as never).upsert(
    {
      id: meeting.id,
      workspace_id: workspaceId,
      project_id: meeting.projectId ?? null,
      task_id: meeting.taskId ?? null,
      channel_id: meeting.channelId ?? null,
      title: meeting.title,
      provider: meeting.provider ?? "workspace",
      starts_at: meeting.startsAt,
      ends_at: meeting.endsAt,
      join_url: meeting.joinUrl ?? null,
      status: meeting.status ?? "scheduled",
      created_by: userId ?? null,
    } as never,
    { onConflict: "id" },
  );
  assertNoSupabaseError(error, "Failed to upsert meeting");
};

export const upsertRemotePersonalEvent = async (event: WorkspacePersonalEvent) => {
  const workspaceId = await getRemoteWorkspaceId();
  const userId = await getAuthenticatedUserId();
  if (!workspaceId) return;

  const { error } = await supabase.from("personal_events" as never).upsert(
    {
      id: event.id,
      workspace_id: workspaceId,
      user_id: userId,
      title: event.title,
      kind: event.type ?? "personal",
      starts_at: event.startsAt,
      ends_at: event.endsAt,
      notes: event.notes ?? null,
    } as never,
    { onConflict: "id" },
  );
  assertNoSupabaseError(error, "Failed to upsert personal event");
};

export const upsertRemoteStickyNote = async (note: WorkspaceStickyNote) => {
  const workspaceId = await getRemoteWorkspaceId();
  const userId = await getAuthenticatedUserId();
  if (!workspaceId) return;

  const { error } = await supabase.from("sticky_notes" as never).upsert(
    {
      id: note.id,
      workspace_id: workspaceId,
      user_id: userId,
      title: note.title ?? null,
      content: note.content,
      color: note.color ?? "amber",
      done: note.done ?? false,
    } as never,
    { onConflict: "id" },
  );
  assertNoSupabaseError(error, "Failed to upsert sticky note");
};

export const deleteRemoteStickyNote = async (noteId: string) => {
  const userId = await getAuthenticatedUserId();
  if (!userId) return;
  const { error } = await supabase.from("sticky_notes" as never).delete().eq("id", noteId);
  assertNoSupabaseError(error, "Failed to delete sticky note");
};
