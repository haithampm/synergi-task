import type {
  WorkspacePermissionRole,
  WorkspaceProject,
  WorkspaceProjectResource,
  WorkspaceProjectTeamNode,
  WorkspaceTeamMember,
  WorkspaceUserAccount,
} from "@/lib/workspace-store";

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const REMOTE_TO_LOCAL_ROLE: Record<string, string> = {
  admin: "admin",
  organization_admin: "admin",
  project_admin: "admin",
  project_manager: "pm",
  team_member: "lead",
  standard_member: "lead",
  guest: "viewer",
};

const LOCAL_TO_REMOTE_ROLE: Record<string, string> = {
  admin: "admin",
  pm: "project_manager",
  lead: "team_member",
  viewer: "guest",
};

const LEADER_ROLE_MATCHERS = [
  "project manager",
  "service delivery manager",
  "delivery manager",
  "team lead",
  "leader",
  "director",
  "owner",
];

export const normalizeWorkspaceRoleId = (role?: string | null) => {
  const normalized = normalizeText(role);
  return REMOTE_TO_LOCAL_ROLE[normalized] ?? normalized ?? "viewer";
};

export const toRemoteWorkspaceRoleId = (role?: string | null) => {
  const normalized = normalizeText(role);
  return LOCAL_TO_REMOTE_ROLE[normalized] ?? normalized ?? "guest";
};

export const getRolePermissions = (
  roleId: string | undefined,
  privilegeRoles: WorkspacePermissionRole[] = [],
) => new Set(privilegeRoles.find((role) => role.id === roleId)?.permissions ?? []);

export const hasWorkspacePermission = (
  roleId: string | undefined,
  privilegeRoles: WorkspacePermissionRole[] = [],
  permission?: string,
) => {
  if (!permission) return true;
  return getRolePermissions(roleId, privilegeRoles).has(permission);
};

const isLeaderLabel = (value?: string | null) => {
  const normalized = normalizeText(value);
  return LEADER_ROLE_MATCHERS.some((label) => normalized.includes(label));
};

const findTeamMemberByProjectLink = (
  project: WorkspaceProject,
  teamMembers: WorkspaceTeamMember[],
  predicate: (candidate: WorkspaceProjectResource | WorkspaceProjectTeamNode) => boolean,
) => {
  const resource = (project.resources ?? []).find(predicate);
  if (resource?.memberId) {
    const linked = teamMembers.find((member) => member.id === resource.memberId);
    if (linked) return linked;
  }

  const node = (project.teamStructure ?? []).find(predicate);
  if (node?.memberId) {
    const linked = teamMembers.find((member) => member.id === node.memberId);
    if (linked) return linked;
  }

  return undefined;
};

export const resolveProjectLeader = (
  project: WorkspaceProject,
  teamMembers: WorkspaceTeamMember[] = [],
  userAccounts: WorkspaceUserAccount[] = [],
) => {
  const linkedLeader =
    findTeamMemberByProjectLink(project, teamMembers, (candidate) =>
      isLeaderLabel("role" in candidate ? candidate.role : candidate.title),
    ) ??
    teamMembers.find((member) => (member.assignedProjectIds ?? []).includes(project.id) && isLeaderLabel(member.role)) ??
    teamMembers.find((member) => normalizeText(member.name) === normalizeText(project.radarLifecycle?.ownerName));

  const namedLeader =
    linkedLeader?.name ??
    project.radarLifecycle?.ownerName ??
    (project.resources ?? []).find((resource) => isLeaderLabel(resource.role))?.name ??
    (project.teamStructure ?? []).find((node) => isLeaderLabel(node.title))?.name ??
    "Unassigned";

  const linkedUserAccount = linkedLeader
    ? userAccounts.find(
        (account) =>
          (linkedLeader.id && account.teamMemberId === linkedLeader.id) ||
          normalizeText(account.email) === normalizeText(linkedLeader.email) ||
          normalizeText(account.fullName) === normalizeText(linkedLeader.name),
      )
    : userAccounts.find((account) => normalizeText(account.fullName) === normalizeText(namedLeader));

  return {
    member: linkedLeader,
    userAccount: linkedUserAccount,
    name: linkedUserAccount?.fullName ?? linkedLeader?.name ?? namedLeader,
    roleLabel:
      linkedLeader?.role ??
      linkedUserAccount?.title ??
      (project.resources ?? []).find((resource) => normalizeText(resource.name) === normalizeText(namedLeader))?.role ??
      (project.teamStructure ?? []).find((node) => normalizeText(node.name) === normalizeText(namedLeader))?.title ??
      "Project Leader",
  };
};

export const getProjectLinkedUserAccounts = (
  project: WorkspaceProject,
  teamMembers: WorkspaceTeamMember[] = [],
  userAccounts: WorkspaceUserAccount[] = [],
) => {
  const linkedMemberIds = new Set(
    [
      ...(project.resources ?? []).map((resource) => resource.memberId),
      ...(project.teamStructure ?? []).map((node) => node.memberId),
      ...teamMembers
        .filter((member) => (member.assignedProjectIds ?? []).includes(project.id))
        .map((member) => member.id),
    ].filter(Boolean) as string[],
  );

  const linkedEmails = new Set(
    teamMembers
      .filter((member) => linkedMemberIds.has(member.id))
      .map((member) => normalizeText(member.email))
      .filter(Boolean),
  );

  return userAccounts.filter(
    (account) =>
      (account.teamMemberId && linkedMemberIds.has(account.teamMemberId)) ||
      linkedEmails.has(normalizeText(account.email)),
  );
};

export const mergeWorkspaceUserAccounts = (
  localAccounts: WorkspaceUserAccount[] = [],
  remoteAccounts: WorkspaceUserAccount[] = [],
) => {
  const merged = [...remoteAccounts];

  for (const local of localAccounts) {
    const matchIndex = merged.findIndex(
      (remote) =>
        remote.id === local.id ||
        normalizeText(remote.email) === normalizeText(local.email) ||
        normalizeText(remote.fullName) === normalizeText(local.fullName),
    );

    if (matchIndex >= 0) {
      merged[matchIndex] = { ...local, ...merged[matchIndex] };
      continue;
    }

    merged.push(local);
  }

  return merged;
};
