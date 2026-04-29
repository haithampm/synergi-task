import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type CachedProject = {
  id: string;
  name: string;
  status?: string;
  department?: string;
};

const workspaceStorageKey = "synergi-workspace-data";

const readCachedProjects = (): CachedProject[] => {
  try {
    const raw = window.localStorage.getItem(workspaceStorageKey);
    if (!raw) return [];
    const data = JSON.parse(raw) as { projects?: CachedProject[] };
    return Array.isArray(data.projects)
      ? data.projects.filter((project) => project?.id && project?.name && project.status !== "archived")
      : [];
  } catch {
    return [];
  }
};

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const replaceVisibleLabels = (root: HTMLElement) => {
  root.querySelectorAll("button, [role='tab'], h1, h2, h3, p, span").forEach((element) => {
    const current = element.textContent ?? "";
    if (current === "New Project") element.textContent = "Create Project";
    if (["Registry", "Function", "Project Registry", "Project Function"].includes(current)) element.textContent = "Projects";
    if (current === "Delete Project") element.textContent = "Archive / Delete Project";
  });
};

const findLifecycleHeading = () => {
  const headings = Array.from(document.querySelectorAll("h1,h2,h3,p,span")) as HTMLElement[];
  return headings.find((element) => normalize(element.textContent).includes("implementation lifecycle matrix"));
};

const getLifecycleRows = () => {
  const heading = findLifecycleHeading();
  const section = heading?.closest("section, .space-y-4, .space-y-6, .rounded-2xl, .rounded-3xl") ?? document.body;
  return Array.from(section.querySelectorAll("tr, [role='row']")) as HTMLElement[];
};

const hideArchivedProjectRows = () => {
  getLifecycleRows().forEach((row) => {
    row.style.display = normalize(row.innerText).includes("archived") ? "none" : "";
  });
};

const addLifecycleFilters = (projects: CachedProject[]) => {
  const heading = findLifecycleHeading();
  if (!heading || document.getElementById("project-lifecycle-filter-panel")) return;

  const departments = Array.from(new Set(projects.map((project) => project.department).filter(Boolean))) as string[];
  const statuses = Array.from(new Set(projects.map((project) => project.status).filter(Boolean))) as string[];

  const panel = document.createElement("div");
  panel.id = "project-lifecycle-filter-panel";
  panel.className = "my-3 grid gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm md:grid-cols-5";
  panel.innerHTML = `
    <label class="space-y-1 font-semibold md:col-span-2">Search matrix
      <input data-matrix-search placeholder="Search project, leader, stage..." class="w-full rounded-xl border bg-background px-3 py-2 text-sm font-medium" />
    </label>
    <label class="space-y-1 font-semibold">Project
      <select data-project-filter class="w-full rounded-xl border bg-background px-3 py-2 text-sm font-medium">
        <option value="all">All active projects</option>
        ${projects.map((project) => `<option value="${project.id}">${project.name}</option>`).join("")}
      </select>
    </label>
    <label class="space-y-1 font-semibold">Status
      <select data-status-filter class="w-full rounded-xl border bg-background px-3 py-2 text-sm font-medium">
        <option value="all">All statuses</option>
        ${statuses.map((status) => `<option value="${status}">${status}</option>`).join("")}
      </select>
    </label>
    <label class="space-y-1 font-semibold">Department
      <select data-department-filter class="w-full rounded-xl border bg-background px-3 py-2 text-sm font-medium">
        <option value="all">All departments</option>
        ${departments.map((department) => `<option value="${department}">${department}</option>`).join("")}
      </select>
    </label>
    <button type="button" data-clear-lifecycle-filter class="rounded-xl border bg-background px-3 py-2 text-sm font-bold hover:bg-primary/10 md:col-start-5">Clear filters</button>
  `;

  (heading.closest("div") ?? heading).insertAdjacentElement("afterend", panel);

  const applyFilters = () => {
    const search = normalize((panel.querySelector("[data-matrix-search]") as HTMLInputElement | null)?.value ?? "");
    const projectId = (panel.querySelector("[data-project-filter]") as HTMLSelectElement | null)?.value ?? "all";
    const status = (panel.querySelector("[data-status-filter]") as HTMLSelectElement | null)?.value ?? "all";
    const department = (panel.querySelector("[data-department-filter]") as HTMLSelectElement | null)?.value ?? "all";
    const selectedProject = projects.find((project) => project.id === projectId);

    getLifecycleRows().forEach((row) => {
      const text = normalize(row.innerText);
      row.style.display =
        !text.includes("archived") &&
        (!search || text.includes(search)) &&
        (projectId === "all" || text.includes(normalize(selectedProject?.name))) &&
        (status === "all" || text.includes(normalize(status))) &&
        (department === "all" || text.includes(normalize(department)))
          ? ""
          : "none";
    });
  };

  panel.addEventListener("change", applyFilters);
  panel.addEventListener("input", applyFilters);
  panel.querySelector("[data-clear-lifecycle-filter]")?.addEventListener("click", () => {
    panel.querySelectorAll("select").forEach((select) => ((select as HTMLSelectElement).value = "all"));
    const searchInput = panel.querySelector("[data-matrix-search]") as HTMLInputElement | null;
    if (searchInput) searchInput.value = "";
    applyFilters();
  });

  applyFilters();
};

const markProjectNamesClickable = (projects: CachedProject[], navigate: ReturnType<typeof useNavigate>) => {
  const projectByName = new Map(projects.map((project) => [normalize(project.name), project]));
  const nodes = Array.from(document.querySelectorAll("td, th, p, span, h2, h3, button")) as HTMLElement[];

  nodes.slice(0, 400).forEach((node) => {
    if (node.dataset.projectClickable === "true") return;
    const project = projectByName.get(normalize(node.textContent));
    if (!project) return;

    node.dataset.projectClickable = "true";
    node.title = "Open project details";
    node.classList.add("cursor-pointer", "text-primary", "hover:underline", "font-semibold");
    node.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      navigate(`/projects?projectId=${project.id}`);
    }, { once: false });
  });
};

const enhanceDeleteLabels = () => {
  Array.from(document.querySelectorAll("button")).forEach((button) => {
    const element = button as HTMLButtonElement;
    const text = normalize(element.textContent);
    if (element.dataset.projectDeleteEnhanced === "true") return;
    if (!text.includes("delete") && !text.includes("archive")) return;

    element.dataset.projectDeleteEnhanced = "true";
    element.title = "Archive keeps the project recoverable. Permanent delete should be used only when you are sure.";
  });
};

const ProjectExperienceEnhancer = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname !== "/projects") return undefined;

    let cancelled = false;
    const timers = [150, 700, 1600].map((delay) => window.setTimeout(() => {
      if (cancelled) return;
      window.requestAnimationFrame(() => {
        const projects = readCachedProjects();
        replaceVisibleLabels(document.body);
        addLifecycleFilters(projects);
        hideArchivedProjectRows();
        markProjectNamesClickable(projects, navigate);
        enhanceDeleteLabels();
      });
    }, delay));

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [location.pathname, navigate]);

  return null;
};

export default ProjectExperienceEnhancer;
