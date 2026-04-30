import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

type ProjectLike = {
  id?: string;
  status?: string;
  [key: string]: unknown;
};

type DashboardStatsLike = {
  totalProjects?: number;
  activeProjects?: number;
  projects?: ProjectLike[];
  [key: string]: unknown;
};

const workspaceStorageKey = "synergi-workspace-data";
const archivedStorageKey = "synergi-archived-projects";

const isArchivedProject = (project: ProjectLike) => project?.status === "archived";

const filterActiveProjects = <T extends ProjectLike>(projects: T[] = []) =>
  projects.filter((project) => !isArchivedProject(project));

const sanitizeLocalWorkspaceProjects = () => {
  try {
    const raw = window.localStorage.getItem(workspaceStorageKey);
    if (!raw) return;

    const data = JSON.parse(raw) as { projects?: ProjectLike[] };
    if (!Array.isArray(data.projects)) return;

    const archived = data.projects.filter(isArchivedProject);
    if (!archived.length) return;

    const archivedRaw = window.localStorage.getItem(archivedStorageKey);
    const archivedExisting = archivedRaw ? JSON.parse(archivedRaw) : [];
    const archivedById = new Map<string, ProjectLike>();

    if (Array.isArray(archivedExisting)) {
      archivedExisting.forEach((project) => {
        if (project?.id) archivedById.set(project.id, project);
      });
    }

    archived.forEach((project) => {
      if (project.id) archivedById.set(project.id, project);
    });

    data.projects = filterActiveProjects(data.projects);
    window.localStorage.setItem(workspaceStorageKey, JSON.stringify(data));
    window.localStorage.setItem(archivedStorageKey, JSON.stringify(Array.from(archivedById.values())));
  } catch (error) {
    console.warn("Could not sanitize archived projects from local workspace cache", error);
  }
};

const sanitizeDashboardStats = (stats: DashboardStatsLike | undefined) => {
  if (!stats) return stats;
  const activeProjects = filterActiveProjects(stats.projects ?? []);
  return {
    ...stats,
    projects: activeProjects,
    totalProjects: activeProjects.length,
    activeProjects: activeProjects.filter((project) => project.status === "active").length,
  };
};

const ActiveProjectDataSanitizer = () => {
  const queryClient = useQueryClient();
  const location = useLocation();

  useEffect(() => {
    const sanitize = () => {
      sanitizeLocalWorkspaceProjects();

      queryClient.setQueryData<ProjectLike[]>(["projects"], (projects) =>
        Array.isArray(projects) ? filterActiveProjects(projects) : projects,
      );

      queryClient.setQueryData<DashboardStatsLike>(["dashboard-stats"], sanitizeDashboardStats);
    };

    sanitize();
    const timer = window.setTimeout(sanitize, 1200);
    window.addEventListener("storage", sanitize);
    window.addEventListener("workspace-import-progress", sanitize);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", sanitize);
      window.removeEventListener("workspace-import-progress", sanitize);
    };
  }, [location.pathname, queryClient]);

  return null;
};

export default ActiveProjectDataSanitizer;
