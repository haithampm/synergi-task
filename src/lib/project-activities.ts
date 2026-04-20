import type { WorkspaceProject, WorkspaceProjectRadarStageCounts, WorkspaceTask } from "@/lib/workspace-store";

export const lifecycleStageCatalog = [
  { key: "planning", label: "1-Planning", color: "bg-orange-500", border: "border-orange-400", text: "text-orange-700" },
  { key: "analysis", label: "2-Analysis", color: "bg-emerald-500", border: "border-emerald-500", text: "text-emerald-700" },
  { key: "infra", label: "3-Infra", color: "bg-sky-500", border: "border-sky-500", text: "text-sky-700" },
  { key: "design", label: "4-Design", color: "bg-fuchsia-500", border: "border-fuchsia-500", text: "text-fuchsia-700" },
  { key: "development", label: "5-Development", color: "bg-lime-500", border: "border-lime-500", text: "text-lime-700" },
  { key: "uat", label: "6-UAT", color: "bg-orange-400", border: "border-orange-400", text: "text-orange-700" },
  { key: "deployment", label: "7-Deployment", color: "bg-green-600", border: "border-green-600", text: "text-green-700" },
  { key: "training", label: "8-Training", color: "bg-cyan-500", border: "border-cyan-500", text: "text-cyan-700" },
  { key: "go-live", label: "9-Go-Live", color: "bg-pink-400", border: "border-pink-400", text: "text-pink-700" },
  { key: "support", label: "10-Support", color: "bg-lime-600", border: "border-lime-600", text: "text-lime-700" },
] as const;

export type LifecycleStageKey = (typeof lifecycleStageCatalog)[number]["key"];

export const createEmptyLifecycleStageCounts = (): WorkspaceProjectRadarStageCounts => ({
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

const stageLookup = lifecycleStageCatalog.reduce<Record<string, LifecycleStageKey>>((acc, stage) => {
  acc[stage.key] = stage.key;
  return acc;
}, {});

const includesAny = (haystack: string, needles: string[]) => needles.some((needle) => haystack.includes(needle));

export const getTaskLifecycleStage = (task: Pick<WorkspaceTask, "phase" | "title" | "description" | "tags" | "status">): LifecycleStageKey => {
  const content = [
    task.phase ?? "",
    task.title ?? "",
    task.description ?? "",
    ...(task.tags ?? []),
    task.status ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (includesAny(content, ["support", "hypercare", "maintenance"])) return stageLookup["support"];
  if (includesAny(content, ["go-live", "golive", "launch", "cutover live"])) return stageLookup["go-live"];
  if (includesAny(content, ["training", "enablement", "knowledge transfer"])) return stageLookup["training"];
  if (includesAny(content, ["deploy", "deployment", "release", "cutover"])) return stageLookup["deployment"];
  if (includesAny(content, ["uat", "user acceptance", "testing", "qa"])) return stageLookup["uat"];
  if (includesAny(content, ["develop", "execution", "build", "implementation", "backend", "frontend", "mobile", "api", "devops", "data"])) return stageLookup["development"];
  if (includesAny(content, ["design", "ux", "ui", "prototype", "wireframe"])) return stageLookup["design"];
  if (includesAny(content, ["infra", "infrastructure", "platform", "environment", "server"])) return stageLookup["infra"];
  if (includesAny(content, ["analysis", "discovery", "assessment", "requirement"])) return stageLookup["analysis"];
  return stageLookup["planning"];
};

export const getProjectLifecycleStageCounts = (
  project: WorkspaceProject,
  tasks: WorkspaceTask[],
): WorkspaceProjectRadarStageCounts => {
  if (project.radarLifecycle?.stageCounts) {
    return {
      ...createEmptyLifecycleStageCounts(),
      ...project.radarLifecycle.stageCounts,
    };
  }

  const counts = createEmptyLifecycleStageCounts();
  tasks
    .filter((task) => (task.project_id ?? task.projectId) === project.id)
    .forEach((task) => {
      const stage = getTaskLifecycleStage(task);
      counts[stage] += 1;
    });
  return counts;
};

export const getProjectLifecycleActivityTotal = (
  project: WorkspaceProject,
  tasks: WorkspaceTask[],
) => {
  if (project.radarLifecycle?.totalActivities !== undefined) {
    return project.radarLifecycle.totalActivities;
  }

  return Object.values(getProjectLifecycleStageCounts(project, tasks)).reduce((sum, value) => sum + value, 0);
};
