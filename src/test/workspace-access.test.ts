import { describe, expect, it } from "vitest";
import {
  getProjectLinkedUserAccounts,
  hasWorkspacePermission,
  mergeWorkspaceUserAccounts,
  normalizeWorkspaceRoleId,
  resolveProjectLeader,
} from "@/lib/workspace-access";
import type {
  WorkspacePermissionRole,
  WorkspaceProject,
  WorkspaceTeamMember,
  WorkspaceUserAccount,
} from "@/lib/workspace-store";

const privilegeRoles: WorkspacePermissionRole[] = [
  { id: "admin", name: "Admin", permissions: ["manage_users", "view_reports"] },
  { id: "pm", name: "Project Manager", permissions: ["manage_projects", "view_reports"] },
  { id: "lead", name: "Lead", permissions: ["manage_tasks"] },
  { id: "viewer", name: "Viewer", permissions: ["view_reports"] },
];

const teamMembers: WorkspaceTeamMember[] = [
  {
    id: "tm-lead",
    name: "Haitham Elmohamady",
    role: "Project Manager",
    avatar: "HE",
    email: "haitham.pm@gmail.com",
    tasksAssigned: 0,
    tasksCompleted: 0,
    status: "online",
    department: "PMO",
    assignedProjectIds: ["project-alpha"],
    privilegeRole: "pm",
  },
  {
    id: "tm-user",
    name: "Mona Ahmed",
    role: "Business Analyst",
    avatar: "MA",
    email: "mona@example.com",
    tasksAssigned: 0,
    tasksCompleted: 0,
    status: "online",
    department: "Delivery",
    assignedProjectIds: ["project-alpha"],
    privilegeRole: "lead",
  },
];

const userAccounts: WorkspaceUserAccount[] = [
  {
    id: "ua-lead",
    fullName: "Haitham Elmohamady",
    email: "haitham.pm@gmail.com",
    roleId: "pm",
    status: "active",
    authProvider: "email",
    teamMemberId: "tm-lead",
    title: "Project Manager",
    department: "PMO",
    createdAt: "2026-04-01",
  },
  {
    id: "ua-user",
    fullName: "Mona Ahmed",
    email: "mona@example.com",
    roleId: "lead",
    status: "active",
    authProvider: "email",
    teamMemberId: "tm-user",
    title: "Business Analyst",
    department: "Delivery",
    createdAt: "2026-04-01",
  },
];

const project: WorkspaceProject = {
  id: "project-alpha",
  name: "Project Alpha",
  description: "Important rollout",
  status: "active",
  progress: 55,
  team: ["Haitham Elmohamady", "Mona Ahmed"],
  startDate: "2026-04-01",
  endDate: "2026-06-01",
  tasksTotal: 0,
  tasksCompleted: 0,
  priority: "high",
  resources: [
    {
      id: "resource-lead",
      name: "Haitham Elmohamady",
      role: "Project Manager",
      allocation: 60,
      plannedHours: 80,
      memberId: "tm-lead",
    },
  ],
  teamStructure: [
    {
      id: "node-user",
      name: "Mona Ahmed",
      title: "Business Analyst",
      memberId: "tm-user",
    },
  ],
};

describe("workspace-access helpers", () => {
  it("normalizes remote workspace roles to local role ids", () => {
    expect(normalizeWorkspaceRoleId("project_manager")).toBe("pm");
    expect(normalizeWorkspaceRoleId("team_member")).toBe("lead");
    expect(normalizeWorkspaceRoleId("guest")).toBe("viewer");
  });

  it("checks permissions from the mapped role set", () => {
    expect(hasWorkspacePermission("admin", privilegeRoles, "manage_users")).toBe(true);
    expect(hasWorkspacePermission("viewer", privilegeRoles, "manage_users")).toBe(false);
  });

  it("merges remote user accounts over browser-local cache records", () => {
    const merged = mergeWorkspaceUserAccounts(
      [{ ...userAccounts[0], title: "Old Title" }],
      [{ ...userAccounts[0], title: "Project Manager" }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("Project Manager");
  });

  it("resolves the project leader from linked team and account data", () => {
    const leader = resolveProjectLeader(project, teamMembers, userAccounts);
    expect(leader.name).toBe("Haitham Elmohamady");
    expect(leader.roleLabel).toBe("Project Manager");
    expect(leader.userAccount?.id).toBe("ua-lead");
  });

  it("returns linked project user accounts for the implementation matrix", () => {
    const linked = getProjectLinkedUserAccounts(project, teamMembers, userAccounts);
    expect(linked.map((account) => account.id)).toEqual(["ua-lead", "ua-user"]);
  });
});
