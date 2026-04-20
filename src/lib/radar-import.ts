import { lifecycleStageCatalog, type LifecycleStageKey } from "@/lib/project-activities";
import {
  makeId,
  type WorkspaceData,
  type WorkspaceProject,
  type WorkspaceProjectRadarMetrics,
  type WorkspaceProjectRadarStageCounts,
  type WorkspaceTeamMember,
} from "@/lib/workspace-store";

export type RadarImportRow = {
  rank: number;
  projectName: string;
  ownerName: string;
  totalActivities: number;
  completionPct?: number;
  stageCounts: WorkspaceProjectRadarStageCounts;
};

type StageHeaderDefinition = {
  key: LifecycleStageKey;
  matches: string[];
};

const stageHeaderMap: StageHeaderDefinition[] = [
  { key: "planning", matches: ["1- planning", "1-planning", "planning"] },
  { key: "analysis", matches: ["2- analysis", "2-analysis", "analysis"] },
  { key: "infra", matches: ["3- infra", "3-infra", "infra", "infrastructure"] },
  { key: "design", matches: ["4- design", "4-design", "design"] },
  { key: "development", matches: ["5- development", "5-development", "development"] },
  { key: "uat", matches: ["6- uat", "6-uat", "uat"] },
  { key: "deployment", matches: ["7- deployment", "7-deployment", "deployment"] },
  { key: "training", matches: ["8- training", "8-training", "training"] },
  { key: "go-live", matches: ["9- go-live", "9-go-live", "go-live", "golive"] },
  { key: "support", matches: ["10- support", "10-support", "support"] },
];

const createEmptyStageCounts = (): WorkspaceProjectRadarStageCounts => ({
  planning: 0,
  analysis: 0,
  infra: 0,
  design: 0,
  development: 0,
  uat: 0,
  deployment: 0,
  training: 0,
  "go-live": 0,
  support: 0,
});

const normalizeText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const normalizeIdentity = (value: string) =>
  normalizeText(value).replace(/[^\p{L}\p{N}]+/gu, " ").trim();

const toNumber = (value: string | undefined) => {
  const normalized = String(value ?? "")
    .trim()
    .replace(/,/g, "")
    .replace(/%/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((value) => value.trim());
};

const stringifyCsvValue = (value: unknown) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

const recordsToCsv = (records: Array<Record<string, unknown>>) => {
  if (!records.length) return "";
  const headers = Object.keys(records[0]);
  return [
    headers.join(","),
    ...records.map((record) => headers.map((header) => stringifyCsvValue(record[header])).join(",")),
  ].join("\n");
};

const buildRadarMetrics = (
  row: RadarImportRow,
  importedAt: string,
  sourceFileName?: string,
): WorkspaceProjectRadarMetrics => ({
  source: "csv-radar",
  ownerName: row.ownerName,
  totalActivities: row.totalActivities,
  completionPct: row.completionPct,
  importedAt,
  sourceFileName,
  stageCounts: row.stageCounts,
});

const findHeaderIndex = (rows: string[][]) =>
  rows.findIndex((columns) => {
    const normalized = columns.map(normalizeText);
    return normalized.includes("projects") && normalized.some((column) => column.includes("planning"));
  });

const getStageColumnMap = (headers: string[]) =>
  headers.reduce<Partial<Record<LifecycleStageKey, number>>>((acc, header, index) => {
    const normalized = normalizeText(header);
    const stage = stageHeaderMap.find((item) => item.matches.some((match) => normalized.includes(match)));
    if (stage) acc[stage.key] = index;
    return acc;
  }, {});

const makeInitials = (value: string) =>
  value
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

const upsertProjectOwnerLinks = (
  project: WorkspaceProject,
  owner: WorkspaceTeamMember,
  totalActivities: number,
) => {
  const plannedHours = Math.max(totalActivities * 8, 40);
  const resourceExists = (project.resources ?? []).some(
    (resource) => normalizeIdentity(resource.name) === normalizeIdentity(owner.name),
  );
  const teamNodeExists = (project.teamStructure ?? []).some(
    (node) => normalizeIdentity(node.name) === normalizeIdentity(owner.name),
  );

  return {
    resources: resourceExists
      ? (project.resources ?? []).map((resource) =>
          normalizeIdentity(resource.name) === normalizeIdentity(owner.name)
            ? {
                ...resource,
                role: resource.role || "Service Delivery Manager",
                plannedHours: Math.max(resource.plannedHours ?? 0, plannedHours),
                allocation: Math.max(resource.allocation ?? 0, 100),
                memberId: resource.memberId ?? owner.id,
              }
            : resource,
        )
      : [
          ...(project.resources ?? []),
          {
            id: makeId("resource"),
            name: owner.name,
            role: "Service Delivery Manager",
            allocation: 100,
            plannedHours,
            memberId: owner.id,
          },
        ],
    teamStructure: teamNodeExists
      ? (project.teamStructure ?? []).map((node) =>
          normalizeIdentity(node.name) === normalizeIdentity(owner.name)
            ? {
                ...node,
                title: node.title || "Service Delivery Manager",
                memberId: node.memberId ?? owner.id,
              }
            : node,
        )
      : [
          ...(project.teamStructure ?? []),
          {
            id: makeId("team"),
            name: owner.name,
            title: "Service Delivery Manager",
            memberId: owner.id,
            reportsTo: "",
            responsibilities: "Imported from implementation radar ownership mapping.",
          },
        ],
  };
};

export const parseRadarCsv = (text: string): RadarImportRow[] => {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);

  const headerIndex = findHeaderIndex(rows);
  if (headerIndex < 0) return [];

  const headers = rows[headerIndex];
  const normalizedHeaders = headers.map(normalizeText);
  const projectIndex = normalizedHeaders.findIndex((header) => header === "projects");
  const ownerIndex = normalizedHeaders.findIndex((header) => header === "sdm");
  const totalIndex = normalizedHeaders.findIndex((header) => header.includes("total activ"));
  const rankIndex = normalizedHeaders.findIndex((header) => header === "#");
  const percentIndex = normalizedHeaders.findIndex((header) => header.includes("%"));
  const stageColumns = getStageColumnMap(headers);
  if (projectIndex < 0 || totalIndex < 0) return [];

  return rows
    .slice(headerIndex + 1)
    .map((columns) => {
      const projectName = columns[projectIndex] ?? "";
      const normalizedProjectName = normalizeText(projectName);
      if (!projectName || normalizedProjectName === "total") return null;

      const stageCounts = createEmptyStageCounts();
      lifecycleStageCatalog.forEach((stage) => {
        stageCounts[stage.key] = toNumber(columns[stageColumns[stage.key] ?? -1]);
      });

      const derivedTotal = Object.values(stageCounts).reduce((sum, value) => sum + value, 0);

      return {
        rank: toNumber(columns[rankIndex]) || derivedTotal,
        projectName,
        ownerName: columns[ownerIndex] ?? "",
        totalActivities: toNumber(columns[totalIndex]) || derivedTotal,
        completionPct: percentIndex >= 0 ? toNumber(columns[percentIndex]) : undefined,
        stageCounts,
      } satisfies RadarImportRow;
    })
    .filter((row): row is RadarImportRow => Boolean(row));
};

export const radarRowsToCleanRecords = (rows: RadarImportRow[]) =>
  rows.map((row) => ({
    rank: row.rank,
    project_name: row.projectName,
    owner_name: row.ownerName,
    total_activities: row.totalActivities,
    completion_pct: row.completionPct ?? "",
    planning: row.stageCounts.planning,
    analysis: row.stageCounts.analysis,
    infra: row.stageCounts.infra,
    design: row.stageCounts.design,
    development: row.stageCounts.development,
    uat: row.stageCounts.uat,
    deployment: row.stageCounts.deployment,
    training: row.stageCounts.training,
    go_live: row.stageCounts["go-live"],
    support: row.stageCounts.support,
  }));

export const radarRowsToCsv = (rows: RadarImportRow[]) => recordsToCsv(radarRowsToCleanRecords(rows));

export const buildRadarTemplateCsv = () =>
  recordsToCsv([
    {
      rank: 1,
      project_name: "Example Project",
      owner_name: "Service Delivery Manager",
      total_activities: 12,
      completion_pct: 25,
      planning: 1,
      analysis: 2,
      infra: 1,
      design: 2,
      development: 3,
      uat: 1,
      deployment: 1,
      training: 1,
      go_live: 0,
      support: 0,
    },
  ]);

export const applyRadarRowsToWorkspace = (
  current: WorkspaceData,
  rows: RadarImportRow[],
  sourceFileName?: string,
) => {
  const importedAt = new Date().toISOString();
  const nextProjects = [...current.projects];
  const nextTeamMembers = [...current.teamMembers];

  rows.forEach((row) => {
    const ownerIdentity = normalizeIdentity(row.ownerName);
    let owner =
      nextTeamMembers.find((member) => normalizeIdentity(member.name) === ownerIdentity) ??
      nextTeamMembers.find((member) => normalizeIdentity(member.email ?? "") === ownerIdentity);

    if (!owner && row.ownerName.trim()) {
      owner = {
        id: makeId("member"),
        name: row.ownerName.trim(),
        role: "Service Delivery Manager",
        avatar: makeInitials(row.ownerName),
        email: "",
        tasksAssigned: 0,
        tasksCompleted: 0,
        status: "online",
        department: "Solutions Delivery",
        avatarColor: "gradient-primary",
        assignedProjectIds: [],
        capacityHours: 40,
        utilizationTarget: 85,
        privilegeRole: "pm",
        customFieldValues: {},
      };
      nextTeamMembers.push(owner);
    }

    const projectIdentity = normalizeIdentity(row.projectName);
    const projectIndex = nextProjects.findIndex(
      (project) => normalizeIdentity(project.name) === projectIdentity,
    );
    const existingProject = projectIndex >= 0 ? nextProjects[projectIndex] : undefined;
    const ownerLinks =
      owner && existingProject
        ? upsertProjectOwnerLinks(existingProject, owner, row.totalActivities)
        : undefined;

    const nextProject: WorkspaceProject = existingProject
      ? {
          ...existingProject,
          resources: ownerLinks?.resources ?? existingProject.resources ?? [],
          teamStructure: ownerLinks?.teamStructure ?? existingProject.teamStructure ?? [],
          radarLifecycle: buildRadarMetrics(row, importedAt, sourceFileName),
        }
      : {
          id: makeId("project"),
          name: row.projectName,
          description: "Imported from implementation radar matrix.",
          status: "active",
          progress: row.completionPct ?? 0,
          team: owner ? [owner.name] : [],
          startDate: "",
          endDate: "",
          tasksTotal: 0,
          tasksCompleted: 0,
          priority: "medium",
          start_date: "",
          end_date: "",
          budget: "",
          department: "Solutions Delivery",
          projectNature: "Imported from implementation radar matrix.",
          tags: ["radar-import", "implementation"],
          files: [],
          milestones: [],
          resources:
            owner
              ? [
                  {
                    id: makeId("resource"),
                    name: owner.name,
                    role: "Service Delivery Manager",
                    allocation: 100,
                    plannedHours: Math.max(row.totalActivities * 8, 40),
                    memberId: owner.id,
                  },
                ]
              : [],
          teamStructure:
            owner
              ? [
                  {
                    id: makeId("team"),
                    name: owner.name,
                    title: "Service Delivery Manager",
                    memberId: owner.id,
                    reportsTo: "",
                    responsibilities: "Imported from implementation radar ownership mapping.",
                  },
                ]
              : [],
          stakeholders: [],
          risks: [],
          documents: [],
          risk_level: "medium",
          namespace: current.settings.namespace.slug,
          workflowId: current.workflows.find((workflow) => workflow.entity === "task")?.id,
          customFieldValues: {},
          radarLifecycle: buildRadarMetrics(row, importedAt, sourceFileName),
        };

    if (owner) {
      const assignedProjectIds = new Set(owner.assignedProjectIds ?? []);
      assignedProjectIds.add(nextProject.id);
      const ownerIndex = nextTeamMembers.findIndex((member) => member.id === owner.id);
      if (ownerIndex >= 0) {
        nextTeamMembers[ownerIndex] = {
          ...nextTeamMembers[ownerIndex],
          assignedProjectIds: Array.from(assignedProjectIds),
        };
      }
    }

    if (projectIndex >= 0) nextProjects[projectIndex] = nextProject;
    else nextProjects.unshift(nextProject);
  });

  const importedProjectNames = rows.map((row) => row.projectName).join(", ");
  const nextAuditLogs = [
    {
      id: makeId("audit"),
      action: "Radar Matrix Import",
      entityType: "project" as const,
      entityId: sourceFileName ?? "radar-import",
      actorName: current.settings.currentUser.displayName,
      detail: `Imported implementation radar metrics for ${rows.length} project(s): ${importedProjectNames}.`,
      createdAt: importedAt,
    },
    ...current.auditLogs,
  ];

  return {
    ...current,
    projects: nextProjects,
    teamMembers: nextTeamMembers,
    auditLogs: nextAuditLogs,
  };
};
